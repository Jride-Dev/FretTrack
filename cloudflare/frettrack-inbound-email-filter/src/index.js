import { getBlockedSenderReason, normalizeEmailAddress } from './denylist.js';

const RECIPIENT_FORWARDING_VARIABLES = {
  'support@frettrack-app.com': 'SUPPORT_FORWARD_TO',
  'noreply@frettrack-app.com': 'NOREPLY_FORWARD_TO',
  'jeff@frettrack-app.com': 'JEFF_FORWARD_TO'
};

const GENERIC_REJECTION = 'Message rejected by recipient policy.';

function getForwardDestinations(value) {
  if (typeof value !== 'string') return [];

  return [...new Set(value
    .split(',')
    .map(normalizeEmailAddress)
    .filter((address) => address.includes('@')))];
}

function logRejectedMessage(message, visibleFrom, reason) {
  console.warn(JSON.stringify({
    event: 'email_rejected',
    sender: normalizeEmailAddress(message.from),
    visibleFrom: visibleFrom || null,
    recipient: normalizeEmailAddress(message.to),
    rejectionReason: reason,
    timestamp: new Date().toISOString()
  }));
}

function logForwardFailure(message, error) {
  console.error(JSON.stringify({
    event: 'email_forward_failed',
    sender: normalizeEmailAddress(message.from),
    recipient: normalizeEmailAddress(message.to),
    error: error instanceof Error ? error.message : String(error),
    timestamp: new Date().toISOString()
  }));
}

export default {
  async email(message, env) {
    const visibleFrom = message.headers.get('from') || '';
    const rejectionReason = getBlockedSenderReason({
      envelopeSender: message.from,
      visibleFrom
    });

    if (rejectionReason) {
      logRejectedMessage(message, visibleFrom, rejectionReason);
      message.setReject(GENERIC_REJECTION);
      return;
    }

    const recipient = normalizeEmailAddress(message.to);
    const destinationVariable = RECIPIENT_FORWARDING_VARIABLES[recipient];
    const destinations = getForwardDestinations(destinationVariable ? env[destinationVariable] : '');

    if (destinations.length === 0) {
      const reason = destinationVariable
        ? `no forwarding destination configured for ${recipient}`
        : `recipient route is not configured for ${recipient}`;
      logRejectedMessage(message, visibleFrom, reason);
      message.setReject(GENERIC_REJECTION);
      return;
    }

    try {
      await Promise.all(destinations.map((destination) => message.forward(destination)));
    } catch (error) {
      logForwardFailure(message, error);
      message.setReject('Message could not be forwarded at this time.');
    }
  }
};
