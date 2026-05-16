import { useEffect, useMemo, useState } from 'react';

const PVMH_EMAIL = 'jon@pvmusichouse.com';

export default function SubcontractorPickupEmailDialog({ job, isSending, onCancel, onSend }) {
  const defaultMessage = useMemo(() => createDefaultMessage(job), [job]);
  const [subject, setSubject] = useState(defaultMessage.subject);
  const [body, setBody] = useState(defaultMessage.body);

  useEffect(() => {
    const nextMessage = createDefaultMessage(job);
    setSubject(nextMessage.subject);
    setBody(nextMessage.body);
  }, [job?.id]);

  if (!job) {
    return null;
  }

  return (
    <div className="feedback-backdrop no-print" role="presentation">
      <form
        className="feedback-modal"
        onSubmit={(event) => {
          event.preventDefault();
          onSend({ subject, body, to: PVMH_EMAIL });
        }}
      >
        <div className="feedback-modal-heading">
          <div>
            <h2>Email PVMH</h2>
            <p>{PVMH_EMAIL}</p>
          </div>
          <button type="button" className="app-notice-dismiss" onClick={onCancel} aria-label="Close PVMH email">
            x
          </button>
        </div>
        <p className="muted-text">
          This Sub-Contract job is marked for PVMH. Send Jon a ready-for-pickup email?
        </p>
        <label>
          Subject
          <input value={subject} onChange={(event) => setSubject(event.target.value)} required />
        </label>
        <label>
          Message
          <textarea value={body} onChange={(event) => setBody(event.target.value)} rows={7} required />
        </label>
        <div className="feedback-actions">
          <button type="button" className="button-tertiary" onClick={onCancel} disabled={isSending}>
            Skip Email
          </button>
          <button type="submit" className="primary-action" disabled={isSending || !subject.trim() || !body.trim()}>
            {isSending ? 'Sending...' : 'Send To PVMH'}
          </button>
        </div>
      </form>
    </div>
  );
}

export function shouldOfferPvmhPickupEmail(job) {
  const shopId = String(job?.shopId || '').toLowerCase();
  const intakeType = String(job?.techDetails?.intakeType || '').toLowerCase();
  const subcontractorName = normalizeSubcontractorName(job?.techDetails?.subcontractorName);

  return (
    shopId === 'default-shop'
    && intakeType === 'sub-contract'
    && (
      subcontractorName.includes('pvmh')
      || subcontractorName.includes('pv music')
      || subcontractorName.includes('palos verdes music')
    )
  );
}

function createDefaultMessage(job = {}) {
  const safeJob = job || {};
  const customerName = safeJob.customerName || 'Customer';
  const instrument = [safeJob.guitarBrand, safeJob.model].filter(Boolean).join(' ') || safeJob.instrumentType || 'instrument';
  const jobNumber = safeJob.jobNumber ? ` Job #${safeJob.jobNumber}` : '';

  return {
    subject: `${customerName}'s ${instrument} is ready${jobNumber}`,
    body: `Hi Jon,\n\n${customerName}'s ${instrument} is ready to pick up.${jobNumber ? `\n\n${jobNumber.trim()}` : ''}\n\nThanks,\nFretTrack`
  };
}

function normalizeSubcontractorName(value = '') {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ');
}
