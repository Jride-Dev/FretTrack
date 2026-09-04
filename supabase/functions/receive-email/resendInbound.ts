const DEFAULT_TIMESTAMP_TOLERANCE_SECONDS = 5 * 60;

export type ResendWebhookHeaders = {
  id: string;
  timestamp: string;
  signature: string;
};

export async function verifyResendWebhook({
  payload,
  headers,
  secret,
  nowSeconds = Math.floor(Date.now() / 1000),
  toleranceSeconds = DEFAULT_TIMESTAMP_TOLERANCE_SECONDS
}: {
  payload: string;
  headers: ResendWebhookHeaders;
  secret: string;
  nowSeconds?: number;
  toleranceSeconds?: number;
}) {
  if (!payload || !headers.id || !headers.timestamp || !headers.signature || !secret) {
    throw new Error('Missing webhook signature credentials.');
  }

  const timestamp = Number(headers.timestamp);
  if (!Number.isFinite(timestamp) || Math.abs(nowSeconds - timestamp) > toleranceSeconds) {
    throw new Error('Webhook timestamp is outside the allowed replay window.');
  }

  const secretValue = secret.startsWith('whsec_') ? secret.slice(6) : secret;
  const keyBytes = decodeBase64(secretValue);
  const signingInput = new TextEncoder().encode(`${headers.id}.${headers.timestamp}.${payload}`);
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  const signatures = headers.signature.split(' ').map((value) => value.split(',', 2)).filter(([version, value]) => version === 'v1' && value);

  for (const [, encodedSignature] of signatures) {
    if (await crypto.subtle.verify('HMAC', key, decodeBase64(encodedSignature), signingInput)) {
      return true;
    }
  }

  throw new Error('Webhook signature is invalid.');
}

export async function hashPayload(payload: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload));
  return encodeBase64(new Uint8Array(digest));
}

export function normalizeInboundEmail(value: unknown) {
  const text = String(value || '').trim();
  const match = text.match(/<([^>]+)>/);
  return (match?.[1] || text).trim().toLowerCase();
}

export function plainTextFromHtml(value: unknown) {
  return String(value || '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+\n/g, '\n')
    .replace(/\n\s+/g, '\n')
    .trim();
}

export function decodeBase64(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(normalized);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function encodeBase64(value: Uint8Array) {
  let binary = '';
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary);
}
