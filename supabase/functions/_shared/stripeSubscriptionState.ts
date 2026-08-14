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

export async function getCheckoutIdempotencyKey(
  shopId: unknown,
  previousSubscriptionId: unknown,
) {
  const checkoutGeneration = String(previousSubscriptionId || "").trim() || "initial";
  const source = `frettrack-checkout-v1:${String(shopId || "").trim()}:${checkoutGeneration}`;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(source));
  const hex = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `frettrack-checkout-v1-${hex}`;
}

export function isStripeIdempotencyConflict(error: unknown) {
  const stripeError = error as { type?: unknown; code?: unknown; statusCode?: unknown } | null;
  return stripeError?.type === "StripeIdempotencyError" ||
    stripeError?.code === "idempotency_error" ||
    stripeError?.statusCode === 409;
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
