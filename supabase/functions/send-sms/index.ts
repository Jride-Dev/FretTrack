import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-frettrack-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const SMS_RATE_LIMIT_PER_HOUR = 10;

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
  const mode = twilioMode();

  if (payload.action === 'status') {
    return json({ success: true, mode });
  }

  const jobId = payload.job_id || payload.jobId || payload.job?.id || '';
  const customerId = payload.customer_id || payload.customerId || null;
  const to = payload.to || payload.message?.recipient || payload.job?.phone || '';
  const body = payload.body || payload.message?.body || '';

  const missing = requiredFields({ job_id: jobId, to, body });
  if (missing.length) {
    return json({ success: false, mode, error: `Missing required field(s): ${missing.join(', ')}` }, 400);
  }

  const normalizedTo = normalizePhone(to);
  const optIn = await hasSmsOptIn(jobId);

  if (!optIn) {
    const message = await logMessage({
      jobId,
      customerId,
      channel: 'sms',
      recipient: normalizedTo,
      body,
      status: 'failed',
      provider: 'twilio',
      errorMessage: 'SMS opt-in is required before sending text messages.'
    });
    return json({ success: false, mode, error: 'SMS opt-in is required before sending text messages.', message }, 403);
  }

  const credentials = twilioCredentials(mode);
  if (!credentials.accountSid || !credentials.authToken || !credentials.fromNumber) {
    const message = await logMessage({
      jobId,
      customerId,
      channel: 'sms',
      recipient: normalizedTo,
      body,
      status: 'failed',
      provider: 'twilio',
      errorMessage: `Twilio ${mode} mode is not configured.`
    });
    return json({ success: false, mode, error: `Twilio ${mode} mode is not configured.`, message }, 500);
  }

  try {
    const rateLimit = await checkRateLimit('sms', SMS_RATE_LIMIT_PER_HOUR);
    if (!rateLimit.allowed) {
      const errorMessage = `SMS rate limit reached. Max ${SMS_RATE_LIMIT_PER_HOUR} SMS per hour.`;
      const message = await logMessage({
        jobId,
        customerId,
        channel: 'sms',
        recipient: normalizedTo,
        body,
        status: 'failed',
        provider: 'twilio',
        errorMessage
      });
      return json({ success: false, mode, error: errorMessage, message }, 429);
    }

    const formBody = new URLSearchParams({
      From: credentials.fromNumber,
      To: normalizedTo,
      Body: body
    });

    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${credentials.accountSid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${btoa(`${credentials.accountSid}:${credentials.authToken}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formBody
    });

    const providerResponse = await response.json().catch(() => ({}));

    if (!response.ok) {
      const errorMessage = providerResponse.message || 'Twilio send failed.';
      const message = await logMessage({
        jobId,
        customerId,
        channel: 'sms',
        recipient: normalizedTo,
        body,
        status: 'failed',
        provider: 'twilio',
        errorMessage
      });
      return json({ success: false, mode, error: errorMessage, providerResponse, message }, response.status);
    }

    const message = await logMessage({
      jobId,
      customerId,
      channel: 'sms',
      recipient: normalizedTo,
      body,
      status: 'sent',
      provider: 'twilio',
      providerMessageId: providerResponse.sid || '',
      sentAt: new Date().toISOString()
    });

    return json({ success: true, mode, id: providerResponse.sid || '', provider: 'twilio', message });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown SMS send error.';
    const message = await logMessage({
      jobId,
      customerId,
      channel: 'sms',
      recipient: normalizedTo,
      body,
      status: 'failed',
      provider: 'twilio',
      errorMessage
    });
    return json({ success: false, mode, error: errorMessage, message }, 500);
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

async function hasSmsOptIn(jobId: string) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    return false;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { data, error } = await supabase
    .from('jobs')
    .select('sms_opt_in')
    .eq('id', jobId)
    .single();

  if (error) {
    console.error('SMS opt-in check failed', error);
    return false;
  }

  return Boolean(data?.sms_opt_in);
}

async function logMessage(message: {
  jobId: string;
  customerId?: string | null;
  channel: 'sms';
  recipient: string;
  body: string;
  status: 'sent' | 'failed';
  provider: 'twilio';
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
      subject: null,
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
    console.error('customer_messages sms log failed', error);
    return null;
  }

  return data;
}

async function checkRateLimit(channel: 'sms', maxPerHour: number) {
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
    console.error('sms rate limit check failed', error);
    return { allowed: false, count: 0 };
  }

  return { allowed: Number(count || 0) < maxPerHour, count: Number(count || 0) };
}

function twilioMode() {
  const value = (Deno.env.get('TWILIO_MODE') || 'test').toLowerCase();
  return value === 'live' ? 'live' : 'test';
}

function twilioCredentials(mode: string) {
  const prefix = mode === 'live' ? 'TWILIO_LIVE' : 'TWILIO_TEST';
  return {
    accountSid: Deno.env.get(`${prefix}_ACCOUNT_SID`) || '',
    authToken: Deno.env.get(`${prefix}_AUTH_TOKEN`) || '',
    fromNumber: Deno.env.get(`${prefix}_FROM_NUMBER`) || ''
  };
}

function requiredFields(fields: Record<string, string>) {
  return Object.entries(fields)
    .filter(([, value]) => !String(value || '').trim())
    .map(([key]) => key);
}

function normalizePhone(phone: string) {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return phone.startsWith('+') ? phone : `+${digits}`;
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
