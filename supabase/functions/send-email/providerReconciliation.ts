export function buildProviderReconciliationPatch({
  messageStatus,
  lastEvent,
  scheduledAt,
  providerEventAt,
}: {
  messageStatus: string;
  lastEvent: unknown;
  scheduledAt: unknown;
  providerEventAt: string;
}) {
  const normalizedEvent = String(lastEvent || '').toLowerCase();
  const sentEvents = new Set(['sent', 'delivered', 'delivery_delayed', 'opened', 'clicked', 'complained']);
  const failedEvents = new Set(['failed', 'bounced', 'suppressed']);
  const canceledEvents = new Set(['canceled', 'cancel_accepted']);
  let patch: Record<string, unknown> = {
    provider_last_event: normalizedEvent,
    provider_event_at: providerEventAt,
  };

  if (sentEvents.has(normalizedEvent)) {
    return {
      ...patch,
      status: 'sent',
      sent_at: providerEventAt,
      canceled_at: null,
      error_message: '',
    };
  }

  if (failedEvents.has(normalizedEvent)) {
    return {
      ...patch,
      status: 'failed',
      sent_at: null,
      canceled_at: null,
      error_message: `Resend reported ${normalizedEvent}.`,
    };
  }

  if (canceledEvents.has(normalizedEvent)) {
    return {
      ...patch,
      status: 'canceled',
      sent_at: null,
      canceled_at: providerEventAt,
      error_message: '',
    };
  }

  if (messageStatus === 'canceling' && normalizedEvent === 'scheduled' && !scheduledAt) {
    patch = {
      ...patch,
      status: 'canceled',
      sent_at: null,
      canceled_at: providerEventAt,
      error_message: '',
    };
  }

  return patch;
}
