import { deepStrictEqual, rejects, strictEqual } from 'node:assert';
import { normalizeInboundEmail, plainTextFromHtml, verifyResendWebhook } from './resendInbound.ts';

Deno.test('Resend webhook verification accepts a valid Svix v1 signature', async () => {
  const payload = JSON.stringify({ type: 'email.received' });
  const id = 'msg_test_123';
  const timestamp = '1760000000';
  const secret = `whsec_${btoa('test-signing-secret')}`;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode('test-signing-secret'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${id}.${timestamp}.${payload}`));
  const encoded = btoa(String.fromCharCode(...new Uint8Array(signature)));

  strictEqual(await verifyResendWebhook({
    payload,
    headers: { id, timestamp, signature: `v1,${encoded}` },
    secret,
    nowSeconds: Number(timestamp)
  }), true);
});

Deno.test('Resend webhook verification rejects bad or stale signatures', async () => {
  await rejects(() => verifyResendWebhook({
    payload: '{}',
    headers: { id: 'msg_test', timestamp: '100', signature: 'v1,invalid' },
    secret: `whsec_${btoa('test-signing-secret')}`,
    nowSeconds: 1000
  }), /outside the allowed replay window/);

  await rejects(() => verifyResendWebhook({
    payload: '{}',
    headers: { id: 'msg_test', timestamp: '1000', signature: 'v1,invalid' },
    secret: `whsec_${btoa('test-signing-secret')}`,
    nowSeconds: 1000
  }), /signature is invalid/);
});

Deno.test('inbound helpers normalize sender addresses and strip HTML safely', () => {
  strictEqual(normalizeInboundEmail('Example Customer <Customer@Example.com>'), 'customer@example.com');
  deepStrictEqual(plainTextFromHtml('<p>Hello<br>there</p><style>.x{}</style>'), 'Hello\nthere');
});
