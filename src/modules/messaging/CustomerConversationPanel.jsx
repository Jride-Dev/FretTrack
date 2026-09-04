import { useEffect, useMemo, useState } from 'react';
import { formatShopDateTime } from '../../shared/utils/dateFormat';
import WorkspaceSection from '../../shared/components/WorkspaceSection.jsx';
import { isCustomerReportEligible } from './customerCorrespondence.js';
import {
  listCustomerCorrespondence,
  markCustomerMessageRead,
  setCustomerMessageReportInclusion
} from './customerCorrespondenceRepository.js';

export default function CustomerConversationPanel({ customer, shopId = '', canWrite = false, dateOptions = {}, onNotice }) {
  const [messages, setMessages] = useState([]);
  const [channelFilter, setChannelFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeMessageId, setActiveMessageId] = useState('');

  useEffect(() => {
    let active = true;
    async function loadConversation() {
      if (!customer?.id || !shopId) {
        setMessages([]);
        return;
      }
      setIsLoading(true);
      setError('');
      try {
        const nextMessages = await listCustomerCorrespondence({ shopId, customerId: customer.id, limit: 200 });
        if (active) setMessages(nextMessages);
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Customer conversation could not be loaded.');
      } finally {
        if (active) setIsLoading(false);
      }
    }
    loadConversation();
    return () => { active = false; };
  }, [customer?.id, shopId]);

  const visibleMessages = useMemo(
    () => messages.filter((message) => channelFilter === 'all' || message.channel === channelFilter),
    [channelFilter, messages]
  );
  const unreadCount = messages.filter((message) => message.direction === 'inbound' && message.status === 'received' && !message.readAt).length;

  async function handleMarkRead(message) {
    if (!canWrite || message.readAt || message.direction !== 'inbound' || message.status !== 'received') return;
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

  async function handleReportInclusion(message) {
    if (!canWrite || (!message.includeInCustomerReport && !isCustomerReportEligible(message))) return;
    setActiveMessageId(message.id);
    try {
      const saved = await setCustomerMessageReportInclusion(message.id, !message.includeInCustomerReport);
      setMessages((current) => current.map((item) => item.id === saved.id ? saved : item));
    } catch (actionError) {
      onNotice?.({ type: 'error', message: actionError instanceof Error ? actionError.message : 'Customer report selection could not be saved.' });
    } finally {
      setActiveMessageId('');
    }
  }

  return (
    <WorkspaceSection
      title="Conversation"
      description="Review customer correspondence in one thread. Unassigned inbound messages remain visible until staff route them deliberately."
    >
      <div className="customer-conversation-toolbar no-print">
        <label>
          Channel
          <select value={channelFilter} onChange={(event) => setChannelFilter(event.target.value)}>
            <option value="all">All channels</option>
            <option value="email">Email</option>
            <option value="sms">SMS</option>
          </select>
        </label>
        <span className="muted-text">{unreadCount ? `${unreadCount} unread inbound message${unreadCount === 1 ? '' : 's'}` : 'No unread inbound messages'}</span>
      </div>
      {isLoading && <p className="muted-text">Loading conversation...</p>}
      {error && <p className="error-text" role="alert">{error}</p>}
      {!isLoading && !error && !visibleMessages.length && <p className="muted-text">No correspondence is recorded for this customer yet.</p>}
      {visibleMessages.length > 0 && (
        <div className="customer-conversation-list">
          {visibleMessages.map((message) => (
            <article key={message.id} className={`customer-conversation-message ${message.direction === 'inbound' ? 'inbound' : 'outbound'}${message.readAt ? '' : ' unread'}`}>
              <div className="customer-conversation-message-heading">
                <strong>{message.direction === 'inbound' ? 'Customer' : 'Shop'} · {message.channel.toUpperCase()}</strong>
                <time>{formatShopDateTime(message.receivedAt || message.sentAt || message.createdAt, dateOptions)}</time>
              </div>
              <div className="customer-conversation-message-meta">
                <span>{message.subject || (message.direction === 'inbound' ? 'Inbound message' : 'Customer message')}</span>
                <span>{message.jobId ? 'Work order linked' : 'Unassigned'}</span>
                <span>{message.status}</span>
              </div>
              <p>{message.body || 'No message body.'}</p>
              <div className="customer-conversation-message-actions no-print">
                {message.direction === 'inbound' && message.status === 'received' && (
                  <button type="button" className="secondary" disabled={!canWrite || activeMessageId === message.id || Boolean(message.readAt)} onClick={() => handleMarkRead(message)}>
                    {message.readAt ? 'Read' : activeMessageId === message.id ? 'Marking...' : 'Mark read'}
                  </button>
                )}
                {(message.includeInCustomerReport || isCustomerReportEligible(message)) && (
                  <button type="button" className="secondary" disabled={!canWrite || activeMessageId === message.id} onClick={() => handleReportInclusion(message)}>
                    {message.includeInCustomerReport ? 'Remove from report' : 'Include in report'}
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </WorkspaceSection>
  );
}
