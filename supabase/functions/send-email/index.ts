import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-frettrack-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const EMAIL_RATE_LIMIT_PER_HOUR = 50;

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Temporary shop-level protection until proper user authentication is added.
  const authError = validateFunctionKey(request);
  if (authError) {
    return authError;
  }

  const payload = await request.json().catch(() => ({}));
  const jobId = payload.job_id || payload.jobId || payload.job?.id || '';
  const customerId = payload.customer_id || payload.customerId || null;
  const toRecipients = normalizeRecipients(payload.to || payload.message?.recipient || payload.job?.email || '');
  const ccRecipients = normalizeRecipients(payload.cc || payload.message?.cc || []);
  const bccRecipients = normalizeRecipients(payload.bcc || payload.message?.bcc || []);
  const recipientCount = toRecipients.length + ccRecipients.length + bccRecipients.length;
  const to = toRecipients.join(', ');
  const subject = payload.subject || payload.message?.subject || '';
  const body = payload.body || payload.message?.body || '';
  const html = typeof payload.html === 'string' ? payload.html : '';

  const missing = requiredFields({ job_id: jobId, to, subject, body });
  if (missing.length) {
    return json({ success: false, error: `Missing required field(s): ${missing.join(', ')}` });
  }

  const access = await resolveJobWriteAccess(request, jobId);
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
      status: 'failed',
      provider: 'resend',
      errorMessage: 'Resend is not configured.'
    });
    return json({ success: false, error: 'Resend is not configured.', message });
  }

  const quotaRequestId = normalizeRequestId(payload.request_id || payload.requestId);
  let quotaReserved = false;
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
        status: 'failed',
        provider: 'resend',
        errorMessage
      });
      return json({ success: false, error: errorMessage, message });
    }

    const quota = await reserveEmailRecipientQuota(access.shopId, quotaRequestId, recipientCount);
    if (!quota.allowed) {
      return json({
        success: false,
        code: quota.code || 'EMAIL_MONTHLY_LIMIT_REACHED',
        error: 'Monthly email limit reached. Existing records and generated documents remain available, but new emails cannot be sent until the quota resets or the plan changes.',
        limit: quota.limit,
        used: quota.used,
        remaining: quota.remaining,
        resetDate: quota.resetDate
      }, 429);
    }
    quotaReserved = true;

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: fromEmail,
        to: toRecipients,
        ...(ccRecipients.length ? { cc: ccRecipients } : {}),
        ...(bccRecipients.length ? { bcc: bccRecipients } : {}),
        subject,
        text: body,
        ...(html ? { html } : {})
      })
    });

    const providerResponse = await response.json().catch(() => ({}));

    if (!response.ok) {
      await releaseEmailRecipientQuota(access.shopId, quotaRequestId);
      quotaReserved = false;
      const errorMessage = providerResponse.message || providerResponse.error || 'Resend send failed.';
      const message = await logMessage({
        jobId,
        customerId,
        channel: 'email',
        recipient: to,
        subject,
        body,
        status: 'failed',
        provider: 'resend',
        errorMessage
      });
      return json({ success: false, error: errorMessage, providerResponse, message });
    }

    providerAccepted = true;
    const quotaSettlement = await settleEmailRecipientQuota(access.shopId, quotaRequestId);
    const message = await logMessage({
      jobId,
      customerId,
      channel: 'email',
      recipient: to,
      subject,
      body,
      status: 'sent',
      provider: 'resend',
      providerMessageId: providerResponse.id || '',
      sentAt: new Date().toISOString()
    });

    return json({
      success: true,
      id: providerResponse.id || '',
      provider: 'resend',
      message,
      usage: {
        recipientCount,
        settled: quotaSettlement.settled === true
      }
    });
  } catch (error) {
    if (quotaReserved && !providerAccepted) {
      await releaseEmailRecipientQuota(access.shopId, quotaRequestId);
    }
    const errorMessage = error instanceof Error ? error.message : 'Unknown email send error.';
    const message = await logMessage({
      jobId,
      customerId,
      channel: 'email',
      recipient: to,
      subject,
      body,
      status: 'failed',
      provider: 'resend',
      errorMessage
    });
    return json({ success: false, error: errorMessage, message });
  }
});

function validateFunctionKey(request: Request) {
  const expectedKey = Deno.env.get('FRETTRACK_FUNCTION_KEY') || '';
  const receivedKey = request.headers.get('x-frettrack-key') || '';

  if (!expectedKey || receivedKey !== expectedKey) {
    return json({ success: false, error: 'Unauthorized FretTrack function request.' }, 401);
  }

  return null;
}

function requiredFields(fields: Record<string, string>) {
  return Object.entries(fields)
    .filter(([, value]) => !String(value || '').trim())
    .map(([key]) => key);
}

function normalizeRecipients(value: unknown) {
  const values = Array.isArray(value) ? value : String(value || '').split(/[;,]/);
  return values.map((recipient) => String(recipient || '').trim()).filter(Boolean);
}

function normalizeRequestId(value: unknown) {
  const candidate = String(value || '').trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(candidate)
    ? candidate
    : crypto.randomUUID();
}

async function logMessage(message: {
  jobId: string;
  customerId?: string | null;
  channel: 'email';
  recipient: string;
  subject?: string;
  body: string;
  status: 'sent' | 'failed';
  provider: 'resend';
  providerMessageId?: string;
  errorMessage?: string;
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
      status: message.status,
      provider: message.provider,
      provider_message_id: message.providerMessageId || '',
      error_message: message.errorMessage || '',
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

async function resolveJobWriteAccess(request: Request, jobId: string) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const authorization = request.headers.get('Authorization') || '';
  const token = authorization.replace(/^Bearer\s+/i, '').trim();

  if (!supabaseUrl || !serviceRoleKey || !token) {
    return { error: json({ success: false, error: 'Authenticated shop access is required.' }, 401), shopId: '' };
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  const user = userData?.user;
  if (userError || !user) {
    return { error: json({ success: false, error: 'Authenticated shop access is required.' }, 401), shopId: '' };
  }

  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .select('id, shop_id')
    .eq('id', jobId)
    .single();

  if (jobError || !job) {
    return { error: json({ success: false, error: 'Work order was not found.' }, 404), shopId: '' };
  }

  const { data: membership, error: membershipError } = await supabase
    .from('shop_members')
    .select('role')
    .eq('shop_id', job.shop_id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (membershipError || !['owner', 'admin', 'tech'].includes(membership?.role || '')) {
    return { error: json({ success: false, error: 'Your shop role cannot send customer messages.' }, 403), shopId: '' };
  }

  const hasEffectiveAccess = await canUseShopWriteRole(supabase, job.shop_id, membership.role);
  if (!hasEffectiveAccess) {
    return { error: json({ success: false, error: 'Your shop role cannot send customer messages.' }, 403), shopId: '' };
  }

  return { error: null, shopId: job.shop_id };
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

async function canUseShopWriteRole(supabase: ReturnType<typeof createClient>, shopId: string, role: string) {
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

async function shopLifecycleAllowsWrite(supabase: ReturnType<typeof createClient>, shopId: string) {
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

async function shopHasTeamMembers(supabase: ReturnType<typeof createClient>, shopId: string) {
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
    .eq('key', 'team_members')
    .maybeSingle();

  if (trialExpired) {
    return Boolean(entitlement?.value);
  }

  const profileOverride = profile?.feature_overrides?.team_members;
  const { data: override } = await supabase
    .from('shop_entitlement_overrides')
    .select('value')
    .eq('shop_id', shopId)
    .eq('key', 'team_members')
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .maybeSingle();

  return Boolean(override?.value ?? profileOverride ?? entitlement?.value);
}

async function loadShopAccessState(supabase: ReturnType<typeof createClient>, shopId: string) {
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
