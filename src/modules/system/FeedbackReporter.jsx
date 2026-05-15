import { useState } from 'react';
import { getCurrentShopId } from '../shops/shopConfig';
import { submitBetaFeedback } from './systemService';

const feedbackTypes = [
  { value: 'bug', label: 'Bug' },
  { value: 'ux', label: 'Confusing UX' },
  { value: 'print', label: 'Print Issue' },
  { value: 'data', label: 'Data Issue' },
  { value: 'security', label: 'Security Concern' },
  { value: 'other', label: 'Other' }
];

const severities = [
  { value: 'normal', label: 'Normal' },
  { value: 'blocker', label: 'Blocker' },
  { value: 'high', label: 'High' },
  { value: 'low', label: 'Low' }
];

export default function FeedbackReporter({ selectedJob, onNotice }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    feedbackType: 'bug',
    severity: 'normal',
    subject: '',
    message: ''
  });

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const message = form.message.trim();
    if (!message) {
      onNotice?.({ type: 'error', message: 'Tell us what happened before submitting.' });
      return;
    }

    setIsSubmitting(true);
    try {
      await submitBetaFeedback({
        ...form,
        message,
        subject: form.subject.trim(),
        shopId: selectedJob?.shopId || getCurrentShopId(),
        jobId: selectedJob?.id || null,
        jobNumber: selectedJob?.jobNumber || ''
      });
      setIsOpen(false);
      setForm({
        feedbackType: 'bug',
        severity: 'normal',
        subject: '',
        message: ''
      });
      onNotice?.({ type: 'success', message: 'Issue report sent. Thank you.' });
    } catch (error) {
      console.error('Feedback submit failed.', error);
      onNotice?.({ type: 'error', message: `Issue report failed: ${error.message || 'Unable to submit.'}` });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <button type="button" onClick={() => setIsOpen(true)}>
        Report Issue
      </button>
      {isOpen && (
        <div className="feedback-backdrop no-print" role="presentation">
          <form className="feedback-modal" onSubmit={handleSubmit}>
            <div className="feedback-modal-heading">
              <div>
                <h2>Report Issue</h2>
                {selectedJob?.jobNumber && <p>Attached to job {selectedJob.jobNumber}</p>}
              </div>
              <button type="button" className="app-notice-dismiss" onClick={() => setIsOpen(false)} aria-label="Close report issue">
                x
              </button>
            </div>
            <div className="feedback-grid">
              <label>
                Type
                <select value={form.feedbackType} onChange={(event) => updateField('feedbackType', event.target.value)}>
                  {feedbackTypes.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label>
                Severity
                <select value={form.severity} onChange={(event) => updateField('severity', event.target.value)}>
                  {severities.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              Short Summary
              <input
                value={form.subject}
                onChange={(event) => updateField('subject', event.target.value)}
                placeholder="Photo upload failed"
                maxLength={160}
              />
            </label>
            <label>
              What happened?
              <textarea
                value={form.message}
                onChange={(event) => updateField('message', event.target.value)}
                placeholder="Tell us what you tried, what you expected, and what happened instead."
                rows={7}
              />
            </label>
            <div className="feedback-actions">
              <button type="button" className="button-tertiary" onClick={() => setIsOpen(false)} disabled={isSubmitting}>
                Cancel
              </button>
              <button type="submit" className="primary-action" disabled={isSubmitting}>
                {isSubmitting ? 'Sending...' : 'Send Report'}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
