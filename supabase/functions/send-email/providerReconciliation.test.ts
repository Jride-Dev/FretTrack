import { deepStrictEqual, strictEqual } from 'node:assert';
import { buildProviderReconciliationPatch } from './providerReconciliation.ts';

const providerEventAt = '2026-08-16T02:30:00.000Z';

for (const lastEvent of ['canceled', 'cancel_accepted']) {
  Deno.test(`terminal provider event ${lastEvent} finalizes a cancellation retry`, () => {
    const patch = buildProviderReconciliationPatch({
      messageStatus: 'canceling',
      lastEvent,
      scheduledAt: '2026-08-17T02:30:00.000Z',
      providerEventAt,
    });

    deepStrictEqual(patch, {
      provider_last_event: lastEvent,
      provider_event_at: providerEventAt,
      status: 'canceled',
      sent_at: null,
      canceled_at: providerEventAt,
      error_message: '',
    });
  });
}

Deno.test('a delivered provider event wins over local cancellation state', () => {
  const patch = buildProviderReconciliationPatch({
    messageStatus: 'canceling',
    lastEvent: 'delivered',
    scheduledAt: null,
    providerEventAt,
  });

  strictEqual(patch.status, 'sent');
  strictEqual(patch.sent_at, providerEventAt);
  strictEqual(patch.canceled_at, null);
});

Deno.test('the missing provider schedule fallback still finalizes cancellation', () => {
  const patch = buildProviderReconciliationPatch({
    messageStatus: 'canceling',
    lastEvent: 'scheduled',
    scheduledAt: null,
    providerEventAt,
  });

  strictEqual(patch.status, 'canceled');
  strictEqual(patch.canceled_at, providerEventAt);
});

Deno.test('a still-scheduled provider message remains nonterminal', () => {
  const patch = buildProviderReconciliationPatch({
    messageStatus: 'canceling',
    lastEvent: 'scheduled',
    scheduledAt: '2026-08-17T02:30:00.000Z',
    providerEventAt,
  });

  strictEqual(patch.status, undefined);
  strictEqual(patch.provider_last_event, 'scheduled');
});
