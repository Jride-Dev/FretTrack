import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const TEST_PASSWORD = 'FretTrackTest123!';
const localEnv = parseEnv(readFileSync('.env.local', 'utf8'));
const statusEnv = parseEnv(execFileSync('supabase', ['status', '-o', 'env'], { encoding: 'utf8' }));
const supabaseUrl = localEnv.VITE_SUPABASE_URL || statusEnv.API_URL;
const anonKey = localEnv.VITE_SUPABASE_ANON_KEY || statusEnv.ANON_KEY;

if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(supabaseUrl || '')) {
  throw new Error('Refusing to test amplifier evidence outside local Supabase.');
}
if (!anonKey) {
  throw new Error('Local Supabase publishable key is unavailable. Run `supabase start` first.');
}

const ownerA = createClient(supabaseUrl, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
const ownerB = createClient(supabaseUrl, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
let storagePath = '';
let evidenceId = '';
let reservationId = '';
let reservationSettled = false;

try {
  await signIn(ownerA, 'test1.owner@frettrack.local');
  await signIn(ownerB, 'test2.owner@frettrack.local');

  const { data: job, error: jobError } = await ownerA
    .from('jobs')
    .select('id')
    .eq('shop_id', 'test1-shop')
    .limit(1)
    .single();
  if (jobError || !job?.id) throw new Error(`Local test job lookup failed: ${jobError?.message || 'No job found.'}`);

  evidenceId = randomUUID();
  reservationId = randomUUID();
  storagePath = `${job.id}/${evidenceId}-local-evidence.webm`;
  const testFile = new File(
    [new TextEncoder().encode('FretTrack local amplifier evidence integration test')],
    'local-evidence.webm',
    { type: 'audio/webm' }
  );
  const { data: reservation, error: reservationError } = await ownerA.rpc('reserve_shop_usage', {
    target_shop_id: 'test1-shop',
    target_request_id: reservationId,
    target_usage_kind: 'source_photo',
    requested_units: 1,
    expected_storage_bytes: testFile.size,
    target_bucket: 'job-evidence',
    target_path: storagePath
  });
  if (reservationError || !reservation?.allowed) throw new Error(`Evidence usage reservation failed: ${reservationError?.message || 'Reservation denied.'}`);

  const { error: uploadError } = await ownerA.storage.from('job-evidence').upload(storagePath, testFile, {
    contentType: testFile.type,
    upsert: false
  });
  if (uploadError) throw new Error(`Owner evidence upload failed: ${uploadError.message}`);
  const { error: settleError } = await ownerA.rpc('settle_shop_usage_reservation', {
    target_shop_id: 'test1-shop',
    target_request_id: reservationId
  });
  if (settleError) throw new Error(`Evidence usage settlement failed: ${settleError.message}`);
  reservationSettled = true;

  const { error: insertError } = await ownerA.from('job_evidence').insert({
    id: evidenceId,
    job_id: job.id,
    evidence_kind: 'audio',
    test_type: 'noise_floor_zero',
    storage_path: storagePath,
    file_name: testFile.name,
    mime_type: testFile.type,
    file_size_bytes: testFile.size,
    notes: 'Local integration test; removed automatically.'
  });
  if (insertError) throw new Error(`Owner evidence metadata insert failed: ${insertError.message}`);

  const { data: ownRows, error: ownReadError } = await ownerA.from('job_evidence').select('id').eq('id', evidenceId);
  if (ownReadError || ownRows?.length !== 1) throw new Error(`Owner evidence read failed: ${ownReadError?.message || 'Expected one row.'}`);

  const { data: crossShopRows, error: crossShopReadError } = await ownerB.from('job_evidence').select('id').eq('id', evidenceId);
  if (crossShopReadError || crossShopRows?.length !== 0) throw new Error(`Cross-shop evidence isolation failed: ${crossShopReadError?.message || 'Row was visible.'}`);

  const { data: signed, error: signedError } = await ownerA.storage.from('job-evidence').createSignedUrl(storagePath, 60);
  if (signedError || !signed?.signedUrl) throw new Error(`Evidence signed URL failed: ${signedError?.message || 'No URL returned.'}`);
  const response = await fetch(signed.signedUrl);
  if (!response.ok) throw new Error(`Evidence signed download returned HTTP ${response.status}.`);

  console.log('Local amplifier evidence upload, signed playback, cleanup, and cross-shop isolation checks passed.');
} finally {
  if (evidenceId) await ownerA.from('job_evidence').delete().eq('id', evidenceId);
  if (storagePath) await ownerA.storage.from('job-evidence').remove([storagePath]);
  if (reservationSettled && storagePath) {
    await ownerA.rpc('release_photo_storage_object', {
      target_shop_id: 'test1-shop',
      target_bucket: 'job-evidence',
      target_path: storagePath
    });
  } else if (reservationId) {
    await ownerA.rpc('release_shop_usage_reservation', {
      target_shop_id: 'test1-shop',
      target_request_id: reservationId
    });
  }
  await ownerA.auth.signOut();
  await ownerB.auth.signOut();
}

async function signIn(client, email) {
  const { data, error } = await client.auth.signInWithPassword({ email, password: TEST_PASSWORD });
  if (error || !data.user) throw new Error(`Local sign-in failed for ${email}: ${error?.message || 'No user returned.'}`);
}

function parseEnv(text) {
  return Object.fromEntries(String(text || '').split(/\r?\n/).map((line) => {
    const match = line.match(/^\s*(?:export\s+)?([A-Z0-9_]+)=(.*)\s*$/);
    if (!match) return null;
    return [match[1], match[2].replace(/^['"]|['"]$/g, '')];
  }).filter(Boolean));
}
