import { hasSupabaseConfig, supabase } from '../../shared/lib/supabaseClient.js';
import { logJobEventSafe } from '../jobs/jobEventsService.js';
import { getCurrentShopId } from '../shops/shopConfig.js';
import {
  releaseDeletedPhotoStorage,
  releasePhotoUsageReservation,
  reservePhotoUsage,
  settlePhotoUsage
} from '../billing/usageCaps.js';

const JOB_EVIDENCE_BUCKET = 'job-evidence';
const MAX_EVIDENCE_BYTES = 25 * 1024 * 1024;
const SIGNED_URL_TTL_SECONDS = 60 * 60;

export const AMPLIFIER_EVIDENCE_TEST_TYPES = [
  { value: 'noise_floor_zero', label: 'Noise floor — controls at zero' },
  { value: 'noise_floor_max', label: 'Noise floor — controls at maximum' },
  { value: 'frequency_sweep', label: '20 Hz–20 kHz frequency sweep' },
  { value: 'clipping_distortion', label: 'Clipping / distortion test' },
  { value: 'transient_fault', label: 'Intermittent pop / crackle / dropout' },
  { value: 'oscilloscope_sine', label: 'Oscilloscope — sine wave' },
  { value: 'oscilloscope_square', label: 'Oscilloscope — square wave' },
  { value: 'spectrum_analysis', label: 'RTA / spectrum analysis' },
  { value: 'other', label: 'Other test evidence' }
];

const ALLOWED_MIME_TYPES = new Set([
  'audio/webm',
  'audio/ogg',
  'audio/mpeg',
  'audio/mp4',
  'audio/aac',
  'audio/wav',
  'audio/x-wav',
  'image/jpeg',
  'image/png',
  'image/webp'
]);

export function classifyEvidenceKind(file, testType = 'other') {
  const mimeType = String(file?.type || '').toLowerCase();
  if (mimeType.startsWith('audio/')) {
    return 'audio';
  }
  if (testType.startsWith('oscilloscope_')) {
    return 'waveform';
  }
  if (testType === 'spectrum_analysis') {
    return 'spectrum';
  }
  return 'other_image';
}

export function validateEvidenceFile(file) {
  if (!file) {
    throw new Error('Choose an audio recording or diagnostic image first.');
  }
  const mimeType = String(file.type || '').toLowerCase();
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new Error('Use WebM, OGG, MP3, MP4, AAC, or WAV audio, or a JPEG, PNG, or WebP diagnostic image.');
  }
  if (!Number.isFinite(file.size) || file.size < 1 || file.size > MAX_EVIDENCE_BYTES) {
    throw new Error('Diagnostic evidence files must be larger than 0 bytes and no more than 25 MB.');
  }
  return true;
}

export async function getJobEvidence(jobId) {
  requireEvidenceBackend();
  if (!jobId) {
    return [];
  }

  const { data, error } = await supabase
    .from('job_evidence')
    .select('*')
    .eq('job_id', jobId)
    .order('captured_at', { ascending: false });

  if (error) {
    throw new Error(`Diagnostic evidence could not be loaded: ${error.message}`);
  }

  return Promise.all((data || []).map(hydrateEvidence));
}

export async function uploadJobEvidence(job, file, {
  testType = 'other',
  notes = '',
  durationSeconds = null
} = {}) {
  requireEvidenceBackend();
  if (!job?.id) {
    throw new Error('Save the amplifier work order before adding diagnostic evidence.');
  }
  validateEvidenceFile(file);

  const id = crypto.randomUUID();
  const safeName = safeStorageFileName(file.name || defaultEvidenceFileName(file.type));
  const storagePath = `${job.id}/${id}-${safeName}`;
  const evidenceKind = classifyEvidenceKind(file, testType);
  const capturedAt = new Date().toISOString();
  const shopId = job.shopId || getCurrentShopId();
  const requestId = crypto.randomUUID();
  await reservePhotoUsage({
    shopId,
    requestId,
    expectedStorageBytes: file.size,
    bucket: JOB_EVIDENCE_BUCKET,
    path: storagePath
  });
  const { error: uploadError } = await supabase.storage
    .from(JOB_EVIDENCE_BUCKET)
    .upload(storagePath, file, {
      cacheControl: '3600',
      contentType: file.type,
      upsert: false
    });

  if (uploadError) {
    await releasePhotoUsageReservation({ shopId, requestId }).catch(() => null);
    throw new Error(`Diagnostic evidence upload failed: ${uploadError.message}`);
  }

  try {
    await settlePhotoUsage({ shopId, requestId });
  } catch (error) {
    await supabase.storage.from(JOB_EVIDENCE_BUCKET).remove([storagePath]);
    await releasePhotoUsageReservation({ shopId, requestId }).catch(() => null);
    throw new Error(`Diagnostic evidence usage could not be settled: ${error.message}`);
  }

  const row = {
    id,
    job_id: job.id,
    evidence_kind: evidenceKind,
    test_type: testType,
    storage_path: storagePath,
    file_name: file.name || safeName,
    mime_type: file.type,
    file_size_bytes: file.size,
    duration_seconds: normalizeDuration(durationSeconds),
    notes: String(notes || '').trim(),
    captured_at: capturedAt
  };
  const { data, error: insertError } = await supabase
    .from('job_evidence')
    .insert(row)
    .select()
    .single();

  if (insertError) {
    await supabase.storage.from(JOB_EVIDENCE_BUCKET).remove([storagePath]);
    await releaseDeletedPhotoStorage({ shopId, bucket: JOB_EVIDENCE_BUCKET, path: storagePath }).catch(() => null);
    throw new Error(`Diagnostic evidence record failed: ${insertError.message}`);
  }

  logJobEventSafe({
    shopId: job.shopId || getCurrentShopId(),
    jobId: job.id,
    eventType: 'amplifier_evidence_added',
    eventLabel: 'Amplifier diagnostic evidence added',
    eventNote: row.file_name,
    eventData: {
      evidenceId: id,
      evidenceKind,
      testType,
      mimeType: row.mime_type,
      fileSizeBytes: row.file_size_bytes
    }
  });

  return hydrateEvidence(data);
}

export async function deleteJobEvidence(job, evidence) {
  requireEvidenceBackend();
  if (!job?.id || !evidence?.id || !evidence?.storagePath) {
    throw new Error('The diagnostic evidence record is incomplete.');
  }

  const { error: storageError } = await supabase.storage
    .from(JOB_EVIDENCE_BUCKET)
    .remove([evidence.storagePath]);
  if (storageError) {
    throw new Error(`Diagnostic evidence file could not be deleted: ${storageError.message}`);
  }

  const { error: rowError } = await supabase
    .from('job_evidence')
    .delete()
    .eq('id', evidence.id)
    .eq('job_id', job.id);
  if (rowError) {
    throw new Error(`Diagnostic evidence record could not be deleted: ${rowError.message}`);
  }
  await releaseDeletedPhotoStorage({
    shopId: job.shopId || getCurrentShopId(),
    bucket: JOB_EVIDENCE_BUCKET,
    path: evidence.storagePath
  });

  logJobEventSafe({
    shopId: job.shopId || getCurrentShopId(),
    jobId: job.id,
    eventType: 'amplifier_evidence_deleted',
    eventLabel: 'Amplifier diagnostic evidence deleted',
    eventNote: evidence.fileName || '',
    eventData: {
      evidenceId: evidence.id,
      evidenceKind: evidence.evidenceKind,
      testType: evidence.testType
    }
  });
}

async function hydrateEvidence(row) {
  const { data, error } = await supabase.storage
    .from(JOB_EVIDENCE_BUCKET)
    .createSignedUrl(row.storage_path, SIGNED_URL_TTL_SECONDS);
  if (error) {
    throw new Error(`Diagnostic evidence playback URL failed: ${error.message}`);
  }
  return {
    id: row.id,
    jobId: row.job_id,
    evidenceKind: row.evidence_kind,
    testType: row.test_type,
    storagePath: row.storage_path,
    fileName: row.file_name,
    mimeType: row.mime_type,
    fileSizeBytes: Number(row.file_size_bytes || 0),
    durationSeconds: row.duration_seconds == null ? null : Number(row.duration_seconds),
    notes: row.notes || '',
    capturedAt: row.captured_at,
    createdBy: row.created_by || '',
    url: data?.signedUrl || ''
  };
}

function requireEvidenceBackend() {
  if (!hasSupabaseConfig || !supabase) {
    throw new Error('Diagnostic evidence requires the configured FretTrack storage service.');
  }
}

function safeStorageFileName(fileName) {
  return String(fileName || '')
    .trim()
    .replace(/[^a-z0-9._-]+/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'amplifier-evidence.webm';
}

function defaultEvidenceFileName(mimeType = '') {
  if (mimeType === 'audio/wav' || mimeType === 'audio/x-wav') return 'amplifier-test.wav';
  if (String(mimeType).startsWith('image/')) return 'diagnostic-image.png';
  return 'amplifier-test.webm';
}

function normalizeDuration(value) {
  const duration = Number(value);
  return Number.isFinite(duration) && duration >= 0 ? Math.round(duration * 100) / 100 : null;
}
