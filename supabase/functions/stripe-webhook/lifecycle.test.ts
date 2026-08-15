import { deepStrictEqual, strictEqual } from "node:assert";
import {
  getFirstSubscriptionItem,
  getInvoiceSubscriptionId,
  getSubscriptionPeriod,
  normalizeBillingInterval,
  normalizePlan,
  normalizeStripeStatus,
  toProfileSubscriptionStatus,
} from "./lifecycle.ts";
import {
  getCheckoutIdempotencyKey,
  hasBlockingStripeSubscription,
  hasOpenShopSubscriptionAcrossPages,
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

Deno.test("subscription period lookup supports the current Stripe item schema", () => {
  deepStrictEqual(
    getSubscriptionPeriod({
      current_period_start: 1_600_000_000,
      current_period_end: 1_602_592_000,
      items: {
        data: [{
          current_period_start: 1_786_734_973,
          current_period_end: 1_789_413_373,
        }],
      },
    }),
    {
      currentPeriodStart: 1_786_734_973,
      currentPeriodEnd: 1_789_413_373,
    },
  );
});

Deno.test("subscription period lookup preserves legacy top-level timestamps", () => {
  deepStrictEqual(
    getSubscriptionPeriod({
      current_period_start: 1_700_000_000,
      current_period_end: 1_702_592_000,
    }),
    {
      currentPeriodStart: 1_700_000_000,
      currentPeriodEnd: 1_702_592_000,
    },
  );
});

Deno.test("itemless subscription payloads are handled without dereferencing missing data", () => {
  strictEqual(getFirstSubscriptionItem({}), null);
  strictEqual(getFirstSubscriptionItem({ items: null }), null);
  strictEqual(getFirstSubscriptionItem({ items: {} }), null);
  strictEqual(getFirstSubscriptionItem({ items: { data: [] } }), null);
  deepStrictEqual(getSubscriptionPeriod({ items: { data: [] } }), {
    currentPeriodStart: null,
    currentPeriodEnd: null,
  });
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

Deno.test("existing Stripe subscription lookup checks later pages before allowing Checkout", async () => {
  const requestedCursors: Array<string | undefined> = [];
  const pages = [
    {
      data: Array.from({ length: 100 }, (_, index) => ({
        id: `sub_other_${index}`,
        metadata: { shop_id: "another-shop" },
        status: "active",
      })),
      has_more: true,
    },
    {
      data: [{
        id: "sub_target",
        metadata: { shop_id: "shop-one" },
        status: "trialing",
      }],
      has_more: false,
    },
  ];

  const hasOpenSubscription = await hasOpenShopSubscriptionAcrossPages(
    "shop-one",
    async (startingAfter) => {
      requestedCursors.push(startingAfter);
      const page = pages.shift();
      if (!page) throw new Error("Unexpected extra Stripe page request.");
      return page;
    },
  );

  strictEqual(hasOpenSubscription, true);
  deepStrictEqual(requestedCursors, [undefined, "sub_other_99"]);
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
