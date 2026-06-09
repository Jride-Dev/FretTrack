import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const APP_URL = 'https://app.frettrack-app.com/';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return json({ ok: false, error: 'Method not allowed.' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const resendApiKey = Deno.env.get('RESEND_API_KEY') || '';
  const fromEmail = Deno.env.get('SHOP_EMAIL_FROM') || 'FretTrack <noreply@frettrack-app.com>';
  const loginUrl = Deno.env.get('BETA_APPROVAL_LOGIN_URL') || APP_URL;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('beta approval notification missing Supabase service configuration');
    return json({ ok: false, error: 'Notification service is not configured.' });
  }

  const authorization = request.headers.get('Authorization') || '';
  const token = authorization.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    return json({ ok: false, error: 'Authentication required.' }, 401);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  const operatorUser = userData?.user;
  if (userError || !operatorUser) {
    return json({ ok: false, error: 'Authentication required.' }, 401);
  }

  const { data: operatorRow, error: operatorError } = await supabase
    .from('operator_users')
    .select('user_id')
    .eq('user_id', operatorUser.id)
    .eq('active', true)
    .maybeSingle();

  if (operatorError) {
    console.error('beta approval operator lookup failed', { error: operatorError.message });
    return json({ ok: false, error: 'Operator lookup failed.' });
  }

  if (!operatorRow) {
    return json({ ok: false, error: 'Operator access required.' }, 403);
  }

  const body = await request.json().catch(() => ({}));
  const requestId = String(body.requestId || '').trim();
  if (!requestId) {
    return json({ ok: false, error: 'Missing beta access request.' }, 400);
  }

  const { data: requestRow, error: requestError } = await supabase
    .from('beta_access_requests')
    .select('id, email, status, approved_notified_at')
    .eq('id', requestId)
    .maybeSingle();

  if (requestError) {
    console.error('beta approval request lookup failed', { error: requestError.message });
    return json({ ok: false, error: 'Unable to load beta access request.' });
  }

  if (!requestRow) {
    return json({ ok: false, error: 'Beta access request not found.' }, 404);
  }

  if (requestRow.status !== 'approved') {
    return json({ ok: true, skipped: true, reason: 'Beta access request is not approved.' });
  }

  if (requestRow.approved_notified_at) {
    return json({ ok: true, skipped: true, reason: 'Approval notification was already sent.' });
  }

  const applicantEmail = String(requestRow.email || '').trim();
  if (!applicantEmail) {
    console.error('beta approval notification missing applicant email', { requestId: requestRow.id });
    return json({ ok: false, error: 'Applicant email is missing.' });
  }

  if (!resendApiKey || !fromEmail) {
    console.error('beta approval notification email not configured', {
      hasResendApiKey: Boolean(resendApiKey),
      hasFromEmail: Boolean(fromEmail)
    });
    return json({ ok: false, error: 'Approval notification email is not configured.' });
  }

  try {
    await sendResendEmail({
      apiKey: resendApiKey,
      from: fromEmail,
      to: applicantEmail,
      subject: 'Your FretTrack beta access is approved',
      text: [
        'Welcome to the FretTrack beta.',
        '',
        'Your beta access has been approved. You can now sign in and start setting up your shop workspace.',
        '',
        `Login: ${loginUrl}`,
        '',
        'Thanks for helping shape FretTrack.'
      ].join('\n')
    });

    const { error: updateError } = await supabase
      .from('beta_access_requests')
      .update({ approved_notified_at: new Date().toISOString() })
      .eq('id', requestRow.id)
      .eq('status', 'approved')
      .is('approved_notified_at', null);

    if (updateError) {
      console.error('beta approval notification timestamp update failed', { error: updateError.message });
      return json({ ok: true, warning: 'Approval email sent, but timestamp update failed.' });
    }

    console.log('beta approval notification sent', {
      applicantDomain: getEmailDomain(applicantEmail)
    });
    return json({ ok: true, sent: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown notification error.';
    console.error('beta approval notification failed', { error: message });
    return json({ ok: false, error: 'Approval notification email failed.' });
  }
});

async function sendResendEmail({
  apiKey,
  from,
  to,
  subject,
  text
}: {
  apiKey: string;
  from: string;
  to: string;
  subject: string;
  text: string;
}) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ from, to, subject, text })
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.message || result.error || 'Resend send failed.');
  }

  return { ok: true, id: result.id || '' };
}

function getEmailDomain(value: string) {
  const [, domain = 'unknown'] = String(value || '').split('@');
  return domain || 'unknown';
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
