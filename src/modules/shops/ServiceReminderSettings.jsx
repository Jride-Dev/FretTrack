import { useEffect, useState } from 'react';
import { formatShopDate } from '../../shared/utils/dateFormat.js';
import {
  DEFAULT_SERVICE_REMINDER_RULE,
  getServiceReminderRule,
  listServiceReminderQueue,
  saveServiceReminderRule
} from '../messaging/serviceReminderService.js';

function hasReminderEntitlement(snapshot) {
  return Boolean(snapshot?.entitlements?.automated_service_reminders ?? snapshot?.automated_service_reminders);
}

export default function ServiceReminderSettings({ shopId, canManageShop, entitlementSnapshot, dateOptions = {}, onNotice }) {
  const entitled = hasReminderEntitlement(entitlementSnapshot);
  const [rule, setRule] = useState(() => ({ ...DEFAULT_SERVICE_REMINDER_RULE, shopId }));
  const [keywordText, setKeywordText] = useState('setup');
  const [queue, setQueue] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

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
          <p className="muted-text">FretTrack stores due dates in the database and sends them from one nightly worker. Resend’s 30-day scheduling limit does not apply.</p>
        </div>
        <button type="button" className="button-tertiary" onClick={load} disabled={isLoading || isSaving}>Reload</button>
      </div>
      <form onSubmit={save}>
        <label className="table-checkbox">
          <input type="checkbox" name="enabled" checked={rule.enabled} onChange={update} disabled={!canManageShop || isSaving} />
          Enable automated service reminders for opted-in customers
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
          <label className="wide">Subject template
            <input name="subjectTemplate" value={rule.subjectTemplate} onChange={update} disabled={!canManageShop || isSaving} />
          </label>
          <label className="wide">Message template
            <textarea name="bodyTemplate" value={rule.bodyTemplate} onChange={update} rows="8" disabled={!canManageShop || isSaving} />
          </label>
        </div>
        <p className="muted-text">Template fields: {'{{customer_first_name}}'}, {'{{service_name}}'}, {'{{shop_name}}'}, {'{{months}}'}, and {'{{booking_url}}'}.</p>
        {canManageShop && <button type="submit" disabled={isSaving || isLoading}>{isSaving ? 'Saving…' : 'Save Reminder Settings'}</button>}
      </form>

      <div className="service-reminder-queue-preview">
        <h4>Reminder Queue</h4>
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
