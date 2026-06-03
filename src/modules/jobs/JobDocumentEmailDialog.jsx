import { useEffect, useState } from 'react';
import { isValidEmailAddress } from './emailDocuments';

export default function JobDocumentEmailDialog({
  isOpen,
  draft,
  kind,
  onClose,
  onSend
}) {
  const [recipient, setRecipient] = useState(draft?.recipient || '');
  const [subject, setSubject] = useState(draft?.subject || '');
  const [body, setBody] = useState(draft?.body || '');
  const [sendState, setSendState] = useState({ sending: false, error: '', success: '' });

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setRecipient(draft?.recipient || '');
    setSubject(draft?.subject || '');
    setBody(draft?.body || '');
    setSendState({ sending: false, error: '', success: '' });
  }, [isOpen, draft?.recipient, draft?.subject, draft?.body, draft?.type]);

  if (!isOpen || !draft) {
    return null;
  }

  const trimmedRecipient = recipient.trim();
  const recipientValid = isValidEmailAddress(trimmedRecipient);
  const canSend = recipientValid && subject.trim() && body.trim() && !sendState.sending;
  const title = kind === 'invoice' ? 'Email Invoice' : 'Email Work Order';
  const invalidRecipientMessage = !trimmedRecipient
    ? 'Add a recipient email before sending.'
    : recipientValid
      ? ''
      : 'Enter a valid email address before sending.';

  async function handleSubmit(event) {
    event.preventDefault();
    if (!canSend) {
      setSendState({
        sending: false,
        error: invalidRecipientMessage || 'Subject and message are required.',
        success: ''
      });
      return;
    }

    setSendState({ sending: true, error: '', success: '' });
    const result = await onSend({
      type: draft.type,
      recipient: trimmedRecipient,
      subject: subject.trim(),
      body: body.trim()
    });

    if (!result?.ok) {
      setSendState({
        sending: false,
        error: result?.error || 'Email send failed.',
        success: ''
      });
      return;
    }

    setSendState({
      sending: false,
      error: '',
      success: kind === 'invoice' ? 'Invoice email sent and logged.' : 'Work order email sent and logged.'
    });
  }

  return (
    <div className="feedback-backdrop no-print" role="presentation">
      <form className="feedback-modal document-email-modal" onSubmit={handleSubmit}>
        <div className="feedback-modal-heading">
          <div>
            <h2>{title}</h2>
            <p>{draft.summaryTitle}</p>
          </div>
          <button type="button" className="app-notice-dismiss" onClick={onClose} aria-label={`Close ${title}`}>
            x
          </button>
        </div>

        <label>
          To
          <input
            type="email"
            value={recipient}
            onChange={(event) => setRecipient(event.target.value)}
            placeholder="customer@example.com"
            required
          />
        </label>

        <label>
          Subject
          <input value={subject} onChange={(event) => setSubject(event.target.value)} required />
        </label>

        <label>
          Message Body
          <textarea value={body} onChange={(event) => setBody(event.target.value)} rows={14} required />
        </label>

        <div className="document-email-preview">
          <strong>{draft.summaryTitle}</strong>
          <div className="document-email-summary">
            {draft.summaryLines?.map(([label, value]) => (
              <div key={label} className="document-email-summary-row">
                <span>{label}</span>
                <strong>{value || '-'}</strong>
              </div>
            ))}
          </div>
        </div>

        {invalidRecipientMessage && <p className="message-error">{invalidRecipientMessage}</p>}
        {sendState.error && <p className="message-error">{sendState.error}</p>}
        {sendState.success && <p className="message-success">{sendState.success}</p>}

        <div className="feedback-actions">
          <button type="button" className="button-tertiary" onClick={onClose} disabled={sendState.sending}>
            Cancel
          </button>
          <button type="submit" className="primary-action" disabled={!canSend}>
            {sendState.sending ? 'Sending...' : title}
          </button>
        </div>
      </form>
    </div>
  );
}
