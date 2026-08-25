export type StripeBillingLaunchAccess = {
  allowed: boolean;
  code: "" | "STRIPE_BILLING_CLOSED" | "STRIPE_BILLING_PILOT_ONLY";
  message: string;
  pilotRestricted: boolean;
};

const enabledValues = new Set(["1", "true", "yes", "on"]);

export function getStripeBillingLaunchAccess(
  shopId: unknown,
  enabledValue: unknown,
  pilotShopIdsValue: unknown,
): StripeBillingLaunchAccess {
  const enabled = enabledValues.has(String(enabledValue || "").trim().toLowerCase());
  if (!enabled) {
    return {
      allowed: false,
      code: "STRIPE_BILLING_CLOSED",
      message: "New Stripe subscriptions are not open yet. Existing subscribers can still manage billing.",
      pilotRestricted: false,
    };
  }

  const pilotShopIds = new Set(
    String(pilotShopIdsValue || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
  const normalizedShopId = String(shopId || "").trim();
  if (pilotShopIds.size && !pilotShopIds.has(normalizedShopId)) {
    return {
      allowed: false,
      code: "STRIPE_BILLING_PILOT_ONLY",
      message: "New Stripe subscriptions are currently limited to approved pilot shops.",
      pilotRestricted: true,
    };
  }

  return {
    allowed: true,
    code: "",
    message: pilotShopIds.size
      ? "Stripe annual and monthly billing is available for this pilot shop."
      : "Stripe annual and monthly billing is available.",
    pilotRestricted: pilotShopIds.size > 0,
  };
}
