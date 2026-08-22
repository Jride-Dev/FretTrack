import { createClient } from 'npm:@supabase/supabase-js@2';

const headers = { 'Content-Type': 'application/json' };
const MESSAGE_LEASE_MS = 15 * 60 * 1000;

Deno.serve(async (request) => {
  if (request.method !== 'POST') return response({ success: false, error: 'Method not allowed.' }, 405);
  const expectedKey = Deno.env.get('FRETTRACK_FUNCTION_KEY') || '';
  if (!expectedKey || request.headers.get('x-frettrack-key') !== expectedKey) {
    return response({ success: false, error: 'Unauthorized FretTrack function request.' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const resendApiKey = Deno.env.get('RESEND_API_KEY') || '';
  const fromEmail = Deno.env.get('SHOP_EMAIL_FROM') || '';
  if (!supabaseUrl || !serviceRoleKey || !resendApiKey || !fromEmail) {
    return response({ success: false, error: 'Service reminder delivery is not configured.' }, 503);
  }

  const payload = await request.json().catch(() => ({}));
  const limit = Math.min(50, Math.max(1, Number(payload.limit || 25)));
  const claimToken = crypto.randomUUID();
  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { data: claimed, error: claimError } = await supabase.rpc('claim_due_service_reminders', {
    target_claim_token: claimToken,
    target_limit: limit
  });
  if (claimError) return response({ success: false, error: `Reminder claim failed: ${claimError.message}` }, 500);

  const results = [];
  for (const reminder of claimed || []) {
    results.push(await deliverReminder({ supabase, reminder, claimToken, resendApiKey, fromEmail }));
  }
  const sent = results.filter((result) => result.status === 'sent').length;
  const failed = results.filter((result) => result.status === 'failed').length;
  return response({ success: failed === 0, claimed: results.length, sent, failed, results }, failed ? 207 : 200);
});

async function deliverReminder({ supabase, reminder, claimToken, resendApiKey, fromEmail }: any) {
  const requestId = reminder.delivery_key;
  let quotaSettled = false;
  let providerAttempted = false;
  try {
    const message = await claimMessage(supabase, reminder);
    if (message.status === 'sent' && message.provider_message_id) {
      await finalizeQueue(supabase, reminder.id, claimToken, 'sent', message.provider_message_id, '');
      return { queueId: reminder.id, status: 'sent', idempotent: true };
    }

    const { data: quota, error: quotaError } = await supabase.rpc('reserve_shop_usage', {
      target_shop_id: reminder.shop_id,
      target_request_id: requestId,
      target_usage_kind: 'email_recipients',
      requested_units: 1,
      expected_storage_bytes: 0,
      target_bucket: null,
      target_path: null
    });
    if (quotaError) throw new Error(`Email quota reservation failed: ${quotaError.message}`);
    if (quota?.allowed !== true) {
      await updateMessage(supabase, message.id, { status: 'failed', error_message: 'Monthly email limit reached.', processing_started_at: null });
      await finalizeQueue(supabase, reminder.id, claimToken, 'failed', '', 'Monthly email limit reached.');
      return { queueId: reminder.id, status: 'failed', error: 'Monthly email limit reached.' };
    }
    quotaSettled = quota?.status === 'settled';

    const { data: accessStillValid, error: accessError } = await supabase.rpc('validate_service_reminder_claim', {
      target_queue_id: reminder.id,
      target_claim_token: claimToken
    });
    if (accessError || accessStillValid !== true) {
      if (!quotaSettled) await releaseQuota(supabase, reminder.shop_id, requestId);
      await updateMessage(supabase, message.id, { status: 'failed', error_message: 'Reminder consent or access changed before delivery.', processing_started_at: null });
      await finalizeQueue(supabase, reminder.id, claimToken, 'canceled', '', 'Reminder consent or access changed before delivery.');
      return { queueId: reminder.id, status: 'canceled' };
    }

    providerAttempted = true;
    let providerResponse: Response;
    try {
      providerResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': `frettrack-service-reminder/${requestId}`
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [reminder.recipient_snapshot],
          subject: reminder.subject_snapshot,
          text: reminder.body_snapshot
        })
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Provider transport failed.';
      await finalizeQueue(supabase, reminder.id, claimToken, 'failed', '', `Provider confirmation pending: ${detail}`);
      return { queueId: reminder.id, status: 'failed', retrySafe: true, error: detail };
    }

    const providerData = await providerResponse.json().catch(() => ({}));
    if (!providerResponse.ok) {
      if (!quotaSettled) await releaseQuota(supabase, reminder.shop_id, requestId);
      const providerError = providerData.message || providerData.error || 'Resend rejected the reminder.';
      await updateMessage(supabase, message.id, { status: 'failed', error_message: providerError, provider_last_event: 'failed', provider_event_at: new Date().toISOString(), processing_started_at: null });
      await finalizeQueue(supabase, reminder.id, claimToken, 'failed', '', providerError);
      return { queueId: reminder.id, status: 'failed', error: providerError };
    }
    if (!providerData.id) {
      await finalizeQueue(supabase, reminder.id, claimToken, 'failed', '', 'Provider accepted the reminder without a message ID; confirmation is pending.');
      return { queueId: reminder.id, status: 'failed', retrySafe: true, error: 'Provider confirmation pending.' };
    }

    if (!quotaSettled) {
      const { data: settlement, error: settlementError } = await supabase.rpc('settle_shop_usage_reservation', {
        target_shop_id: reminder.shop_id,
        target_request_id: requestId
      });
      if (settlementError || settlement?.settled !== true) throw new Error(`Provider accepted the reminder, but quota settlement failed: ${settlementError?.message || 'unknown error'}`);
      quotaSettled = true;
    }
    const now = new Date().toISOString();
    const updated = await updateMessage(supabase, message.id, {
      status: 'sent', provider_message_id: providerData.id, provider_last_event: 'sent',
      provider_event_at: now, sent_at: now, error_message: '', processing_started_at: null
    });
    if (!updated) throw new Error('Provider accepted the reminder, but Message History could not be finalized.');
    const finalized = await finalizeQueue(supabase, reminder.id, claimToken, 'sent', providerData.id, '');
    if (!finalized) throw new Error('Provider accepted the reminder, but its queue record could not be finalized.');
    return { queueId: reminder.id, status: 'sent', providerMessageId: providerData.id };
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Reminder delivery failed.';
    if (!providerAttempted && !quotaSettled) await releaseQuota(supabase, reminder.shop_id, requestId);
    const queueFinalized = await safeFinalizeQueue(supabase, reminder.id, claimToken, 'failed', '', detail);
    return {
      queueId: reminder.id,
      status: 'failed',
      retrySafe: providerAttempted,
      queueFinalized,
      error: detail
    };
  }
}

async function claimMessage(supabase: any, reminder: any) {
  const now = new Date().toISOString();
  const insert = await supabase.from('customer_messages').insert({
    job_id: reminder.source_job_id,
    customer_id: reminder.customer_id,
    channel: 'email',
    recipient: reminder.recipient_snapshot,
    subject: reminder.subject_snapshot,
    body: reminder.body_snapshot,
    template_key: 'automated_service_reminder',
    status: 'pending',
    provider: 'resend',
    provider_message_id: '',
    request_id: reminder.delivery_key,
    quota_request_id: reminder.delivery_key,
    operation_key: null,
    processing_started_at: now,
    sent_at: null,
    created_at: now
  }).select().single();
  if (!insert.error && insert.data) return insert.data;
  if (insert.error?.code !== '23505') throw new Error(`Message History claim failed: ${insert.error?.message || 'unknown error'}`);

  const existing = await supabase.from('customer_messages').select('*').eq('request_id', reminder.delivery_key).maybeSingle();
  if (existing.error || !existing.data) throw new Error(`Message History retry lookup failed: ${existing.error?.message || 'record not found'}`);
  const payloadChanged = existing.data.job_id !== reminder.source_job_id
    || existing.data.recipient !== reminder.recipient_snapshot
    || existing.data.subject !== reminder.subject_snapshot
    || existing.data.body !== reminder.body_snapshot;
  if (payloadChanged) throw new Error('The reminder delivery key belongs to a different message snapshot.');
  if (existing.data.status === 'sent') return existing.data;
  const leaseExpired = new Date(existing.data.processing_started_at || 0).getTime() <= Date.now() - MESSAGE_LEASE_MS;
  if (!leaseExpired && existing.data.status === 'pending') throw new Error('The reminder email operation is already in progress.');
  const reclaimed = await supabase.from('customer_messages').update({ status: 'pending', processing_started_at: now, error_message: '' })
    .eq('id', existing.data.id).neq('status', 'sent').select().maybeSingle();
  if (reclaimed.error || !reclaimed.data) throw new Error(`Message History retry claim failed: ${reclaimed.error?.message || 'operation already completed'}`);
  return reclaimed.data;
}

async function updateMessage(supabase: any, id: string, patch: Record<string, unknown>) {
  const { data, error } = await supabase.from('customer_messages').update(patch).eq('id', id).select().maybeSingle();
  if (error) throw new Error(`Message History update failed: ${error.message}`);
  return data;
}

async function finalizeQueue(supabase: any, id: string, token: string, outcome: string, providerId: string, errorMessage: string) {
  const { data, error } = await supabase.rpc('finalize_service_reminder_delivery', {
    target_queue_id: id,
    target_claim_token: token,
    target_outcome: outcome,
    target_provider_message_id: providerId,
    target_error_message: errorMessage
  });
  if (error) throw new Error(`Reminder queue finalization failed: ${error.message}`);
  return data === true;
}

async function safeFinalizeQueue(supabase: any, id: string, token: string, outcome: string, providerId: string, errorMessage: string) {
  try {
    return await finalizeQueue(supabase, id, token, outcome, providerId, errorMessage);
  } catch (error) {
    console.error('Reminder queue finalization failed after the delivery path had already failed.', error);
    return false;
  }
}

async function releaseQuota(supabase: any, shopId: string, requestId: string) {
  const { data } = await supabase.rpc('release_shop_usage_reservation', {
    target_shop_id: shopId,
    target_request_id: requestId
  });
  return data?.released === true;
}

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers });
}
