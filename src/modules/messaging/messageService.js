export const smsDisabledMessage = 'SMS is disabled for this trial build. Email is active.';
export const smsEnabled = import.meta.env.VITE_SMS_ENABLED === 'true';

export async function sendCustomerChannelMessage(onSendMessage, channel, templateKey, subject, body) {
  const result = await onSendMessage({
    channel,
    templateKey,
    subject,
    body
  });

  if (!result.ok) {
    return result.error || `${channel.toUpperCase()} failed to send.`;
  }

  return '';
}
