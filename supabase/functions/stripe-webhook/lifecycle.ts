type StripeIdReference = string | { id?: string | null } | null | undefined;

type InvoiceSubscriptionShape = {
  subscription?: StripeIdReference;
  parent?: {
    subscription_details?: {
      subscription?: StripeIdReference;
    } | null;
  } | null;
};

export function getInvoiceSubscriptionId(invoice: unknown) {
  const value = (invoice || {}) as InvoiceSubscriptionShape;
  return getStripeId(value.parent?.subscription_details?.subscription) ||
    getStripeId(value.subscription);
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

function getStripeId(value: StripeIdReference) {
  if (!value) return "";
  return typeof value === "string" ? value : String(value.id || "").trim();
}
