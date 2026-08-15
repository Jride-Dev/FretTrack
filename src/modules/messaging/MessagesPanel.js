import { useEffect, useMemo, useState } from 'react';
import { formatShopDateTime, toLocalDateTimeInputValue } from '../../shared/utils/dateFormat';
import { getShopDateOptions } from '../shops/shopConfig';
import { buildShopSignature, defaultTemplateKey, instrumentName, messageTemplates, renderTemplate } from './messageTemplates';
import { sendCustomerChannelMessage, smsDisabledMessage, smsEnabled } from './messageService';

export default function MessagesPanel({
  canWrite = true,
  canSendEmailByPlan = true,
  canScheduleEmail = false,
  canSendSmsByPlan = true,
  entitlementMessage = '',
  job,
  onPreferenceChange,
  onSendMessage,
  onGetSmsMode,
  onTemplateChange,
  shopProfile = null
}) {
  const [templateKey, setTemplateKey] = useState(job.techDetails?.lastMessageTemplate || defaultTemplateKey);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [sendState, setSendState] = useState({ sending: '', error: '', success: '' });
  const [smsMode, setSmsMode] = useState('checking');
  const dateOptions = getShopDateOptions(shopProfile || undefined);

  const variables = useMemo(() => ({
    customer_name: job.customerName || '',
    job_number: job.jobNumber || '',
    instrument: instrumentName(job),
    appointment_datetime: formatShopDateTime(job.dropOffAt, dateOptions) || 'the agreed date and time',
    shop_name: shopProfile?.shopName || '',
    shop_signature: buildShopSignature(shopProfile || {})
  }), [dateOptions.dateFormat, dateOptions.locale, job, shopProfile]);

  useEffect(() => {
    applyTemplate(job.techDetails?.lastMessageTemplate || defaultTemplateKey, { saveSelection: false });
  }, [job.id, job.shopId, shopProfile?.shopId, shopProfile?.updatedAt]);

  useEffect(() => {
    applyTemplate(templateKey, { saveSelection: false });
  }, [variables.appointment_datetime, variables.customer_name, variables.job_number, variables.instrument, variables.shop_name, variables.shop_signature]);

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

  async function handleScheduleEmail() {
    setSendState({ sending: 'schedule', error: '', success: '' });

    if (!canScheduleEmail) {
      setSendState({ sending: '', error: 'Scheduled Email is available on Pro.', success: '' });
      return;
    }
    if (!job.emailOptIn) {
      setSendState({ sending: '', error: 'Email opt-in is required before scheduling a customer email.', success: '' });
      return;
    }

    const timestamp = new Date(scheduledAt).getTime();
    const leadTime = timestamp - Date.now();
    if (!Number.isFinite(timestamp)) {
      setSendState({ sending: '', error: 'Choose a valid date and time for the scheduled email.', success: '' });
      return;
    }
    if (leadTime < 2 * 60 * 1000) {
      setSendState({ sending: '', error: 'Scheduled email time must be at least 2 minutes in the future.', success: '' });
      return;
    }
    if (leadTime > 30 * 24 * 60 * 60 * 1000) {
      setSendState({ sending: '', error: 'Scheduled emails can be set up to 30 days ahead.', success: '' });
      return;
    }

    const result = await onSendMessage({
      channel: 'email',
      templateKey,
      subject,
      body,
      scheduledAt: new Date(timestamp).toISOString()
    });
    if (!result.ok) {
      setSendState({ sending: '', error: result.error || 'Email could not be scheduled.', success: '' });
      return;
    }

    setScheduledAt('');
    setSendState({ sending: '', error: '', success: 'Email scheduled with the delivery provider and added to message history.' });
  }

  async function handleCancelScheduledEmail(message) {
    setSendState({ sending: `cancel:${message.id}`, error: '', success: '' });
    const result = await onSendMessage({
      action: 'cancel_scheduled',
      channel: 'email',
      messageId: message.id
    });
    if (!result.ok) {
      setSendState({ sending: '', error: result.error || 'Scheduled email could not be canceled.', success: '' });
      return;
    }
    setSendState({ sending: '', error: '', success: 'Scheduled email canceled.' });
  }

  const messages = job.messages || [];
  const canSendEmail = canSendEmailByPlan && Boolean(job.email && body.trim());
  const canSendSms = canSendSmsByPlan && smsEnabled && Boolean(job.phone && body.trim() && job.smsOptIn);
  const scheduleMin = toLocalDateTimeInputValue(Date.now() + 2 * 60 * 1000);
  const scheduleMax = toLocalDateTimeInputValue(Date.now() + 30 * 24 * 60 * 60 * 1000);

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
          <input type="checkbox" checked={Boolean(job.emailOptIn)} onChange={(event) => onPreferenceChange('emailOptIn', event.target.checked)} disabled={!canWrite} />
          Email opt-in
        </label>
        <label className="checkline">
          <input
            type="checkbox"
            checked={Boolean(job.smsOptIn)}
            disabled={!canWrite || !smsEnabled}
            title={!smsEnabled ? smsDisabledMessage : undefined}
            onChange={(event) => onPreferenceChange('smsOptIn', event.target.checked)}
          />
          SMS opt-in
        </label>
        <label>
          Preferred Contact
          <select value={job.preferredContactMethod || 'email'} onChange={(event) => onPreferenceChange('preferredContactMethod', event.target.value)} disabled={!canWrite}>
            <option value="email">Email</option>
            <option value="sms" disabled={!smsEnabled}>SMS</option>
            <option value="none">None</option>
          </select>
        </label>
      </div>

      <div className="message-form">
        <label className="wide">
          Template
          <select value={templateKey} onChange={(event) => applyTemplate(event.target.value)} disabled={!canWrite}>
            {Object.entries(messageTemplates).map(([key, template]) => (
              <option key={key} value={key}>{template.label}</option>
            ))}
          </select>
        </label>
        <label className="wide">
          Subject
          <input value={subject} onChange={(event) => setSubject(event.target.value)} disabled={!canWrite} />
        </label>
        <label className="wide">
          Editable Message Preview
          <textarea value={body} onChange={(event) => setBody(event.target.value)} rows="6" disabled={!canWrite} />
        </label>
        {!smsEnabled && <p className="message-info wide">{smsDisabledMessage}</p>}
        {entitlementMessage && <p className="message-info wide">{entitlementMessage}</p>}
        {smsEnabled && !job.smsOptIn && <p className="message-error wide">SMS opt-in is required before texting this customer.</p>}
        {sendState.error && <p className="message-error wide">{sendState.error}</p>}
        {sendState.success && <p className="message-success wide">{sendState.success}</p>}
        <div className="message-actions wide">
          <button type="button" disabled={!canWrite || Boolean(sendState.sending) || !canSendEmail} onClick={() => handleSend('email')}>
            {sendState.sending === 'email' ? 'Sending Email...' : 'Send Email'}
          </button>
          <button
            type="button"
            disabled={!canWrite || Boolean(sendState.sending) || !canSendSms}
            onClick={() => handleSend('sms')}
            title={!smsEnabled ? smsDisabledMessage : undefined}
          >
            {sendState.sending === 'sms' ? 'Sending SMS...' : 'Send SMS'}
          </button>
          <button
            type="button"
            disabled={!canWrite || Boolean(sendState.sending) || !canSendEmail || !canSendSms}
            onClick={() => handleSend('both')}
            title={!smsEnabled ? smsDisabledMessage : undefined}
          >
            {sendState.sending === 'both' ? 'Sending Both...' : 'Send Both'}
          </button>
        </div>
        <div className="message-scheduling wide">
          <div>
            <strong>Schedule Email <span className="premium-chip">Pro</span></strong>
            <p>Schedule this email with the delivery provider up to 30 days ahead. Recipient, subject, and message are saved as a snapshot.</p>
          </div>
          <label>
            Delivery date and time
            <input
              type="datetime-local"
              value={scheduledAt}
              min={scheduleMin}
              max={scheduleMax}
              onChange={(event) => setScheduledAt(event.target.value)}
              disabled={!canWrite || !canScheduleEmail || Boolean(sendState.sending)}
            />
          </label>
          <button
            type="button"
            disabled={!canWrite || !canScheduleEmail || !canSendEmail || !job.emailOptIn || !scheduledAt || Boolean(sendState.sending)}
            onClick={handleScheduleEmail}
            title={!canScheduleEmail ? 'Scheduled Email is available on Pro.' : undefined}
          >
            {sendState.sending === 'schedule' ? 'Scheduling...' : 'Schedule Email'}
          </button>
          {!canScheduleEmail && <p className="message-info">Upgrade to Pro to schedule customer email.</p>}
          {canScheduleEmail && !job.emailOptIn && <p className="message-error">Email opt-in is required before scheduling.</p>}
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
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {messages.map((message) => (
                <tr key={message.id}>
                  <td>{formatShopDateTime(message.scheduledAt || message.createdAt, dateOptions)}</td>
                  <td>{message.channel}</td>
                  <td>{formatMessageStatus(message)}</td>
                  <td>{message.recipient}</td>
                  <td className="message-history-title">
                    <strong title={message.subject || 'Message sent'}>{message.subject || 'Message sent'}</strong>
                    {message.errorMessage && <p className="message-error">{message.errorMessage}</p>}
                  </td>
                  <td>
                    {message.status === 'scheduled' && new Date(message.scheduledAt).getTime() > Date.now() && canWrite ? (
                      <button
                        type="button"
                        className="secondary"
                        disabled={Boolean(sendState.sending)}
                        onClick={() => handleCancelScheduledEmail(message)}
                      >
                        {sendState.sending === `cancel:${message.id}` ? 'Canceling...' : 'Cancel scheduled email'}
                      </button>
                    ) : null}
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

function formatMessageStatus(message) {
  if (message.status === 'scheduled') {
    return new Date(message.scheduledAt).getTime() > Date.now()
      ? 'Scheduled with provider'
      : 'Provider schedule elapsed';
  }
  if (message.status === 'canceled') return 'Canceled';
  if (message.status === 'sent') return 'Sent';
  return 'Failed';
}
