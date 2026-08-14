import { strictEqual } from "node:assert";
import {
  getInvoiceSubscriptionId,
  normalizeBillingInterval,
  normalizePlan,
  normalizeStripeStatus,
  toProfileSubscriptionStatus,
} from "./lifecycle.ts";
import {
  getCheckoutIdempotencyKey,
  hasBlockingStripeSubscription,
  isStripeIdempotencyConflict,
  shouldApplyStripeSubscriptionEvent,
} from "../_shared/stripeSubscriptionState.ts";

Deno.test("invoice subscription lookup supports the current Stripe parent schema", () => {
  strictEqual(
    getInvoiceSubscriptionId({
      parent: {
        type: "subscription_details",
        subscription_details: {
          subscription: "sub_current",
        },
      },
    }),
    "sub_current",
  );
});

Deno.test("invoice subscription lookup supports expanded and legacy references", () => {
  strictEqual(
    getInvoiceSubscriptionId({
      parent: {
        subscription_details: {
          subscription: { id: "sub_expanded" },
        },
      },
      subscription: "sub_legacy",
    }),
    "sub_expanded",
  );
  strictEqual(
    getInvoiceSubscriptionId({ subscription: "sub_legacy" }),
    "sub_legacy",
  );
  strictEqual(
    getInvoiceSubscriptionId({ parent: { type: "quote_details" } }),
    "",
  );
});

Deno.test("subscription lifecycle states map to FretTrack access states", () => {
  const cases = new Map([
    ["active", "active"],
    ["trialing", "trialing"],
    ["past_due", "past_due"],
    ["unpaid", "past_due"],
    ["incomplete", "incomplete"],
    ["incomplete_expired", "incomplete"],
    ["canceled", "canceled"],
    ["cancelled", "canceled"],
    ["paused", "read_only"],
    ["unknown", "read_only"],
  ]);

  for (const [stripeStatus, expected] of cases) {
    strictEqual(normalizeStripeStatus(stripeStatus), expected, stripeStatus);
  }
});

Deno.test("plan and billing interval normalization remains strict", () => {
  strictEqual(normalizePlan("SHOP"), "shop");
  strictEqual(normalizePlan("pro"), "pro");
  strictEqual(normalizePlan("enterprise"), "");
  strictEqual(normalizeBillingInterval("month"), "monthly");
  strictEqual(normalizeBillingInterval("monthly"), "monthly");
  strictEqual(normalizeBillingInterval("year"), "yearly");
  strictEqual(normalizeBillingInterval("yearly"), "yearly");
  strictEqual(normalizeBillingInterval("week"), "");
});

Deno.test("detailed billing states map safely to the legacy shop profile status", () => {
  strictEqual(toProfileSubscriptionStatus("active"), "active");
  strictEqual(toProfileSubscriptionStatus("past_due"), "active");
  strictEqual(toProfileSubscriptionStatus("trialing"), "trialing");
  strictEqual(toProfileSubscriptionStatus("canceled"), "canceled");
  strictEqual(toProfileSubscriptionStatus("incomplete"), "expired");
  strictEqual(toProfileSubscriptionStatus("read_only"), "expired");
});

Deno.test("an existing non-terminal Stripe subscription blocks another Checkout", () => {
  strictEqual(hasBlockingStripeSubscription({
    stripeSubscriptionId: "sub_active",
    providerStatus: "active",
  }), true);
  strictEqual(hasBlockingStripeSubscription({
    stripeSubscriptionId: "sub_canceled",
    providerStatus: "canceled",
  }), false);
  strictEqual(hasBlockingStripeSubscription({
    stripeSubscriptionId: "",
    status: "trialing",
  }), false);
});

Deno.test("concurrent Checkout requests share one shop-generation idempotency key", async () => {
  const firstTabKey = await getCheckoutIdempotencyKey("shop-one", "");
  const secondTabKey = await getCheckoutIdempotencyKey("shop-one", "");
  const replacementKey = await getCheckoutIdempotencyKey("shop-one", "sub_canceled");
  const otherShopKey = await getCheckoutIdempotencyKey("shop-two", "");

  strictEqual(firstTabKey, secondTabKey);
  strictEqual(firstTabKey === replacementKey, false);
  strictEqual(firstTabKey === otherShopKey, false);
  strictEqual(firstTabKey.length <= 255, true);
  strictEqual(isStripeIdempotencyConflict({ type: "StripeIdempotencyError" }), true);
  strictEqual(isStripeIdempotencyConflict({ code: "idempotency_error" }), true);
  strictEqual(isStripeIdempotencyConflict(new Error("card declined")), false);
});

Deno.test("superseded subscription events cannot overwrite the current subscription", () => {
  strictEqual(shouldApplyStripeSubscriptionEvent({
    storedSubscriptionId: "sub_current",
    storedProviderStatus: "active",
    incomingSubscriptionId: "sub_old",
    incomingProviderStatus: "canceled",
  }), false);
  strictEqual(shouldApplyStripeSubscriptionEvent({
    storedSubscriptionId: "sub_current",
    storedProviderStatus: "active",
    incomingSubscriptionId: "sub_current",
    incomingProviderStatus: "canceled",
  }), true);
  strictEqual(shouldApplyStripeSubscriptionEvent({
    storedSubscriptionId: "sub_canceled",
    storedProviderStatus: "canceled",
    incomingSubscriptionId: "sub_replacement",
    incomingProviderStatus: "active",
  }), true);
});
