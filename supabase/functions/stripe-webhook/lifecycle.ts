type StripeIdReference = string | { id?: string | null } | null | undefined;

type InvoiceSubscriptionShape = {
  subscription?: StripeIdReference;
  parent?: {
    subscription_details?: {
      subscription?: StripeIdReference;
    } | null;
  } | null;
};

type SubscriptionPeriodShape = {
  current_period_start?: number | null;
  current_period_end?: number | null;
  items?: {
    data?: Array<{
      current_period_start?: number | null;
      current_period_end?: number | null;
    }>;
  };
};

type SubscriptionItemShape = {
  price?: {
    id?: string | null;
    recurring?: {
      interval?: string | null;
    } | null;
  } | null;
  current_period_start?: number | null;
  current_period_end?: number | null;
};

type SubscriptionItemsShape = {
  items?: {
    data?: SubscriptionItemShape[] | null;
  } | null;
};

export function getInvoiceSubscriptionId(invoice: unknown) {
  const value = (invoice || {}) as InvoiceSubscriptionShape;
  return getStripeId(value.parent?.subscription_details?.subscription) ||
    getStripeId(value.subscription);
}

export function getSubscriptionPeriod(subscription: unknown) {
  const value = (subscription || {}) as SubscriptionPeriodShape;
  const item = value.items?.data?.[0];
  return {
    currentPeriodStart: item?.current_period_start ?? value.current_period_start ?? null,
    currentPeriodEnd: item?.current_period_end ?? value.current_period_end ?? null,
  };
}

export function getFirstSubscriptionItem(subscription: unknown) {
  const value = (subscription || {}) as SubscriptionItemsShape;
  return value.items?.data?.[0] || null;
}

export function normalizeStripeStatus(status: string) {
  const value = String(status || "").toLowerCase();
  if (value === "active") return "active";
  if (value === "trialing") return "trialing";
  if (value === "past_due" || value === "unpaid") return "past_due";
  if (value === "incomplete" || value === "incomplete_expired") {
    return "incomplete";
  }
  if (value === "canceled" || value === "cancelled") return "canceled";
  if (value === "paused") return "read_only";
  return "read_only";
}

export function toProfileSubscriptionStatus(status: string) {
  const value = String(status || "").toLowerCase();
  if (value === "trialing") return "trialing";
  if (value === "canceled" || value === "cancelled") return "canceled";
  if (value === "active" || value === "past_due" || value === "grace") return "active";
  return "expired";
}

export function normalizePlan(plan: string) {
  const value = String(plan || "").toLowerCase();
  return value === "shop" || value === "pro" ? value : "";
}

export function normalizeBillingInterval(interval: unknown) {
  const value = String(interval || "").toLowerCase();
  if (value === "month" || value === "monthly") return "monthly";
  if (value === "year" || value === "yearly") return "yearly";
  return "";
}

export function getStripeWebhookClaimDisposition(status: unknown) {
  return ["processed", "ignored"].includes(String(status || "").trim())
    ? "duplicate"
    : "retry";
}

function getStripeId(value: StripeIdReference) {
  if (!value) return "";
  return typeof value === "string" ? value : String(value.id || "").trim();
}
