import { useEffect, useRef, useState } from 'react';
import {
  AMPLIFIER_EVIDENCE_TEST_TYPES,
  deleteJobEvidence,
  getJobEvidence,
  uploadJobEvidence,
  validateEvidenceFile
} from './jobEvidenceService.js';

export default function AmplifierEvidenceSection({ job, canWrite = true, onNotice }) {
  const [evidence, setEvidence] = useState([]);
  const [testType, setTestType] = useState('noise_floor_zero');
  const [notes, setNotes] = useState('');
  const [pendingFile, setPendingFile] = useState(null);
  const [pendingUrl, setPendingUrl] = useState('');
  const [pendingDuration, setPendingDuration] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const recorderRef = useRef(null);
  const recordingStreamRef = useRef(null);
  const recordingStartedAtRef = useRef(0);
  const recordingTimerRef = useRef(null);

  useEffect(() => {
    loadEvidence();
  }, [job.id]);

  useEffect(() => () => {
    stopRecordingResources();
    if (pendingUrl) URL.revokeObjectURL(pendingUrl);
  }, [pendingUrl]);

  async function loadEvidence() {
    setIsLoading(true);
    try {
      setEvidence(await getJobEvidence(job.id));
    } catch (error) {
      onNotice?.({ type: 'error', message: error?.message || 'Diagnostic evidence could not be loaded.' });
    } finally {
      setIsLoading(false);
    }
  }

  function chooseFile(event) {
    const file = event.target.files?.[0] || null;
    if (!file) return;
    try {
      validateEvidenceFile(file);
      setPendingEvidence(file, null);
    } catch (error) {
      onNotice?.({ type: 'error', message: error.message });
      event.target.value = '';
    }
  }

  function setPendingEvidence(file, durationSeconds) {
    if (pendingUrl) URL.revokeObjectURL(pendingUrl);
    setPendingFile(file);
    setPendingUrl(file ? URL.createObjectURL(file) : '');
    setPendingDuration(durationSeconds);
  }

  async function startRecording() {
    if (!canWrite || isRecording) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      onNotice?.({ type: 'error', message: 'This browser does not support microphone recording. Upload a saved audio file instead.' });
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getSupportedRecordingMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      const chunks = [];
      recordingStreamRef.current = stream;
      recorderRef.current = recorder;
      recordingStartedAtRef.current = Date.now();
      setRecordingSeconds(0);
      setIsRecording(true);
      recordingTimerRef.current = window.setInterval(() => {
        setRecordingSeconds(Math.floor((Date.now() - recordingStartedAtRef.current) / 1000));
      }, 500);

      recorder.addEventListener('dataavailable', (event) => {
        if (event.data?.size) chunks.push(event.data);
      });
      recorder.addEventListener('stop', () => {
        const durationSeconds = (Date.now() - recordingStartedAtRef.current) / 1000;
        const recordedMimeType = recorder.mimeType || mimeType || 'audio/webm';
        const storageMimeType = recordedMimeType.split(';')[0];
        const extension = storageMimeType.includes('ogg') ? 'ogg' : storageMimeType.includes('mp4') ? 'm4a' : 'webm';
        const blob = new Blob(chunks, { type: storageMimeType });
        const file = new File([blob], `amplifier-${testType}-${Date.now()}.${extension}`, { type: storageMimeType });
        setPendingEvidence(file, durationSeconds);
        stopRecordingResources();
        setIsRecording(false);
      });
      recorder.start(500);
    } catch (error) {
      stopRecordingResources();
      setIsRecording(false);
      onNotice?.({ type: 'error', message: error?.message || 'Microphone access could not be started.' });
    }
  }

  function stopRecording() {
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.stop();
    }
  }

  async function uploadPending() {
    if (!pendingFile || !canWrite) return;
    setIsUploading(true);
    try {
      const saved = await uploadJobEvidence(job, pendingFile, {
        testType,
        notes,
        durationSeconds: pendingDuration
      });
      setEvidence((current) => [saved, ...current]);
      setPendingEvidence(null, null);
      setNotes('');
      onNotice?.({ type: 'success', message: 'Amplifier diagnostic evidence saved.' });
    } catch (error) {
      onNotice?.({ type: 'error', message: error?.message || 'Diagnostic evidence could not be saved.' });
    } finally {
      setIsUploading(false);
    }
  }

  async function removeEvidence(item) {
    if (!canWrite || !window.confirm(`Delete ${item.fileName || 'this diagnostic recording'}?`)) return;
    try {
      await deleteJobEvidence(job, item);
      setEvidence((current) => current.filter((row) => row.id !== item.id));
      onNotice?.({ type: 'success', message: 'Diagnostic evidence deleted.' });
    } catch (error) {
      onNotice?.({ type: 'error', message: error?.message || 'Diagnostic evidence could not be deleted.' });
    }
  }

  return (
    <section className="panel amplifier-evidence-section">
      <div className="panel-heading">
        <div>
          <h3>Audio & Diagnostic Evidence</h3>
          <p className="muted-text">Attach repeatable test evidence. Record through a properly isolated dummy-load/DI or microphone signal path—never connect a speaker output directly to a computer input.</p>
        </div>
      </div>

      {canWrite && (
        <div className="amplifier-evidence-capture">
          <label>
            Test
            <select value={testType} onChange={(event) => setTestType(event.target.value)} disabled={isRecording || isUploading}>
              {AMPLIFIER_EVIDENCE_TEST_TYPES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label>
            Upload Audio or Diagnostic Image
            <input type="file" accept="audio/webm,audio/ogg,audio/mpeg,audio/mp4,audio/aac,audio/wav,image/jpeg,image/png,image/webp" onChange={chooseFile} disabled={isRecording || isUploading} />
          </label>
          <label className="wide">
            Conditions / Trigger Notes
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows="2" disabled={isRecording || isUploading} placeholder="Controls, input level, dummy load, channel, temperature, or intermittent-fault trigger…" />
          </label>
          <div className="mode-actions amplifier-recording-actions wide">
            {!isRecording
              ? <button type="button" onClick={startRecording} disabled={isUploading}>Record Microphone</button>
              : <button type="button" className="danger" onClick={stopRecording}>Stop Recording ({formatDuration(recordingSeconds)})</button>}
            {pendingFile && <button type="button" onClick={uploadPending} disabled={isUploading}>{isUploading ? 'Uploading…' : 'Save Evidence'}</button>}
            {pendingFile && <button type="button" className="button-tertiary" onClick={() => setPendingEvidence(null, null)} disabled={isUploading}>Discard</button>}
          </div>
          {pendingFile && (
            <div className="amplifier-evidence-preview wide">
              <strong>Ready to save: {pendingFile.name}</strong>
              {pendingFile.type.startsWith('audio/')
                ? <audio controls src={pendingUrl} />
                : <img src={pendingUrl} alt="Pending diagnostic evidence" />}
            </div>
          )}
        </div>
      )}

      {isLoading && <p className="muted-text">Loading diagnostic evidence…</p>}
      {!isLoading && !evidence.length && <p className="empty-state">No audio recordings or diagnostic captures are attached.</p>}
      <div className="amplifier-evidence-list">
        {evidence.map((item) => (
          <article className="amplifier-evidence-card" key={item.id}>
            <div className="amplifier-evidence-card-heading">
              <div>
                <strong>{getTestTypeLabel(item.testType)}</strong>
                <small>{item.fileName} · {formatBytes(item.fileSizeBytes)} · {new Date(item.capturedAt).toLocaleString()}</small>
              </div>
              {canWrite && <button type="button" className="danger-link" onClick={() => removeEvidence(item)}>Delete</button>}
            </div>
            {item.evidenceKind === 'audio'
              ? <audio controls preload="metadata" src={item.url} />
              : item.url && <img src={item.url} alt={`${getTestTypeLabel(item.testType)} diagnostic capture`} />}
            {item.notes && <p>{item.notes}</p>}
          </article>
        ))}
      </div>
    </section>
  );

  function stopRecordingResources() {
    if (recordingTimerRef.current) window.clearInterval(recordingTimerRef.current);
    recordingTimerRef.current = null;
    recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
    recordingStreamRef.current = null;
    recorderRef.current = null;
  }
}

function getSupportedRecordingMimeType() {
  return ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4']
    .find((mimeType) => MediaRecorder.isTypeSupported(mimeType)) || '';
}

function getTestTypeLabel(value) {
  return AMPLIFIER_EVIDENCE_TEST_TYPES.find((option) => option.value === value)?.label || 'Other test evidence';
}

function formatBytes(value) {
  const bytes = Number(value || 0);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds || 0)));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}
