import { useEffect, useMemo, useRef, useState } from 'react';
import { formatShopDate } from '../../shared/utils/dateFormat.js';
import {
  DEFAULT_SERVICE_REMINDER_RULE,
  getServiceReminderRule,
  listServiceReminderQueue,
  saveServiceReminderRule
} from '../messaging/serviceReminderService.js';
import {
  renderServiceReminderTemplate,
  SERVICE_REMINDER_TEMPLATE_FIELDS
} from '../messaging/serviceReminderTemplates.js';

function hasReminderEntitlement(snapshot) {
  return Boolean(snapshot?.entitlements?.automated_service_reminders ?? snapshot?.automated_service_reminders);
}

function TemplateFieldButtons({ targetLabel, disabled, onInsert }) {
  return (
    <div className="service-reminder-field-picker">
      <span>Personalize {targetLabel}</span>
      <div>
        {SERVICE_REMINDER_TEMPLATE_FIELDS.map((field) => (
          <button
            key={field.token}
            type="button"
            className="service-reminder-field-chip"
            onClick={() => onInsert(field.token)}
            disabled={disabled}
            title={`Insert ${field.token}`}
          >
            <span aria-hidden="true">+</span> {field.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function ServiceReminderSettings({ shopId, shopName = '', canManageShop, entitlementSnapshot, dateOptions = {}, onNotice }) {
  const entitled = hasReminderEntitlement(entitlementSnapshot);
  const [rule, setRule] = useState(() => ({ ...DEFAULT_SERVICE_REMINDER_RULE, shopId }));
  const [keywordText, setKeywordText] = useState('setup');
  const [queue, setQueue] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const subjectInputRef = useRef(null);
  const bodyInputRef = useRef(null);

  const previewValues = useMemo(() => ({
    '{{customer_first_name}}': 'Jordan',
    '{{service_name}}': keywordText.split('\n').map((value) => value.trim()).find(Boolean) || 'setup',
    '{{shop_name}}': shopName || 'Your Shop',
    '{{months}}': String(rule.intervalMonths || 6),
    '{{booking_url}}': rule.bookingUrl || 'https://yourshop.example/book'
  }), [keywordText, rule.intervalMonths, rule.bookingUrl, shopName]);
  const previewSubject = renderServiceReminderTemplate(rule.subjectTemplate, previewValues);
  const previewBody = renderServiceReminderTemplate(rule.bodyTemplate, previewValues);

  async function load() {
    if (!shopId || !entitled) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const [nextRule, nextQueue] = await Promise.all([
        getServiceReminderRule(shopId),
        listServiceReminderQueue(shopId)
      ]);
      setRule(nextRule);
      setKeywordText(nextRule.eligibleServiceKeywords.join('\n'));
      setQueue(nextQueue);
    } catch (error) {
      onNotice?.({ type: 'error', message: error.message || 'Unable to load automated service reminders.' });
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => { load(); }, [shopId, entitled]);

  function update(event) {
    const { name, type, checked, value } = event.target;
    setRule((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }));
  }

  function insertTemplateField(name, token, inputRef) {
    const input = inputRef.current;
    const currentValue = String(rule[name] || '');
    const start = input?.selectionStart ?? currentValue.length;
    const end = input?.selectionEnd ?? start;
    const nextValue = `${currentValue.slice(0, start)}${token}${currentValue.slice(end)}`;
    setRule((current) => ({ ...current, [name]: nextValue }));
    requestAnimationFrame(() => {
      input?.focus();
      input?.setSelectionRange(start + token.length, start + token.length);
    });
  }

  async function save(event) {
    event.preventDefault();
    setIsSaving(true);
    try {
      const saved = await saveServiceReminderRule(shopId, {
        ...rule,
        eligibleServiceKeywords: keywordText.split('\n')
      });
      setRule(saved);
      setKeywordText(saved.eligibleServiceKeywords.join('\n'));
      setQueue(await listServiceReminderQueue(shopId));
      onNotice?.({ type: 'success', message: 'Automated service reminder settings saved and the due queue was rebuilt.' });
    } catch (error) {
      onNotice?.({ type: 'error', message: error.message || 'Unable to save automated service reminders.' });
    } finally {
      setIsSaving(false);
    }
  }

  if (!entitled) {
    return (
      <section className="panel service-reminder-settings feature-gate-card">
        <p className="eyebrow">Pro feature</p>
        <h3>Automated Service Reminders</h3>
        <p>Upgrade to Pro to send consent-based follow-up emails months after an eligible service.</p>
      </section>
    );
  }

  return (
    <section className="panel service-reminder-settings">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Pro feature</p>
          <h3>Automated Service Reminders</h3>
          <p className="muted-text service-reminder-intro">Bring customers back at the right time with one professional follow-up after a completed recurring service. FretTrack stores due dates in the database and sends them from one nightly worker. Resend’s 30-day scheduling limit does not apply.</p>
        </div>
        <button type="button" className="button-tertiary" onClick={load} disabled={isLoading || isSaving}>Reload</button>
      </div>
      <form className="service-reminder-form" onSubmit={save}>
        <label className="service-reminder-toggle-card">
          <input type="checkbox" name="enabled" checked={rule.enabled} onChange={update} disabled={!canManageShop || isSaving} />
          <span>
            <strong>Automatic sending</strong>
            <small>{rule.enabled ? 'Active for eligible customers who separately opted in.' : 'Off until you finish the message and enable it.'}</small>
          </span>
        </label>
        <div className="form-grid service-reminder-settings-grid">
          <label>Months after service
            <input type="number" min="1" max="60" name="intervalMonths" value={rule.intervalMonths} onChange={update} disabled={!canManageShop || isSaving} />
          </label>
          <label>Booking URL
            <input type="url" name="bookingUrl" value={rule.bookingUrl} onChange={update} disabled={!canManageShop || isSaving} placeholder="https://yourshop.example/book" />
          </label>
          <label className="wide">Eligible service keywords
            <textarea value={keywordText} onChange={(event) => setKeywordText(event.target.value)} rows="4" disabled={!canManageShop || isSaving} placeholder={'setup\nannual service'} />
            <small>One keyword per line. A completed work-order service must contain one of these phrases.</small>
          </label>
        </div>

        <section className="service-reminder-template-builder">
          <div className="service-reminder-template-heading">
            <div>
              <p className="eyebrow">Customer-facing email</p>
              <h4>Message preview</h4>
              <p className="muted-text">Sample details show how personalization will read when the reminder is sent.</p>
            </div>
            <span className="status-pill">Sample preview</span>
          </div>

          <article className="service-reminder-email-preview">
            <div className="service-reminder-preview-row">
              <span>To</span>
              <strong>Jordan · opted-in customer</strong>
            </div>
            <div className="service-reminder-preview-row">
              <span>Subject</span>
              <strong>{previewSubject || 'Add a subject line'}</strong>
            </div>
            <div className="service-reminder-preview-body">{previewBody || 'Add a customer message.'}</div>
          </article>

          <details className="service-reminder-template-editor">
            <summary>
              <span>Edit subject and message</span>
              <small>Personalization fields are filled automatically when FretTrack sends the email.</small>
            </summary>
            <div className="service-reminder-template-editor-content">
              <div className="service-reminder-template-field">
                <label htmlFor="service-reminder-subject">Subject line</label>
                <input
                  ref={subjectInputRef}
                  id="service-reminder-subject"
                  name="subjectTemplate"
                  value={rule.subjectTemplate}
                  onChange={update}
                  disabled={!canManageShop || isSaving}
                />
                <TemplateFieldButtons
                  targetLabel="the subject"
                  disabled={!canManageShop || isSaving}
                  onInsert={(token) => insertTemplateField('subjectTemplate', token, subjectInputRef)}
                />
              </div>
              <div className="service-reminder-template-field">
                <label htmlFor="service-reminder-body">Message</label>
                <textarea
                  ref={bodyInputRef}
                  id="service-reminder-body"
                  name="bodyTemplate"
                  value={rule.bodyTemplate}
                  onChange={update}
                  rows="9"
                  disabled={!canManageShop || isSaving}
                />
                <TemplateFieldButtons
                  targetLabel="the message"
                  disabled={!canManageShop || isSaving}
                  onInsert={(token) => insertTemplateField('bodyTemplate', token, bodyInputRef)}
                />
              </div>
            </div>
          </details>
        </section>

        {canManageShop && (
          <div className="service-reminder-actions">
            <button type="submit" disabled={isSaving || isLoading}>{isSaving ? 'Saving…' : 'Save Reminder Settings'}</button>
          </div>
        )}
      </form>

      <div className="service-reminder-queue-preview">
        <div>
          <h4>Reminder Queue</h4>
          <p className="muted-text">Upcoming, completed, and retried reminders appear here without exposing customer email addresses.</p>
        </div>
        {!queue.length && !isLoading && <p className="empty-state">No eligible opted-in customers are queued.</p>}
        {queue.map((item) => (
          <div key={item.id} className="service-reminder-queue-row">
            <span><strong>{item.serviceName}</strong><small>Due {formatShopDate(item.dueAt, dateOptions)}</small></span>
            <span className={`status-pill ${item.status === 'sent' ? 'success' : item.status === 'failed' ? 'warning' : ''}`}>{item.status}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
