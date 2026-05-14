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
  const to = payload.to || payload.message?.recipient || payload.job?.email || '';
  const subject = payload.subject || payload.message?.subject || '';
  const body = payload.body || payload.message?.body || '';

  const missing = requiredFields({ job_id: jobId, to, subject, body });
  if (missing.length) {
    return json({ success: false, error: `Missing required field(s): ${missing.join(', ')}` });
  }

  const accessError = await validateJobWriteAccess(request, jobId);
  if (accessError) {
    return accessError;
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

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: fromEmail,
        to,
        subject,
        text: body
      })
    });

    const providerResponse = await response.json().catch(() => ({}));

    if (!response.ok) {
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

    return json({ success: true, id: providerResponse.id || '', provider: 'resend', message });
  } catch (error) {
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

async function validateJobWriteAccess(request: Request, jobId: string) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const authorization = request.headers.get('Authorization') || '';
  const token = authorization.replace(/^Bearer\s+/i, '').trim();

  if (!supabaseUrl || !serviceRoleKey || !token) {
    return json({ success: false, error: 'Authenticated shop access is required.' }, 401);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  const user = userData?.user;
  if (userError || !user) {
    return json({ success: false, error: 'Authenticated shop access is required.' }, 401);
  }

  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .select('id, shop_id')
    .eq('id', jobId)
    .single();

  if (jobError || !job) {
    return json({ success: false, error: 'Work order was not found.' }, 404);
  }

  const { data: membership, error: membershipError } = await supabase
    .from('shop_members')
    .select('role')
    .eq('shop_id', job.shop_id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (membershipError || !['owner', 'admin', 'tech'].includes(membership?.role || '')) {
    return json({ success: false, error: 'Your shop role cannot send customer messages.' }, 403);
  }

  return null;
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
