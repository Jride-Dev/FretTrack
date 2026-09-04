import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatShopDateTime } from '../../shared/utils/dateFormat';
import WorkspaceSection from '../../shared/components/WorkspaceSection.jsx';
import { assignCustomerMessageJob, listCustomerCorrespondence, markCustomerMessageRead } from './customerCorrespondenceRepository.js';

export default function UnassignedCorrespondenceQueue({ customers = [], shopId = '', canWrite = false, dateOptions = {}, onNotice }) {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeMessageId, setActiveMessageId] = useState('');
  const [selectedJobByMessage, setSelectedJobByMessage] = useState({});

  const customerNames = useMemo(
    () => new Map(customers.map((customer) => [customer.id, customer.displayName || customer.email || customer.phone || 'Customer'])),
    [customers]
  );

  const loadQueue = useCallback(async () => {
    if (!shopId) {
      setMessages([]);
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      const correspondence = await listCustomerCorrespondence({ shopId, unassignedOnly: true, limit: 200 });
      setMessages(correspondence.filter((message) => message.direction === 'inbound'));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unassigned correspondence could not be loaded.');
    } finally {
      setIsLoading(false);
    }
  }, [shopId]);

  useEffect(() => { loadQueue(); }, [loadQueue]);

  async function handleMarkRead(message) {
    if (!canWrite || message.readAt || message.status !== 'received') return;
    setActiveMessageId(message.id);
    try {
      const saved = await markCustomerMessageRead(message.id);
      setMessages((current) => current.map((item) => item.id === saved.id ? saved : item));
    } catch (actionError) {
      onNotice?.({ type: 'error', message: actionError instanceof Error ? actionError.message : 'Message could not be marked read.' });
    } finally {
      setActiveMessageId('');
    }
  }

  async function handleAssign(message) {
    const jobId = selectedJobByMessage[message.id];
    if (!canWrite || !jobId) return;
    setActiveMessageId(message.id);
    try {
      await assignCustomerMessageJob(message.id, jobId);
      setMessages((current) => current.filter((item) => item.id !== message.id));
      setSelectedJobByMessage((current) => {
        const next = { ...current };
        delete next[message.id];
        return next;
      });
      onNotice?.({ type: 'success', message: 'Inbound correspondence routed to the selected work order.' });
    } catch (actionError) {
      onNotice?.({ type: 'error', message: actionError instanceof Error ? actionError.message : 'Customer correspondence could not be routed.' });
    } finally {
      setActiveMessageId('');
    }
  }

  const unreadCount = messages.filter((message) => message.status === 'received' && !message.readAt).length;

  return (
    <WorkspaceSection
      title="Unassigned Inbox"
      description="Inbound correspondence without a work-order assignment stays here for deliberate staff review."
    >
      <div className="unassigned-correspondence-toolbar no-print">
        <span className="muted-text">{unreadCount ? `${unreadCount} unread` : 'No unread messages'}</span>
        <button type="button" className="secondary" onClick={loadQueue} disabled={isLoading}>
          {isLoading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>
      {isLoading && <p className="muted-text">Loading unassigned inbox...</p>}
      {error && <p className="error-text" role="alert">{error}</p>}
      {!isLoading && !error && !messages.length && <p className="muted-text">No unassigned inbound correspondence.</p>}
      {messages.length > 0 && (
        <div className="customer-conversation-list unassigned-correspondence-list">
          {messages.map((message) => (
            <article key={message.id} className={`customer-conversation-message inbound${message.readAt ? '' : ' unread'}`}>
              {(() => {
                const customer = customers.find((item) => item.id === message.customerId);
                const jobs = customer?.jobs || [];
                return (
                  <>
              <div className="customer-conversation-message-heading">
                <strong>{customerNames.get(message.customerId) || 'Unknown customer'} · {message.channel.toUpperCase()}</strong>
                <time>{formatShopDateTime(message.receivedAt || message.createdAt, dateOptions)}</time>
              </div>
              <div className="customer-conversation-message-meta">
                <span>Unassigned</span>
                <span>{message.status}</span>
                {message.sender && <span>{message.sender}</span>}
              </div>
              <p>{message.body || 'No message body.'}</p>
              <div className="customer-conversation-message-actions no-print">
                {message.status === 'received' && (
                  <button type="button" className="secondary" disabled={!canWrite || activeMessageId === message.id || Boolean(message.readAt)} onClick={() => handleMarkRead(message)}>
                    {message.readAt ? 'Read' : activeMessageId === message.id ? 'Marking...' : 'Mark read'}
                  </button>
                )}
                <label className="unassigned-correspondence-route">
                  <span>Route to work order</span>
                  <select
                    value={selectedJobByMessage[message.id] || ''}
                    onChange={(event) => setSelectedJobByMessage((current) => ({ ...current, [message.id]: event.target.value }))}
                    disabled={!canWrite || activeMessageId === message.id || !jobs.length}
                  >
                    <option value="">{jobs.length ? 'Select work order...' : 'No customer work orders'}</option>
                    {jobs.map((job) => <option key={job.id} value={job.id}>{job.jobNumber || job.id} · {job.instrumentType || job.guitarBrand || job.customerName || 'Work order'}</option>)}
                  </select>
                </label>
                <button type="button" className="secondary" disabled={!canWrite || activeMessageId === message.id || !selectedJobByMessage[message.id]} onClick={() => handleAssign(message)}>
                  {activeMessageId === message.id ? 'Routing...' : 'Route message'}
                </button>
              </div>
                  </>
                );
              })()}
            </article>
          ))}
        </div>
      )}
    </WorkspaceSection>
  );
}
