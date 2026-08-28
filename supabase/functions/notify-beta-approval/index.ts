import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  approvalProviderRetryStatus,
  isConfirmedApprovalProviderRejection,
} from './delivery.ts';

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
    return json({ ok: false, error: 'Missing access request.' }, 400);
  }

  const { data: requestRow, error: requestError } = await supabase
    .from('beta_access_requests')
    .select('id, email, status, approved_notified_at')
    .eq('id', requestId)
    .maybeSingle();

  if (requestError) {
    console.error('beta approval request lookup failed', { error: requestError.message });
    return json({ ok: false, error: 'Unable to load access request.' });
  }

  if (!requestRow) {
    return json({ ok: false, error: 'Access request not found.' }, 404);
  }

  if (requestRow.status !== 'approved') {
    return json({ ok: true, skipped: true, reason: 'Access request is not approved.' });
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

  const subject = 'Your FretTrack access is approved';
  const text = [
    'Welcome to FretTrack.',
    '',
    'Your account access has been approved. You can now sign in and start setting up your shop workspace.',
    '',
    `Login: ${loginUrl}`,
    '',
    'Thanks for choosing FretTrack.'
  ].join('\n');

  const { data: delivery, error: deliveryError } = await supabase.rpc('begin_beta_approval_notification', {
    p_request_id: requestRow.id,
    p_recipient_email: applicantEmail,
    p_from_email: fromEmail,
    p_subject: subject,
    p_body_text: text,
  });

  if (deliveryError) {
    console.error('beta approval notification claim failed', { error: deliveryError.message });
    return json({ ok: false, error: 'Unable to prepare the approval notification.' }, 500);
  }

  const deliveryAction = String(delivery?.action || '');
  if (deliveryAction === 'skipped') {
    return json({ ok: true, skipped: true, reason: 'Access request is not approved.' });
  }
  if (deliveryAction === 'sent') {
    return json({ ok: true, skipped: true, reason: 'Approval notification was already sent.' });
  }
  if (deliveryAction === 'indeterminate') {
    return json({
      ok: false,
      retryable: false,
      error: 'Approval email delivery needs manual confirmation before another send.'
    }, 409);
  }
  if (!['send', 'resume'].includes(deliveryAction)) {
    console.error('beta approval notification claim returned an invalid action', { deliveryAction });
    return json({ ok: false, error: 'Unable to prepare the approval notification.' }, 500);
  }

  const idempotencyKey = String(delivery?.idempotencyKey || '');
  let providerResult: { ok: true; id: string };
  try {
    providerResult = await sendResendEmail({
      apiKey: resendApiKey,
      from: String(delivery?.from || ''),
      to: String(delivery?.to || ''),
      subject: String(delivery?.subject || ''),
      text: String(delivery?.text || ''),
      idempotencyKey,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown notification error.';
    const providerStatus = error instanceof ResendRequestError ? error.status : 0;
    const confirmedRejection = isConfirmedApprovalProviderRejection(providerStatus);

    if (confirmedRejection) {
      const { data: released, error: releaseError } = await supabase.rpc('fail_beta_approval_notification', {
        p_request_id: requestRow.id,
        p_idempotency_key: idempotencyKey,
        p_error_message: message,
      });
      if (releaseError || released !== true) {
        console.error('beta approval notification rejection finalization failed', {
          error: releaseError?.message || 'Delivery claim was not released.'
        });
      }
    }

    console.error('beta approval notification failed', { error: message, providerStatus });
    return json({
      ok: false,
      retryable: !confirmedRejection,
      error: confirmedRejection
        ? 'Approval notification email was rejected.'
        : 'Approval notification delivery is pending provider confirmation.'
    }, confirmedRejection ? 502 : approvalProviderRetryStatus(providerStatus));
  }

  const { data: finalized, error: finalizeError } = await supabase.rpc('finalize_beta_approval_notification', {
    p_request_id: requestRow.id,
    p_idempotency_key: idempotencyKey,
    p_provider_message_id: providerResult.id,
  });

  if (finalizeError || finalized !== true) {
    console.error('beta approval notification finalization failed', {
      error: finalizeError?.message || 'Delivery record was not finalized.'
    });
    return json({
      ok: false,
      retryable: true,
      providerAccepted: true,
      error: 'Approval email was accepted; retry to reconcile its delivery record.'
    }, 503);
  }

  console.log('beta approval notification sent', {
    applicantDomain: getEmailDomain(applicantEmail)
  });
  return json({ ok: true, sent: true });
});

async function sendResendEmail({
  apiKey,
  from,
  to,
  subject,
  text,
  idempotencyKey,
}: {
  apiKey: string;
  from: string;
  to: string;
  subject: string;
  text: string;
  idempotencyKey: string;
}) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({ from, to, subject, text })
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ResendRequestError(
      result.message || result.error || 'Resend send failed.',
      response.status,
      String(result.name || result.code || '')
    );
  }

  const providerMessageId = String(result.id || '').trim();
  if (!providerMessageId) {
    throw new Error('Resend accepted the request without returning a message id.');
  }

  return { ok: true as const, id: providerMessageId };
}

class ResendRequestError extends Error {
  status: number;
  code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = 'ResendRequestError';
    this.status = status;
    this.code = code;
  }
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
