import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  hashPayload,
  normalizeInboundEmail,
  plainTextFromHtml,
  verifyResendWebhook
} from './resendInbound.ts';

type AnyClient = ReturnType<typeof createClient<any, 'public', any>>;
const PROVIDER = 'resend';

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  const payload = await request.text();
  try {
    await verifyResendWebhook({
      payload,
      headers: {
        id: request.headers.get('svix-id') || '',
        timestamp: request.headers.get('svix-timestamp') || '',
        signature: request.headers.get('svix-signature') || ''
      },
      secret: Deno.env.get('RESEND_WEBHOOK_SECRET') || ''
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Invalid webhook.' }, 400);
  }

  const eventId = request.headers.get('svix-id') || '';
  const event = parseJson(payload);
  if (event?.type !== 'email.received') return json({ received: true, ignored: true }, 200);

  const supabase = createClient(Deno.env.get('SUPABASE_URL') || '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '');
  const payloadHash = await hashPayload(payload);
  const claim = await claimWebhookEvent(supabase, eventId, payloadHash);
  if (claim === 'duplicate') return json({ received: true, duplicate: true }, 200);

  try {
    const email = await resolveReceivedEmail(event.data || {});
    const recipients = asArray(email.to || event.data?.to).map(normalizeInboundEmail).filter(Boolean);
    const route = await findRoute(supabase, recipients);
    if (!route) {
      await finishWebhookEvent(supabase, eventId, 'ignored', null, 'No active inbound route matched the recipient.');
      return json({ received: true, ignored: true }, 200);
    }

    const sender = normalizeInboundEmail(email.from || event.data?.from);
    const customerId = await findUniqueCustomer(supabase, route.shop_id, sender);
    const body = String(email.text || '').trim() || plainTextFromHtml(email.html);
    const receivedAt = email.created_at || event.created_at || new Date().toISOString();
    const message = await insertInboundMessage(supabase, {
      shop_id: route.shop_id,
      customer_id: customerId,
      job_id: null,
      channel: 'email',
      direction: 'inbound',
      sender_address: sender,
      recipient: route.email_address,
      subject: String(email.subject || event.data?.subject || '').trim(),
      body,
      status: 'received',
      provider: PROVIDER,
      provider_message_id: String(email.id || event.data?.email_id || '').trim(),
      provider_last_event: 'email.received',
      provider_event_at: event.created_at || receivedAt,
      received_at: receivedAt
    });
    await finishWebhookEvent(supabase, eventId, 'received', message.id, '');
    return json({ received: true, message_id: message.id }, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Inbound email processing failed.';
    await finishWebhookEvent(supabase, eventId, 'failed', null, message);
    console.error('receive-email failed', error);
    return json({ error: message, retryable: true }, 500);
  }
});

async function claimWebhookEvent(supabase: AnyClient, eventId: string, payloadHash: string) {
  if (!eventId) throw new Error('Missing webhook event ID.');
  const inserted = await supabase.from('customer_inbound_webhook_events').insert({ provider: PROVIDER, event_id: eventId, payload_hash: payloadHash, status: 'processing' });
  if (!inserted.error) return 'claimed';
  if (inserted.error.code !== '23505') throw inserted.error;

  const existing = await supabase.from('customer_inbound_webhook_events').select('status, processing_started_at').eq('provider', PROVIDER).eq('event_id', eventId).maybeSingle();
  if (existing.error) throw existing.error;
  const existingStatus = existing.data?.status;
  const staleProcessing = existingStatus === 'processing'
    && existing.data?.processing_started_at
    && Date.parse(existing.data.processing_started_at) < Date.now() - 15 * 60 * 1000;
  if (existingStatus === 'failed' || staleProcessing) {
    let reclaim = supabase.from('customer_inbound_webhook_events')
      .update({ payload_hash: payloadHash, status: 'processing', processing_started_at: new Date().toISOString(), error_message: '', completed_at: null })
      .eq('provider', PROVIDER)
      .eq('event_id', eventId);
    reclaim = existingStatus === 'failed'
      ? reclaim.eq('status', 'failed')
      : reclaim.eq('status', 'processing').lt('processing_started_at', new Date(Date.now() - 15 * 60 * 1000).toISOString());
    const reclaimed = await reclaim.select('id').maybeSingle();
    if (!reclaimed.error && reclaimed.data?.id) return 'claimed';
    if (reclaimed.error) throw reclaimed.error;
  }
  return 'duplicate';
}

async function finishWebhookEvent(supabase: AnyClient, eventId: string, status: string, messageId: string | null, errorMessage: string) {
  const { error } = await supabase.from('customer_inbound_webhook_events').update({ status, message_id: messageId, error_message: errorMessage, completed_at: new Date().toISOString() }).eq('provider', PROVIDER).eq('event_id', eventId);
  if (error) throw error;
}

async function findRoute(supabase: AnyClient, recipients: string[]) {
  const uniqueRecipients = [...new Set(recipients)];
  if (!uniqueRecipients.length) return null;

  const { data, error } = await supabase
    .from('customer_inbound_email_routes')
    .select('shop_id, email_address')
    .eq('active', true)
    .in('email_address', uniqueRecipients)
    .limit(2);
  if (error) throw error;
  return data?.length === 1 ? data[0] : null;
}

async function findUniqueCustomer(supabase: AnyClient, shopId: string, sender: string) {
  if (!sender) return null;
  const { data, error } = await supabase.from('customers').select('id').eq('shop_id', shopId).eq('email_normalized', sender).limit(2);
  if (error) throw error;
  return data?.length === 1 ? data[0].id : null;
}

async function insertInboundMessage(supabase: AnyClient, row: Record<string, unknown>) {
  const inserted = await supabase.from('customer_messages').insert(row).select('*').single();
  if (!inserted.error) return inserted.data;
  if (inserted.error.code !== '23505') throw inserted.error;
  const existing = await supabase.from('customer_messages').select('*').eq('provider', PROVIDER).eq('provider_message_id', row.provider_message_id).maybeSingle();
  if (existing.error || !existing.data) throw existing.error || new Error('Inbound duplicate could not be reconciled.');
  return existing.data;
}

async function resolveReceivedEmail(data: Record<string, any>) {
  if (data.text || data.html || data.body) return data;
  const emailId = String(data.email_id || data.id || '').trim();
  const apiKey = Deno.env.get('RESEND_RECEIVING_API_KEY') || '';
  if (!emailId) throw new Error('Received email content is unavailable.');
  if (!apiKey) throw new Error('Resend receiving API access is not configured.');
  const response = await fetch(`https://api.resend.com/emails/receiving/${encodeURIComponent(emailId)}`, { headers: { Authorization: `Bearer ${apiKey}` } });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.message || result.error || 'Resend receiving lookup failed.');
  return result;
}

function asArray(value: unknown) {
  return Array.isArray(value) ? value : value ? [value] : [];
}

function parseJson(payload: string) {
  try { return JSON.parse(payload); } catch { throw new Error('Webhook payload is not valid JSON.'); }
}

function json(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}
