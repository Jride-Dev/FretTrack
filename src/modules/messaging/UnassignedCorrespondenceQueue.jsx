import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatShopDateTime } from '../../shared/utils/dateFormat';
import WorkspaceSection from '../../shared/components/WorkspaceSection.jsx';
import { listCustomerCorrespondence, markCustomerMessageRead } from './customerCorrespondenceRepository.js';

export default function UnassignedCorrespondenceQueue({ customers = [], shopId = '', canWrite = false, dateOptions = {}, onNotice }) {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeMessageId, setActiveMessageId] = useState('');

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
              </div>
            </article>
          ))}
        </div>
      )}
    </WorkspaceSection>
  );
}
