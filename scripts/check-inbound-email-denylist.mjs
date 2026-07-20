import assert from 'node:assert/strict';
import worker from '../cloudflare/frettrack-inbound-email-filter/src/index.js';
import { getBlockedSenderReason } from '../cloudflare/frettrack-inbound-email-filter/src/denylist.js';

function createMessage({ from, to = 'support@frettrack-app.com', visibleFrom = from }) {
  const result = { forwarded: [], rejection: null };

  return {
    message: {
      from,
      to,
      headers: new Headers({ from: visibleFrom }),
      setReject(reason) {
        result.rejection = reason;
      },
      async forward(destination) {
        result.forwarded.push(destination);
      }
    },
    result
  };
}

const env = {
  SUPPORT_FORWARD_TO: 'support-destination@example.com',
  NOREPLY_FORWARD_TO: 'noreply-destination@example.com',
  JEFF_FORWARD_TO: 'jeff-destination@example.com'
};

const originalWarn = console.warn;
const warningLogs = [];
console.warn = (entry) => warningLogs.push(entry);

try {
  assert.match(
    getBlockedSenderReason({
      envelopeSender: 'k.lerner@fisher-estates.com',
      visibleFrom: 'K. Lerner <k.lerner@fisher-estates.com>'
    }),
    /blocked sender/
  );

  assert.match(
    getBlockedSenderReason({
      envelopeSender: 'K.LERNER@FISHER-ESTATES.COM',
      visibleFrom: 'K. Lerner <K.LERNER@FISHER-ESTATES.COM>'
    }),
    /blocked sender/
  );

  assert.match(
    getBlockedSenderReason({
      envelopeSender: 'different-person@fisher-estates.com',
      visibleFrom: 'Different Person <different-person@fisher-estates.com>'
    }),
    /blocked domain/
  );

  assert.match(
    getBlockedSenderReason({
      envelopeSender: 'allowed@example.com',
      visibleFrom: 'K. Lerner <k.lerner@fisher-estates.com>'
    }),
    /blocked sender/
  );

  const blocked = createMessage({ from: 'k.lerner@fisher-estates.com' });
  await worker.email(blocked.message, env);
  assert.equal(blocked.result.forwarded.length, 0, 'Blocked mail must not forward.');
  assert.equal(blocked.result.rejection, 'Message rejected by recipient policy.');
  const rejectionLog = JSON.parse(warningLogs.at(-1));
  assert.equal(rejectionLog.sender, 'k.lerner@fisher-estates.com');
  assert.equal(rejectionLog.recipient, 'support@frettrack-app.com');
  assert.match(rejectionLog.rejectionReason, /blocked sender/);
  assert.ok(Number.isFinite(Date.parse(rejectionLog.timestamp)), 'Rejected mail must log an ISO timestamp.');

  const allowed = createMessage({ from: 'tester@example.com' });
  await worker.email(allowed.message, env);
  assert.deepEqual(allowed.result.forwarded, ['support-destination@example.com']);
  assert.equal(allowed.result.rejection, null);

  console.log('Inbound email denylist checks passed.');
} finally {
  console.warn = originalWarn;
}
