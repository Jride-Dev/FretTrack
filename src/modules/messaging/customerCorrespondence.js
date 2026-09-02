export const CORRESPONDENCE_CHANNELS = Object.freeze({
  EMAIL: 'email',
  SMS: 'sms'
});

export const CORRESPONDENCE_DIRECTIONS = Object.freeze({
  INBOUND: 'inbound',
  OUTBOUND: 'outbound'
});

export const CORRESPONDENCE_THREAD_STATUSES = Object.freeze({
  ACTIVE: 'active',
  ARCHIVED: 'archived'
});

const supportedStatuses = new Set([
  'pending',
  'sent',
  'delivered',
  'received',
  'failed',
  'scheduled',
  'canceling',
  'canceled'
]);

export function normalizeCorrespondenceMessage(message = {}) {
  const direction = message.direction || message.message_direction;
  const channel = message.channel === CORRESPONDENCE_CHANNELS.SMS
    ? CORRESPONDENCE_CHANNELS.SMS
    : CORRESPONDENCE_CHANNELS.EMAIL;

  return {
    id: message.id || crypto.randomUUID(),
    threadId: message.threadId || message.thread_id || '',
    shopId: message.shopId || message.shop_id || '',
    jobId: message.jobId || message.job_id || '',
    customerId: message.customerId || message.customer_id || '',
    channel,
    direction: direction === CORRESPONDENCE_DIRECTIONS.INBOUND
      ? CORRESPONDENCE_DIRECTIONS.INBOUND
      : CORRESPONDENCE_DIRECTIONS.OUTBOUND,
    sender: message.sender || message.sender_address || '',
    recipient: message.recipient || '',
    subject: message.subject || '',
    body: message.body || '',
    templateKey: message.templateKey || message.template_key || '',
    status: supportedStatuses.has(message.status) ? message.status : 'failed',
    provider: message.provider || '',
    providerMessageId: message.providerMessageId || message.provider_message_id || '',
    requestId: message.requestId || message.request_id || '',
    errorMessage: message.errorMessage || message.error_message || '',
    scheduledAt: message.scheduledAt || message.scheduled_at || '',
    canceledAt: message.canceledAt || message.canceled_at || '',
    cancelRequestedAt: message.cancelRequestedAt || message.cancel_requested_at || '',
    providerLastEvent: message.providerLastEvent || message.provider_last_event || '',
    providerEventAt: message.providerEventAt || message.provider_event_at || '',
    receivedAt: message.receivedAt || message.received_at || '',
    sentAt: message.sentAt || message.sent_at || '',
    readAt: message.readAt || message.read_at || '',
    includeInCustomerReport: Boolean(message.includeInCustomerReport ?? message.include_in_customer_report),
    createdAt: message.createdAt || message.created_at || new Date().toISOString()
  };
}

export function fromDbCorrespondenceMessage(message = {}) {
  return normalizeCorrespondenceMessage(message);
}

export function normalizeCorrespondenceThread(thread = {}) {
  return {
    id: thread.id || '',
    shopId: thread.shopId || thread.shop_id || '',
    customerId: thread.customerId || thread.customer_id || '',
    channel: thread.channel === CORRESPONDENCE_CHANNELS.SMS
      ? CORRESPONDENCE_CHANNELS.SMS
      : CORRESPONDENCE_CHANNELS.EMAIL,
    contactAddress: thread.contactAddress || thread.contact_address || '',
    status: thread.status === CORRESPONDENCE_THREAD_STATUSES.ARCHIVED
      ? CORRESPONDENCE_THREAD_STATUSES.ARCHIVED
      : CORRESPONDENCE_THREAD_STATUSES.ACTIVE,
    createdAt: thread.createdAt || thread.created_at || '',
    updatedAt: thread.updatedAt || thread.updated_at || ''
  };
}

export function sortCorrespondence(messages = [], direction = 'desc') {
  const multiplier = direction === 'asc' ? 1 : -1;
  return messages
    .map(normalizeCorrespondenceMessage)
    .sort((left, right) => multiplier * (messageTime(left) - messageTime(right)));
}

export function isCustomerReportEligible(message) {
  const normalized = normalizeCorrespondenceMessage(message);
  if (!normalized.body.trim()) return false;

  if (normalized.direction === CORRESPONDENCE_DIRECTIONS.INBOUND) {
    return ['received', 'delivered', 'sent'].includes(normalized.status);
  }

  return ['sent', 'delivered'].includes(normalized.status);
}

export function getSelectedCustomerReportCorrespondence(messages = []) {
  return sortCorrespondence(messages, 'asc').filter((message) => (
    message.includeInCustomerReport && isCustomerReportEligible(message)
  ));
}

function messageTime(message) {
  const value = message.receivedAt || message.sentAt || message.createdAt;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}
