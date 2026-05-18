import { useEffect, useMemo, useState } from 'react';
import { formatShopDateTime } from '../../shared/utils/dateFormat';
import { getShopDateOptions } from '../shops/shopConfig';
import { defaultTemplateKey, instrumentName, messageTemplates, renderTemplate } from './messageTemplates';
import { sendCustomerChannelMessage, smsDisabledMessage, smsEnabled } from './messageService';

export default function MessagesPanel({ job, onPreferenceChange, onSendMessage, onGetSmsMode, onTemplateChange }) {
  const [templateKey, setTemplateKey] = useState(job.techDetails?.lastMessageTemplate || defaultTemplateKey);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sendState, setSendState] = useState({ sending: '', error: '', success: '' });
  const [smsMode, setSmsMode] = useState('checking');
  const dateOptions = getShopDateOptions();

  const variables = useMemo(() => ({
    customer_name: job.customerName || '',
    job_number: job.jobNumber || '',
    instrument: instrumentName(job)
  }), [job]);

  useEffect(() => {
    applyTemplate(job.techDetails?.lastMessageTemplate || defaultTemplateKey, { saveSelection: false });
  }, [job.id]);

  useEffect(() => {
    applyTemplate(templateKey, { saveSelection: false });
  }, [variables.customer_name, variables.job_number, variables.instrument]);

  useEffect(() => {
    let active = true;
    async function loadSmsMode() {
      if (!smsEnabled) {
        setSmsMode('disabled');
        return;
      }
      if (!onGetSmsMode) {
        setSmsMode('unknown');
        return;
      }
      const mode = await onGetSmsMode();
      if (active) {
        setSmsMode(mode || 'unknown');
      }
    }
    loadSmsMode();
    return () => {
      active = false;
    };
  }, [onGetSmsMode]);

  function applyTemplate(nextTemplateKey, options = { saveSelection: true }) {
    const cleanTemplateKey = messageTemplates[nextTemplateKey] ? nextTemplateKey : defaultTemplateKey;
    const template = messageTemplates[cleanTemplateKey];
    setTemplateKey(cleanTemplateKey);
    setSubject(renderTemplate(template.subject, variables));
    setBody(renderTemplate(template.body, variables));
    if (options.saveSelection && onTemplateChange) {
      onTemplateChange(cleanTemplateKey);
    }
  }

  async function sendChannel(channel) {
    return sendCustomerChannelMessage(onSendMessage, channel, templateKey, subject, body);
  }

  async function handleSend(channel) {
    setSendState({ sending: channel, error: '', success: '' });

    if (!smsEnabled && (channel === 'sms' || channel === 'both')) {
      setSendState({ sending: '', error: smsDisabledMessage, success: '' });
      return;
    }

    if (channel === 'sms' && !job.smsOptIn) {
      setSendState({ sending: '', error: 'SMS opt-in is required before sending text messages.', success: '' });
      return;
    }

    if (channel === 'both' && !job.smsOptIn) {
      setSendState({ sending: '', error: 'SMS opt-in is required before using Send Both.', success: '' });
      return;
    }

    const errors = [];
    if (channel === 'email' || channel === 'both') {
      const emailError = await sendChannel('email');
      if (emailError) errors.push(`Email: ${emailError}`);
    }

    if (smsEnabled && (channel === 'sms' || channel === 'both')) {
      const smsError = await sendChannel('sms');
      if (smsError) errors.push(`SMS: ${smsError}`);
    }

    if (errors.length) {
      setSendState({ sending: '', error: errors.join(' '), success: '' });
      return;
    }

    setSendState({ sending: '', error: '', success: channel === 'both' ? 'Email and SMS sent and logged.' : 'Message sent and logged.' });
  }

  const messages = job.messages || [];
  const canSendEmail = Boolean(job.email && body.trim());
  const canSendSms = smsEnabled && Boolean(job.phone && body.trim() && job.smsOptIn);

  return (
    <section className="work-order-messages">
      <h3>Work Order Messages</h3>
      <div className="contact-preference-display">
        <span>Email: {job.email || 'Missing'}</span>
        <span>Phone: {job.phone || 'Missing'}</span>
        <span>Preferred: {job.preferredContactMethod || 'email'}</span>
        <span>Email opt-in: {job.emailOptIn ? 'Yes' : 'No'}</span>
        <span>SMS opt-in: {job.smsOptIn ? 'Yes' : 'No'}</span>
        <span>SMS Status: {smsEnabled ? (smsMode === 'live' ? 'Live' : smsMode === 'test' ? 'Test' : smsMode) : 'Disabled'}</span>
      </div>

      <div className="message-preferences">
        <label className="checkline">
          <input type="checkbox" checked={Boolean(job.emailOptIn)} onChange={(event) => onPreferenceChange('emailOptIn', event.target.checked)} />
          Email opt-in
        </label>
        <label className="checkline">
          <input
            type="checkbox"
            checked={Boolean(job.smsOptIn)}
            disabled={!smsEnabled}
            title={!smsEnabled ? smsDisabledMessage : undefined}
            onChange={(event) => onPreferenceChange('smsOptIn', event.target.checked)}
          />
          SMS opt-in
        </label>
        <label>
          Preferred Contact
          <select value={job.preferredContactMethod || 'email'} onChange={(event) => onPreferenceChange('preferredContactMethod', event.target.value)}>
            <option value="email">Email</option>
            <option value="sms" disabled={!smsEnabled}>SMS</option>
            <option value="none">None</option>
          </select>
        </label>
      </div>

      <div className="message-form">
        <label className="wide">
          Template
          <select value={templateKey} onChange={(event) => applyTemplate(event.target.value)}>
            {Object.entries(messageTemplates).map(([key, template]) => (
              <option key={key} value={key}>{template.label}</option>
            ))}
          </select>
        </label>
        <label className="wide">
          Subject
          <input value={subject} onChange={(event) => setSubject(event.target.value)} />
        </label>
        <label className="wide">
          Editable Message Preview
          <textarea value={body} onChange={(event) => setBody(event.target.value)} rows="6" />
        </label>
        {!smsEnabled && <p className="message-info wide">{smsDisabledMessage}</p>}
        {smsEnabled && !job.smsOptIn && <p className="message-error wide">SMS opt-in is required before texting this customer.</p>}
        {sendState.error && <p className="message-error wide">{sendState.error}</p>}
        {sendState.success && <p className="message-success wide">{sendState.success}</p>}
        <div className="message-actions wide">
          <button type="button" disabled={Boolean(sendState.sending) || !canSendEmail} onClick={() => handleSend('email')}>
            {sendState.sending === 'email' ? 'Sending Email...' : 'Send Email'}
          </button>
          <button
            type="button"
            disabled={Boolean(sendState.sending) || !canSendSms}
            onClick={() => handleSend('sms')}
            title={!smsEnabled ? smsDisabledMessage : undefined}
          >
            {sendState.sending === 'sms' ? 'Sending SMS...' : 'Send SMS'}
          </button>
          <button
            type="button"
            disabled={Boolean(sendState.sending) || !canSendEmail || !canSendSms}
            onClick={() => handleSend('both')}
            title={!smsEnabled ? smsDisabledMessage : undefined}
          >
            {sendState.sending === 'both' ? 'Sending Both...' : 'Send Both'}
          </button>
        </div>
      </div>

      <div className="message-history">
        <h4>Message History</h4>
        {messages.length === 0 ? (
          <p className="empty">No messages yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Channel</th>
                <th>Status</th>
                <th>Recipient</th>
                <th>Message</th>
              </tr>
            </thead>
            <tbody>
              {messages.map((message) => (
                <tr key={message.id}>
                  <td>{formatShopDateTime(message.createdAt, dateOptions)}</td>
                  <td>{message.channel}</td>
                  <td>{message.status}</td>
                  <td>{message.recipient}</td>
                  <td>
                    <strong>{message.subject}</strong>
                    <p>{message.body}</p>
                    {message.errorMessage && <p className="message-error">{message.errorMessage}</p>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
