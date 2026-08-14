type StoredSubscriptionState = {
  stripeSubscriptionId?: unknown;
  providerStatus?: unknown;
  status?: unknown;
};

export function isTerminalStripeSubscriptionStatus(status: unknown) {
  const value = String(status || "").trim().toLowerCase();
  return value === "canceled" || value === "cancelled" || value === "incomplete_expired";
}

export function hasBlockingStripeSubscription(subscription: StoredSubscriptionState | null | undefined) {
  const subscriptionId = String(subscription?.stripeSubscriptionId || "").trim();
  if (!subscriptionId) return false;
  return !isTerminalStripeSubscriptionStatus(subscription?.providerStatus || subscription?.status);
}

export function shouldApplyStripeSubscriptionEvent({
  storedSubscriptionId,
  storedProviderStatus,
  storedStatus,
  incomingSubscriptionId,
  incomingProviderStatus,
}: {
  storedSubscriptionId?: unknown;
  storedProviderStatus?: unknown;
  storedStatus?: unknown;
  incomingSubscriptionId?: unknown;
  incomingProviderStatus?: unknown;
}) {
  const storedId = String(storedSubscriptionId || "").trim();
  const incomingId = String(incomingSubscriptionId || "").trim();
  if (!storedId || storedId === incomingId) return true;

  return isTerminalStripeSubscriptionStatus(storedProviderStatus || storedStatus) &&
    !isTerminalStripeSubscriptionStatus(incomingProviderStatus);
}
