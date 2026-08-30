import { supabase, hasSupabaseConfig } from '../../shared/lib/supabaseClient';
import {
  fromDbCorrespondenceMessage as fromDbCustomerMessage,
  normalizeCorrespondenceMessage as normalizeCustomerMessage
} from '../messaging/customerCorrespondence';
import { normalizeJob as normalizeJobFromModule } from './jobServiceNormalization.js';
import { ensureRemoteJob } from './jobServiceMutations.js';

const fretTrackFunctionKey = import.meta.env.VITE_FRETTRACK_FUNCTION_KEY || '';
export const smsEnabled = import.meta.env.VITE_SMS_ENABLED === 'true';

export async function sendCustomerMessage(job, message) {
  const normalizedJob = normalizeJobFromModule(job);
  const action = message.action || 'send';
  const channel = message.channel || 'email';
  const recipient = message.to || message.recipient || (channel === 'sms' ? normalizedJob.phone : normalizedJob.email);

  if (channel === 'sms' && !smsEnabled) {
    return { ok: false, error: 'SMS is disabled for this trial build. Email is active.' };
  }

  if (!hasSupabaseConfig || !supabase) {
    return { ok: false, error: 'Supabase is not configured. Messaging requires Edge Functions.' };
  }

  try {
    await ensureRemoteJob(normalizedJob);
  } catch (error) {
    console.error('Remote job repair before customer message failed.', error);
    return {
      ok: false,
      error: `Remote job save failed: ${error.message || 'Unable to create remote work order before sending.'}`
    };
  }

  const functionName = channel === 'sms' ? 'send-sms' : 'send-email';
  const { data, error } = await supabase.functions.invoke(functionName, {
    headers: functionHeaders(),
    body: {
      request_id: message.requestId || crypto.randomUUID(),
      action,
      job_id: normalizedJob.id,
      message_id: message.messageId || '',
      customer_id: message.customerId || null,
      to: recipient,
      cc: message.cc || [],
      bcc: message.bcc || [],
      subject: message.subject || '',
      body: message.body || '',
      html: message.html || '',
      template_key: message.templateKey || '',
      scheduled_at: message.scheduledAt || ''
    }
  });

  const functionErrorData = error ? await resolveFunctionErrorData(error) : null;
  if (error || data?.success === false || data?.error) {
    const errorData = data || functionErrorData || {};
    const errorMessage = errorData?.error || errorData?.msg || error?.message || 'Provider send failed.';
    const errorCode = errorData?.code || '';
    const errorType = error?.constructor?.name || error?.name || '';
    const retrySameRequest = ['EMAIL_OPERATION_IN_PROGRESS', 'EMAIL_PROVIDER_CONFIRMATION_PENDING', 'EMAIL_HISTORY_RECONCILIATION_REQUIRED', 'EMAIL_CANCELLATION_INDETERMINATE'].includes(errorCode)
      || ['FunctionsFetchError', 'FunctionsRelayError'].includes(errorType);
    console.error('Customer message send failed.', { error, data: errorData });
    return {
      ok: false,
      message: errorData?.message ? normalizeCustomerMessage(fromDbCustomerMessage(errorData.message)) : null,
      mode: errorData?.mode || '',
      code: errorCode,
      retrySameRequest,
      usage: errorData?.limit ? {
        limit: errorData.limit,
        used: errorData.used,
        remaining: errorData.remaining,
        resetDate: errorData.resetDate
      } : null,
      error: errorMessage
    };
  }

  return {
    ok: true,
    message: data?.message ? normalizeCustomerMessage(fromDbCustomerMessage(data.message)) : null,
    messages: Array.isArray(data?.messages)
      ? data.messages.map((messageItem) => normalizeCustomerMessage(fromDbCustomerMessage(messageItem)))
      : [],
    mode: data?.mode || '',
    providerMessageId: data?.id || data?.messageId || ''
  };
}

async function resolveFunctionErrorData(error) {
  const context = error?.context;
  if (!context || typeof context.json !== 'function') {
    return null;
  }

  try {
    return await context.clone().json();
  } catch {
    try {
      return await context.json();
    } catch {
      return null;
    }
  }
}

export async function getSmsMode() {
  if (!smsEnabled) {
    return 'disabled';
  }

  if (!hasSupabaseConfig || !supabase) {
    return 'not configured';
  }

  const { data, error } = await supabase.functions.invoke('send-sms', {
    headers: functionHeaders(),
    body: { action: 'status' }
  });

  if (error || data?.success === false) {
    console.error('SMS mode check failed.', { error, data });
    return 'error';
  }

  return data?.mode || 'test';
}

function functionHeaders() {
  // Temporary shop-level protection until proper user authentication is added.
  return {
    'x-frettrack-key': fretTrackFunctionKey
  };
}

