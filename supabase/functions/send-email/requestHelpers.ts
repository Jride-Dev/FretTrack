const MIN_SCHEDULE_LEAD_MS = 2 * 60 * 1000;
const MAX_SCHEDULE_LEAD_MS = 30 * 24 * 60 * 60 * 1000;

export function validateFunctionKey(request: Request, json: (body: Record<string, unknown>, status?: number) => Response) {
  const expectedKey = Deno.env.get('FRETTRACK_FUNCTION_KEY') || '';
  const receivedKey = request.headers.get('x-frettrack-key') || '';

  if (!expectedKey || receivedKey !== expectedKey) {
    return json({ success: false, error: 'Unauthorized FretTrack function request.' }, 401);
  }

  return null;
}

export function requiredFields(fields: Record<string, string>) {
  return Object.entries(fields)
    .filter(([, value]) => !String(value || '').trim())
    .map(([key]) => key);
}

export function normalizeRecipients(value: unknown) {
  const values = Array.isArray(value) ? value : String(value || '').split(/[;,]/);
  return values.map((recipient) => String(recipient || '').trim()).filter(Boolean);
}

export function normalizeRequestId(value: unknown) {
  const candidate = String(value || '').trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(candidate)
    ? candidate
    : '';
}

export async function buildScheduledOperationKey(message: {
  jobId: string;
  toRecipients: string[];
  ccRecipients: string[];
  bccRecipients: string[];
  subject: string;
  body: string;
  html: string;
  templateKey: string;
  scheduledAt: string;
}) {
  const canonical = JSON.stringify({
    jobId: message.jobId,
    to: message.toRecipients.map((value) => value.toLowerCase()),
    cc: message.ccRecipients.map((value) => value.toLowerCase()),
    bcc: message.bccRecipients.map((value) => value.toLowerCase()),
    subject: message.subject,
    body: message.body,
    html: message.html,
    templateKey: message.templateKey,
    scheduledAt: message.scheduledAt
  });
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function emailOperationReplayResponse(message: Record<string, any>, json: (body: Record<string, unknown>, status?: number) => Response) {
  if (['scheduled', 'sent', 'canceled'].includes(message.status)) {
    return json({
      success: true,
      idempotent: true,
      id: message.provider_message_id || '',
      provider: message.provider || 'resend',
      scheduled: Boolean(message.scheduled_at),
      message
    });
  }

  if (message.status === 'failed') {
    return json({
      success: false,
      code: 'EMAIL_OPERATION_FAILED',
      error: message.error_message || 'The previous provider attempt failed. Submit again to start a new operation.',
      message
    }, 409);
  }

  return json({
    success: false,
    code: message.status === 'canceling' ? 'EMAIL_CANCELLATION_IN_PROGRESS' : 'EMAIL_OPERATION_IN_PROGRESS',
    error: message.status === 'canceling'
      ? 'Cancellation is awaiting provider confirmation. Retry the cancellation instead of scheduling another email.'
      : 'This email operation is already in progress. Retry the same operation after a short wait.',
    message
  }, 409);
}

export function normalizeScheduledAt(value: unknown) {
  const candidate = String(value || '').trim();
  if (!candidate) {
    return { value: '', error: '' };
  }

  const timestamp = new Date(candidate).getTime();
  if (!Number.isFinite(timestamp)) {
    return { value: '', error: 'Choose a valid date and time for the scheduled email.' };
  }

  const leadTime = timestamp - Date.now();
  if (leadTime < MIN_SCHEDULE_LEAD_MS) {
    return { value: '', error: 'Scheduled email time must be at least 2 minutes in the future.' };
  }
  if (leadTime > MAX_SCHEDULE_LEAD_MS) {
    return { value: '', error: 'Scheduled emails can be set up to 30 days ahead.' };
  }

  return { value: new Date(timestamp).toISOString(), error: '' };
}
