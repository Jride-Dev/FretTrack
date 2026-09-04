import { createClient } from 'npm:@supabase/supabase-js@2';
import { buildProviderReconciliationPatch } from './providerReconciliation.ts';
import {
  buildScheduledOperationKey,
  emailOperationReplayResponse,
  normalizeRecipients,
  normalizeRequestId,
  normalizeScheduledAt,
  requiredFields,
  validateFunctionKey
} from './requestHelpers.ts';

type SupabaseAnyClient = ReturnType<typeof createClient<any, 'public', any>>;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-frettrack-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const EMAIL_RATE_LIMIT_PER_HOUR = 50;
const EMAIL_OPERATION_LEASE_MS = 2 * 60 * 1000;

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Temporary shop-level protection until proper user authentication is added.
  const authError = validateFunctionKey(request, json);
  if (authError) {
    return authError;
  }

  const payload = await request.json().catch(() => ({}));
  const jobId = payload.job_id || payload.jobId || payload.job?.id || '';
  const action = String(payload.action || 'send').trim().toLowerCase();

  if (action === 'cancel_scheduled') {
    return await cancelScheduledEmail(request, jobId, payload.message_id || payload.messageId || '');
  }
  if (action === 'reconcile_scheduled') {
    return await reconcileScheduledEmails(request, jobId);
  }

  const customerId = payload.customer_id || payload.customerId || null;
  const toRecipients = normalizeRecipients(payload.to || payload.message?.recipient || payload.job?.email || '');
  const ccRecipients = normalizeRecipients(payload.cc || payload.message?.cc || []);
  const bccRecipients = normalizeRecipients(payload.bcc || payload.message?.bcc || []);
  const recipientCount = toRecipients.length + ccRecipients.length + bccRecipients.length;
  const to = toRecipients.join(', ');
  const subject = payload.subject || payload.message?.subject || '';
  const body = payload.body || payload.message?.body || '';
  const html = typeof payload.html === 'string' ? payload.html : '';
  const templateKey = String(payload.template_key || payload.templateKey || '').trim();
  const scheduledAtResult = normalizeScheduledAt(payload.scheduled_at || payload.scheduledAt || '');

  if (scheduledAtResult.error) {
    return json({ success: false, error: scheduledAtResult.error }, 400);
  }
  const scheduledAt = scheduledAtResult.value;

  const missing = requiredFields({ job_id: jobId, to, subject, body });
  if (missing.length) {
    return json({ success: false, error: `Missing required field(s): ${missing.join(', ')}` });
  }

  const access = await resolveEmailProviderAccess(request, jobId, {
    scheduled: Boolean(scheduledAt)
  });
  if (access.error) {
    return access.error;
  }

  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  const fromEmail = Deno.env.get('SHOP_EMAIL_FROM');

  if (!resendApiKey || !fromEmail) {
    const message = await logMessage({
      jobId,
      customerId,
      channel: 'email',
      recipient: to,
      subject,
      body,
      templateKey,
      status: 'failed',
      provider: 'resend',
      errorMessage: 'Resend is not configured.'
    });
    return json({ success: false, error: 'Resend is not configured.', message });
  }

  const requestId = normalizeRequestId(payload.request_id || payload.requestId);
  if (!requestId) {
    return json({ success: false, error: 'A valid email request ID is required.' }, 400);
  }
  const operationKey = scheduledAt
    ? await buildScheduledOperationKey({ jobId, toRecipients, ccRecipients, bccRecipients, subject, body, html, templateKey, scheduledAt })
    : '';
  let claimedMessage: Record<string, any> | null = null;
  let quotaRequestId = '';
  let quotaReserved = false;
  let quotaSettled = false;
  let providerAttempted = false;
  let providerAccepted = false;

  try {
    const rateLimit = await checkRateLimit('email', EMAIL_RATE_LIMIT_PER_HOUR);
    if (!rateLimit.allowed) {
      const errorMessage = `Email rate limit reached. Max ${EMAIL_RATE_LIMIT_PER_HOUR} emails per hour.`;
      const message = await logMessage({
        jobId,
        customerId,
        channel: 'email',
        recipient: to,
        subject,
        body,
        templateKey,
        status: 'failed',
        provider: 'resend',
        errorMessage
      });
      return json({ success: false, error: errorMessage, message });
    }

    const claim = await claimEmailOperation({
      requestId,
      operationKey,
      jobId,
      customerId,
      recipient: to,
      subject,
      body,
      templateKey,
      scheduledAt
    });
    const operationMessage = claim.message;
    claimedMessage = operationMessage;
    if (!claim.claimed) {
      if (claim.conflict) {
        return json({
          success: false,
          code: 'EMAIL_REQUEST_ID_REUSED',
          error: 'This request ID already belongs to a different email payload.',
          message: operationMessage
        }, 409);
      }
      return emailOperationReplayResponse(operationMessage, json);
    }

    const quota = await prepareEmailRecipientQuota(access.shopId, operationMessage, recipientCount);
    quotaRequestId = quota.requestId || '';
    quotaReserved = quota.reserved === true;
    quotaSettled = quota.settled === true;
    if (!quota.allowed) {
      const failedMessage = await finalizeEmailMessage(operationMessage.id, {
        status: 'failed',
        error_message: 'Monthly email limit reached.',
        processing_started_at: null
      });
      return json({
        success: false,
        code: quota.code || 'EMAIL_MONTHLY_LIMIT_REACHED',
        error: 'Monthly email limit reached. Existing records and generated documents remain available, but new emails cannot be sent until the quota resets or the plan changes.',
        limit: quota.limit,
        used: quota.used,
        remaining: quota.remaining,
        resetDate: quota.resetDate,
        message: failedMessage || operationMessage
      }, 429);
    }

    const finalAccess = await resolveEmailProviderAccess(request, jobId, {
      scheduled: Boolean(scheduledAt),
      expectedShopId: access.shopId
    });
    if (finalAccess.error && !quotaSettled) {
      if (quotaReserved && !quotaSettled) {
        const quotaRelease = await releaseEmailRecipientQuota(access.shopId, quotaRequestId);
        quotaReserved = quotaRelease.released !== true;
        if (quotaReserved) {
          throw new Error('Email access changed, but the quota reservation could not be released.');
        }
      }
      await finalizeEmailMessage(operationMessage.id, {
        status: 'failed',
        error_message: 'Email access changed before the provider request.',
        processing_started_at: null
      });
      return finalAccess.error;
    }

    const replyTo = await resolveInboundReplyTo(access.shopId);
    providerAttempted = true;
    let response: Response;
    try {
      response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': `frettrack-email/${operationMessage.request_id}`
        },
        body: JSON.stringify({
          from: fromEmail,
          to: toRecipients,
          ...(ccRecipients.length ? { cc: ccRecipients } : {}),
          ...(bccRecipients.length ? { bcc: bccRecipients } : {}),
          reply_to: replyTo,
          subject,
          text: body,
          ...(html ? { html } : {}),
          ...(scheduledAt ? { scheduled_at: scheduledAt } : {})
        })
      });
    } catch (error) {
      return json({
        success: false,
        code: 'EMAIL_PROVIDER_CONFIRMATION_PENDING',
        error: 'The provider request may have been accepted, but confirmation timed out. Do not create a new message; retry this same operation.',
        detail: error instanceof Error ? error.message : 'Unknown provider transport error.',
        message: operationMessage
      }, 503);
    }

    const providerResponse = await response.json().catch(() => ({}));

    if (!response.ok) {
      if (quotaReserved && !quotaSettled) {
        await releaseEmailRecipientQuota(access.shopId, quotaRequestId);
        quotaReserved = false;
      }
      const errorMessage = providerResponse.message || providerResponse.error || 'Resend send failed.';
      const message = await finalizeEmailMessage(operationMessage.id, {
        status: 'failed',
        error_message: errorMessage,
        provider_last_event: 'failed',
        provider_event_at: new Date().toISOString(),
        processing_started_at: null
      });
      return json({ success: false, code: 'PROVIDER_REJECTED', error: errorMessage, providerResponse, message: message || operationMessage }, 502);
    }

    if (!providerResponse.id) {
      return json({
        success: false,
        code: 'EMAIL_PROVIDER_CONFIRMATION_PENDING',
        error: 'The provider accepted the request without a usable message ID. Do not create a new message; retry this same operation.',
        message: operationMessage
      }, 503);
    }

    providerAccepted = true;
    const quotaSettlement = quotaSettled
      ? { settled: true, idempotent: true }
      : await settleEmailRecipientQuota(access.shopId, quotaRequestId);
    quotaSettled = quotaSettlement.settled === true;
    const providerMessageId = providerResponse.id || operationMessage.provider_message_id || '';
    const message = await finalizeEmailMessage(operationMessage.id, {
      status: scheduledAt ? 'scheduled' : 'sent',
      provider_message_id: providerMessageId,
      provider_last_event: scheduledAt ? 'scheduled' : 'sent',
      provider_event_at: new Date().toISOString(),
      sent_at: scheduledAt ? null : new Date().toISOString(),
      error_message: '',
      processing_started_at: null
    });

    if (!message) {
      return json({
        success: false,
        code: 'EMAIL_HISTORY_RECONCILIATION_REQUIRED',
        error: 'The provider accepted the email, but Message History is still awaiting reconciliation. Do not submit a new message; retry this same operation.',
        id: providerMessageId,
        provider: 'resend',
        scheduled: Boolean(scheduledAt),
        message: operationMessage
      }, 503);
    }

    return json({
      success: true,
      id: providerMessageId,
      provider: 'resend',
      scheduled: Boolean(scheduledAt),
      message,
      usage: {
        recipientCount,
        settled: quotaSettlement.settled === true
      }
    });
  } catch (error) {
    const releasableQuotaRequestId = quotaRequestId || claimedMessage?.quota_request_id || '';
    if (releasableQuotaRequestId && !quotaSettled && !providerAttempted) {
      await releaseEmailRecipientQuota(access.shopId, releasableQuotaRequestId);
    }
    const errorMessage = error instanceof Error ? error.message : 'Unknown email send error.';
    const message = claimedMessage && !providerAttempted
      ? await finalizeEmailMessage(claimedMessage.id, {
        status: 'failed',
        error_message: errorMessage,
        processing_started_at: null
      })
      : claimedMessage;
    return json({
      success: false,
      code: providerAccepted ? 'EMAIL_HISTORY_RECONCILIATION_REQUIRED' : providerAttempted ? 'EMAIL_PROVIDER_CONFIRMATION_PENDING' : 'EMAIL_SEND_FAILED',
      error: providerAccepted
        ? 'The provider accepted the email, but Message History is still awaiting reconciliation. Do not submit a new message; retry this same operation.'
        : providerAttempted
          ? 'The provider request may have been accepted, but confirmation failed. Do not create a new message; retry this same operation.'
          : errorMessage,
      message
    }, 503);
  }
});

async function claimEmailOperation(message: {
  requestId: string;
  operationKey: string;
  jobId: string;
  customerId?: string | null;
  recipient: string;
  subject: string;
  body: string;
  templateKey: string;
  scheduledAt: string;
}) {
  const supabase = createServiceClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('customer_messages')
    .insert({
      job_id: message.jobId,
      customer_id: message.customerId || null,
      channel: 'email',
      recipient: message.recipient,
      subject: message.subject || null,
      body: message.body,
      template_key: message.templateKey || '',
      status: 'pending',
      provider: 'resend',
      provider_message_id: '',
      request_id: message.requestId,
      quota_request_id: message.requestId,
      operation_key: message.operationKey || null,
      processing_started_at: now,
      scheduled_at: message.scheduledAt || null,
      canceled_at: null,
      cancel_requested_at: null,
      sent_at: null,
      created_at: now
    })
    .select()
    .single();

  if (!error && data) {
    return { claimed: true, message: data };
  }
  if (error?.code !== '23505') {
    throw new Error(`Email history claim failed: ${error?.message || 'Unknown database error.'}`);
  }

  let existingResult = await supabase
    .from('customer_messages')
    .select('*')
    .eq('request_id', message.requestId)
    .maybeSingle();
  if (!existingResult.data && message.operationKey) {
    existingResult = await supabase
      .from('customer_messages')
      .select('*')
      .eq('job_id', message.jobId)
      .eq('operation_key', message.operationKey)
      .in('status', ['pending', 'scheduled', 'canceling', 'sent'])
      .maybeSingle();
  }
  if (existingResult.error || !existingResult.data) {
    throw new Error(`Email history replay lookup failed: ${existingResult.error?.message || 'Claimed operation was not found.'}`);
  }

  const existing = existingResult.data;
  const existingScheduledAt = existing.scheduled_at ? new Date(existing.scheduled_at).getTime() : 0;
  const requestedScheduledAt = message.scheduledAt ? new Date(message.scheduledAt).getTime() : 0;
  const requestPayloadChanged = existing.request_id === message.requestId && (
    String(existing.operation_key || '') !== String(message.operationKey || '')
    || String(existing.recipient || '') !== message.recipient
    || String(existing.subject || '') !== message.subject
    || String(existing.body || '') !== message.body
    || String(existing.template_key || '') !== message.templateKey
    || existingScheduledAt !== requestedScheduledAt
  );
  if (requestPayloadChanged) {
    return { claimed: false, conflict: true, message: existing };
  }
  const leaseExpired = existing.status === 'pending'
    && new Date(existing.processing_started_at || 0).getTime() <= Date.now() - EMAIL_OPERATION_LEASE_MS;
  if (leaseExpired) {
    const leaseCutoff = new Date(Date.now() - EMAIL_OPERATION_LEASE_MS).toISOString();
    const { data: reclaimed, error: reclaimError } = await supabase
      .from('customer_messages')
      .update({ processing_started_at: now })
      .eq('id', existing.id)
      .eq('status', 'pending')
      .lt('processing_started_at', leaseCutoff)
      .select()
      .maybeSingle();
    if (reclaimError) {
      throw new Error(`Email history replay claim failed: ${reclaimError.message}`);
    }
    if (reclaimed) {
      return { claimed: true, message: reclaimed };
    }
  }

  return { claimed: false, conflict: false, message: existing };
}

async function prepareEmailRecipientQuota(shopId: string, message: Record<string, any>, recipientCount: number) {
  const supabase = createServiceClient();
  let quotaRequestId = message.quota_request_id || message.request_id;
  const { data: existing, error: existingError } = await supabase
    .from('shop_usage_reservations')
    .select('status, expires_at')
    .eq('shop_id', shopId)
    .eq('request_id', quotaRequestId)
    .maybeSingle();
  if (existingError) {
    throw new Error(`Email quota lookup failed: ${existingError.message}`);
  }

  if (existing?.status === 'settled') {
    return { allowed: true, requestId: quotaRequestId, reserved: false, settled: true, idempotent: true };
  }
  if (existing?.status === 'reserved' && new Date(existing.expires_at || 0).getTime() > Date.now()) {
    return { allowed: true, requestId: quotaRequestId, reserved: true, settled: false, idempotent: true };
  }
  if (existing) {
    quotaRequestId = crypto.randomUUID();
    const { error: updateError } = await supabase
      .from('customer_messages')
      .update({ quota_request_id: quotaRequestId })
      .eq('id', message.id)
      .eq('status', 'pending');
    if (updateError) {
      throw new Error(`Email quota retry setup failed: ${updateError.message}`);
    }
    message.quota_request_id = quotaRequestId;
  }

  const quota = await reserveEmailRecipientQuota(shopId, quotaRequestId, recipientCount);
  return {
    ...quota,
    requestId: quotaRequestId,
    reserved: quota.allowed === true && quota.status !== 'settled',
    settled: quota.status === 'settled'
  };
}

async function finalizeEmailMessage(messageId: string, patch: Record<string, unknown>) {
  const supabase = createServiceClient();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data, error } = await supabase
      .from('customer_messages')
      .update(patch)
      .eq('id', messageId)
      .select()
      .maybeSingle();
    if (!error && data) {
      return data;
    }
    console.error('customer_messages email state update failed', { attempt: attempt + 1, error });
  }
  return null;
}

async function finalizeProviderReconciliation(
  messageId: string,
  patch: Record<string, unknown>
): Promise<Record<string, any> | null> {
  const supabase = createServiceClient();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data, error } = await supabase
      .rpc('reconcile_customer_email_provider_state', {
        p_message_id: messageId,
        p_status: typeof patch.status === 'string' ? patch.status : null,
        p_provider_last_event: typeof patch.provider_last_event === 'string' ? patch.provider_last_event : '',
        p_provider_event_at: typeof patch.provider_event_at === 'string' ? patch.provider_event_at : null,
        p_sent_at: typeof patch.sent_at === 'string' ? patch.sent_at : null,
        p_canceled_at: typeof patch.canceled_at === 'string' ? patch.canceled_at : null,
        p_error_message: typeof patch.error_message === 'string' ? patch.error_message : null
      })
      .maybeSingle();
    if (!error && data) {
      return data as Record<string, any>;
    }
    console.error('customer_messages provider reconciliation failed', { attempt: attempt + 1, error });
  }
  return null;
}

async function logMessage(message: {
  jobId: string;
  customerId?: string | null;
  channel: 'email';
  recipient: string;
  subject?: string;
  body: string;
  templateKey?: string;
  status: 'sent' | 'failed' | 'scheduled';
  provider: 'resend';
  providerMessageId?: string;
  errorMessage?: string;
  scheduledAt?: string;
  sentAt?: string;
}) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('customer_messages')
    .insert({
      job_id: message.jobId,
      customer_id: message.customerId,
      channel: message.channel,
      recipient: message.recipient,
      subject: message.subject || null,
      body: message.body,
      template_key: message.templateKey || '',
      status: message.status,
      provider: message.provider,
      provider_message_id: message.providerMessageId || '',
      error_message: message.errorMessage || '',
      scheduled_at: message.scheduledAt || null,
      canceled_at: null,
      sent_at: message.sentAt || null,
      created_at: now
    })
    .select()
    .single();

  if (error) {
    console.error('customer_messages email log failed', error);
    return null;
  }

  return data;
}

async function resolveEmailProviderAccess(
  request: Request,
  jobId: string,
  options: { scheduled?: boolean; expectedShopId?: string } = {}
) {
  const access = await resolveJobWriteAccess(request, jobId);
  if (access.error) {
    return access;
  }

  if (options.expectedShopId && access.shopId !== options.expectedShopId) {
    return {
      ...access,
      error: json({ success: false, error: 'Work order shop access changed. Refresh and try again.' }, 409)
    };
  }

  if (options.scheduled) {
    if (!access.emailOptIn) {
      return {
        ...access,
        error: json({ success: false, error: 'Email opt-in is required before scheduling a customer email.' }, 400)
      };
    }
    if (!await shopHasEntitlement(createServiceClient(), access.shopId, 'scheduled_email')) {
      return {
        ...access,
        error: json({ success: false, error: 'Scheduled Email is available on Pro.' }, 403)
      };
    }
  }

  return access;
}

async function resolveInboundReplyTo(shopId: string) {
  const { data, error } = await createServiceClient()
    .from('customer_inbound_email_routes')
    .select('email_address')
    .eq('shop_id', shopId)
    .eq('active', true)
    .single();

  if (error) {
    throw new Error(`Inbound email reply route lookup failed: ${error.message}`);
  }

  const replyTo = String(data?.email_address || '').trim().toLowerCase();
  if (!replyTo) {
    throw new Error('This shop does not have an inbound email reply route.');
  }

  return replyTo;
}

async function resolveJobWriteAccess(request: Request, jobId: string) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const authorization = request.headers.get('Authorization') || '';
  const token = authorization.replace(/^Bearer\s+/i, '').trim();

  if (!supabaseUrl || !serviceRoleKey || !token) {
    return { error: json({ success: false, error: 'Authenticated shop access is required.' }, 401), shopId: '', emailOptIn: false };
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  const user = userData?.user;
  if (userError || !user) {
    return { error: json({ success: false, error: 'Authenticated shop access is required.' }, 401), shopId: '', emailOptIn: false };
  }

  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .select('id, shop_id, email_opt_in')
    .eq('id', jobId)
    .single();

  if (jobError || !job) {
    return { error: json({ success: false, error: 'Work order was not found.' }, 404), shopId: '', emailOptIn: false };
  }

  const { data: membership, error: membershipError } = await supabase
    .from('shop_members')
    .select('role')
    .eq('shop_id', job.shop_id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (membershipError || !['owner', 'admin', 'tech'].includes(membership?.role || '')) {
    return { error: json({ success: false, error: 'Your shop role cannot send customer messages.' }, 403), shopId: '', emailOptIn: false };
  }

  const membershipRole = String(membership?.role || '');
  const hasEffectiveAccess = await canUseShopWriteRole(supabase as SupabaseAnyClient, job.shop_id, membershipRole);
  if (!hasEffectiveAccess) {
    return { error: json({ success: false, error: 'Your shop role cannot send customer messages.' }, 403), shopId: '', emailOptIn: false };
  }

  return { error: null, shopId: job.shop_id, emailOptIn: job.email_opt_in === true };
}

async function cancelScheduledEmail(request: Request, jobId: string, messageId: string) {
  if (!jobId || !messageId) {
    return json({ success: false, error: 'Work order and scheduled message are required.' }, 400);
  }

  const access = await resolveJobWriteAccess(request, jobId);
  if (access.error) {
    return access.error;
  }

  const supabase = createServiceClient();
  const { data: message, error: messageError } = await supabase
    .from('customer_messages')
    .select('*')
    .eq('id', messageId)
    .eq('job_id', jobId)
    .eq('channel', 'email')
    .maybeSingle();

  if (messageError || !message) {
    return json({ success: false, error: 'Scheduled email was not found.' }, 404);
  }
  if (message.status === 'canceled') {
    return json({ success: true, canceled: true, message });
  }
  if (message.status === 'sent') {
    return json({ success: false, code: 'EMAIL_ALREADY_SENT', error: 'The provider has already sent this email.', message }, 409);
  }
  if (!['scheduled', 'canceling'].includes(message.status) || !message.provider_message_id || !message.scheduled_at) {
    return json({ success: false, error: 'This email is not awaiting scheduled delivery.' }, 409);
  }

  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  if (!resendApiKey) {
    return json({ success: false, error: 'Resend is not configured.' }, 503);
  }

  let cancelingMessage = message;
  if (message.status === 'scheduled') {
    const { data, error } = await supabase
      .from('customer_messages')
      .update({ status: 'canceling', cancel_requested_at: new Date().toISOString() })
      .eq('id', message.id)
      .eq('status', 'scheduled')
      .select()
      .maybeSingle();
    if (error || !data) {
      return json({ success: false, error: 'The cancellation could not be claimed safely. Refresh before retrying.' }, 409);
    }
    cancelingMessage = data;
  }

  const finalAccess = await resolveJobWriteAccess(request, jobId);
  if (finalAccess.error || finalAccess.shopId !== access.shopId) {
    await finalizeEmailMessage(cancelingMessage.id, {
      status: 'scheduled',
      cancel_requested_at: null
    });
    return finalAccess.error || json({ success: false, error: 'Work order shop access changed. Refresh and try again.' }, 409);
  }

  try {
    const response = await fetch(`https://api.resend.com/emails/${encodeURIComponent(cancelingMessage.provider_message_id)}/cancel`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json'
      }
    });
    const providerResponse = await response.json().catch(() => ({}));

    if (response.ok) {
      const providerEventAt = new Date().toISOString();
      const canceledMessage = await finalizeProviderReconciliation(cancelingMessage.id, buildProviderReconciliationPatch({
        messageStatus: cancelingMessage.status,
        lastEvent: 'canceled',
        scheduledAt: cancelingMessage.scheduled_at,
        providerEventAt
      }));
      if (canceledMessage?.status === 'sent') {
        return json({
          success: false,
          code: 'EMAIL_ALREADY_SENT',
          error: 'The provider sent this email before cancellation completed.',
          message: canceledMessage
        }, 409);
      }
      if (!canceledMessage) {
        return json({
          success: false,
          code: 'EMAIL_CANCELLATION_INDETERMINATE',
          error: 'The provider accepted the cancellation, but Message History is still awaiting confirmation. Retry cancellation to reconcile it.',
          message: cancelingMessage
        }, 503);
      }
      return json({ success: true, canceled: true, message: canceledMessage });
    }

    const reconciled = await reconcileMessageWithProvider(cancelingMessage, resendApiKey);
    if (reconciled.status === 'canceled') {
      return json({ success: true, canceled: true, idempotent: true, message: reconciled });
    }
    if (reconciled.status === 'sent') {
      return json({ success: false, code: 'EMAIL_ALREADY_SENT', error: 'The provider sent this email before cancellation completed.', message: reconciled }, 409);
    }
    if (reconciled.status === 'failed') {
      return json({ success: false, code: 'EMAIL_PROVIDER_FAILED', error: reconciled.error_message || 'The provider reports that this email failed.', message: reconciled }, 409);
    }

    return json({
      success: false,
      code: 'EMAIL_CANCELLATION_INDETERMINATE',
      error: providerResponse.message || providerResponse.error || 'Cancellation is awaiting provider confirmation. Retry this cancellation instead of scheduling another email.',
      message: reconciled
    }, response.status >= 400 && response.status < 500 ? response.status : 502);
  } catch (error) {
    return json({
      success: false,
      code: 'EMAIL_CANCELLATION_INDETERMINATE',
      error: 'Cancellation may have reached the provider, but confirmation timed out. Retry this cancellation to reconcile it.',
      detail: error instanceof Error ? error.message : 'Unknown provider error.',
      message: cancelingMessage
    }, 503);
  }
}

async function reconcileScheduledEmails(request: Request, jobId: string) {
  if (!jobId) {
    return json({ success: false, error: 'Work order is required for email reconciliation.' }, 400);
  }
  const access = await resolveJobWriteAccess(request, jobId);
  if (access.error) {
    return access.error;
  }
  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  if (!resendApiKey) {
    return json({ success: false, error: 'Resend is not configured.' }, 503);
  }

  const supabase = createServiceClient();
  const { data: messages, error } = await supabase
    .from('customer_messages')
    .select('*')
    .eq('job_id', jobId)
    .eq('channel', 'email')
    .in('status', ['scheduled', 'canceling'])
    .order('scheduled_at', { ascending: true })
    .limit(50);
  if (error) {
    return json({ success: false, error: `Scheduled email reconciliation failed: ${error.message}` }, 500);
  }

  const reconciled = [];
  for (const message of messages || []) {
    reconciled.push(await reconcileMessageWithProvider(message, resendApiKey));
  }
  return json({ success: true, reconciled: reconciled.length, messages: reconciled });
}

async function reconcileMessageWithProvider(message: Record<string, any>, resendApiKey: string) {
  if (!message.provider_message_id) {
    return message;
  }
  const provider = await retrieveResendEmail(message.provider_message_id, resendApiKey);
  if (!provider.ok) {
    return message;
  }

  const providerEventAt = new Date().toISOString();
  const patch = buildProviderReconciliationPatch({
    messageStatus: message.status,
    lastEvent: provider.data.last_event,
    scheduledAt: provider.data.scheduled_at,
    providerEventAt
  });

  return await finalizeProviderReconciliation(message.id, patch) || message;
}

async function retrieveResendEmail(providerMessageId: string, resendApiKey: string) {
  try {
    const response = await fetch(`https://api.resend.com/emails/${encodeURIComponent(providerMessageId)}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json'
      }
    });
    const data = await response.json().catch(() => ({}));
    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    console.error('Resend email reconciliation failed', error);
    return { ok: false, status: 0, data: {} };
  }
}

async function reserveEmailRecipientQuota(shopId: string, requestId: string, recipientCount: number) {
  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc('reserve_shop_usage', {
    target_shop_id: shopId,
    target_request_id: requestId,
    target_usage_kind: 'email_recipients',
    requested_units: recipientCount,
    expected_storage_bytes: 0,
    target_bucket: null,
    target_path: null
  });
  if (error) {
    throw new Error(`Email quota reservation failed: ${error.message}`);
  }
  return data || { allowed: false, code: 'EMAIL_MONTHLY_LIMIT_REACHED' };
}

async function settleEmailRecipientQuota(shopId: string, requestId: string) {
  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc('settle_shop_usage_reservation', {
    target_shop_id: shopId,
    target_request_id: requestId
  });
  if (error) {
    console.error('email quota settlement failed', error);
    return { settled: false };
  }
  return data || { settled: false };
}

async function releaseEmailRecipientQuota(shopId: string, requestId: string) {
  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc('release_shop_usage_reservation', {
    target_shop_id: shopId,
    target_request_id: requestId
  });
  if (error) {
    console.error('email quota release failed', error);
    return { released: false };
  }
  return data || { released: false };
}

function createServiceClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase service configuration is unavailable.');
  }
  return createClient(supabaseUrl, serviceRoleKey);
}

async function canUseShopWriteRole(supabase: SupabaseAnyClient, shopId: string, role: string) {
  if (role === 'owner') {
    return await shopLifecycleAllowsWrite(supabase, shopId);
  }

  if (!['admin', 'tech'].includes(role)) {
    return false;
  }

  const lifecycleAllowsWrite = await shopLifecycleAllowsWrite(supabase, shopId);
  if (!lifecycleAllowsWrite) {
    return false;
  }

  return await shopHasTeamMembers(supabase, shopId);
}

async function shopLifecycleAllowsWrite(supabase: SupabaseAnyClient, shopId: string) {
  const { profile, subscription } = await loadShopAccessState(supabase, shopId);
  const status = subscription?.status || profile?.subscription_status || 'active';
  const trialEndsAt = subscription?.trial_ends_at || profile?.trial_ends_at || '';
  const trialExpired = status === 'expired' || (
    status === 'trialing'
    && trialEndsAt
    && new Date(trialEndsAt).getTime() < Date.now()
  );

  if (trialExpired) {
    return false;
  }

  return !['read_only', 'canceled', 'cancelled'].includes(status);
}

async function shopHasTeamMembers(supabase: SupabaseAnyClient, shopId: string) {
  return await shopHasEntitlement(supabase, shopId, 'team_members');
}

async function shopHasEntitlement(supabase: SupabaseAnyClient, shopId: string, key: string) {
  const { profile, subscription } = await loadShopAccessState(supabase, shopId);
  const status = subscription?.status || profile?.subscription_status || 'active';
  const trialEndsAt = subscription?.trial_ends_at || profile?.trial_ends_at || '';
  const trialExpired = status === 'expired' || (
    status === 'trialing'
    && trialEndsAt
    && new Date(trialEndsAt).getTime() < Date.now()
  );
  const planId = trialExpired ? 'free' : subscription?.plan_id || profile?.subscription_tier || 'free';

  const { data: entitlement } = await supabase
    .from('plan_entitlements')
    .select('value')
    .eq('plan_id', planId)
    .eq('key', key)
    .maybeSingle();

  if (trialExpired) {
    return Boolean(entitlement?.value);
  }

  const profileOverride = profile?.feature_overrides?.[key];
  const { data: override } = await supabase
    .from('shop_entitlement_overrides')
    .select('value')
    .eq('shop_id', shopId)
    .eq('key', key)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .maybeSingle();

  return Boolean(override?.value ?? profileOverride ?? entitlement?.value);
}

async function loadShopAccessState(supabase: SupabaseAnyClient, shopId: string) {
  const [{ data: profile }, { data: subscription }] = await Promise.all([
    supabase
      .from('shop_profiles')
      .select('subscription_tier, subscription_status, trial_ends_at, feature_overrides')
      .eq('shop_id', shopId)
      .maybeSingle(),
    supabase
      .from('shop_subscriptions')
      .select('plan_id, status, trial_ends_at')
      .eq('shop_id', shopId)
      .maybeSingle()
  ]);

  return { profile, subscription };
}

async function checkRateLimit(channel: 'email', maxPerHour: number) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    return { allowed: false, count: 0 };
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from('customer_messages')
    .select('id', { count: 'exact', head: true })
    .eq('channel', channel)
    .gte('created_at', oneHourAgo);

  if (error) {
    console.error('email rate limit check failed', error);
    return { allowed: false, count: 0 };
  }

  return { allowed: Number(count || 0) < maxPerHour, count: Number(count || 0) };
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json'
    }
  });
}
