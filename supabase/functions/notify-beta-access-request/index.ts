import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const SUPPORT_EMAIL = 'support@frettrack-app.com';

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
  const notifyRecipients = parseEmailRecipients(Deno.env.get('BETA_APPLICATION_NOTIFY_TO') || SUPPORT_EMAIL);

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('beta access notification missing Supabase service configuration');
    return json({ ok: false, error: 'Notification service is not configured.' });
  }

  const authorization = request.headers.get('Authorization') || '';
  const token = authorization.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    return json({ ok: false, error: 'Authentication required.' }, 401);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  const user = userData?.user;
  if (userError || !user) {
    return json({ ok: false, error: 'Authentication required.' }, 401);
  }

  const { data: requestRow, error: requestError } = await supabase
    .from('beta_access_requests')
    .select('id, email, status, requested_at, operator_notified_at')
    .eq('user_id', user.id)
    .maybeSingle();

  if (requestError) {
    console.error('beta access notification request lookup failed', { error: requestError.message });
    return json({ ok: false, error: 'Unable to load beta access request.' });
  }

  if (!requestRow || requestRow.status !== 'pending') {
    return json({ ok: true, skipped: true, reason: 'No pending beta access request.' });
  }

  if (requestRow.operator_notified_at) {
    return json({ ok: true, skipped: true, reason: 'Operator was already notified.' });
  }

  if (!resendApiKey || !fromEmail || !notifyRecipients.length) {
    console.error('beta access notification email not configured', {
      hasResendApiKey: Boolean(resendApiKey),
      hasFromEmail: Boolean(fromEmail),
      hasNotifyRecipients: notifyRecipients.length > 0
    });
    return json({ ok: false, error: 'Operator notification email is not configured.' });
  }

  const applicantEmail = requestRow.email || user.email || '';
  const requestedAt = requestRow.requested_at || new Date().toISOString();
  const subject = `New FretTrack beta access request: ${applicantEmail || user.id}`;
  const text = [
    'New FretTrack beta access request received from the app signup flow.',
    '',
    `Email: ${applicantEmail || 'Not available'}`,
    `User ID: ${user.id}`,
    `Requested: ${requestedAt}`,
    '',
    'Review this request in the Operator Dashboard beta access tab.'
  ].join('\n');

  try {
    const results = await Promise.allSettled(notifyRecipients.map((recipient) => (
      sendResendEmail({
        apiKey: resendApiKey,
        from: fromEmail,
        to: recipient,
        subject,
        text
      })
    )));

    const failed = results.find((result) => {
      if (result.status === 'rejected') {
        return true;
      }
      return result.value?.ok === false;
    });
    if (failed) {
      const message = failed.status === 'rejected'
        ? failed.reason?.message || 'Resend send failed.'
        : failed.value?.error || 'Resend send failed.';
      console.error('beta access operator notification failed', { error: message });
      return json({ ok: false, error: 'Operator notification email failed.' });
    }

    const { error: updateError } = await supabase
      .from('beta_access_requests')
      .update({ operator_notified_at: new Date().toISOString() })
      .eq('id', requestRow.id);

    if (updateError) {
      console.error('beta access notification timestamp update failed', { error: updateError.message });
      return json({ ok: true, warning: 'Notification sent, but timestamp update failed.' });
    }

    console.log('beta access operator notification sent', {
      recipientCount: notifyRecipients.length,
      applicantDomain: getEmailDomain(applicantEmail)
    });
    return json({ ok: true, sent: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown notification error.';
    console.error('beta access operator notification errored', { error: message });
    return json({ ok: false, error: 'Operator notification email failed.' });
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

function parseEmailRecipients(value: string) {
  return String(value || '')
    .split(/[,\s;]+/)
    .map((recipient) => recipient.trim().toLowerCase().slice(0, 180))
    .filter((recipient, index, recipients) => (
      recipient
      && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(recipient)
      && recipients.indexOf(recipient) === index
    ));
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
