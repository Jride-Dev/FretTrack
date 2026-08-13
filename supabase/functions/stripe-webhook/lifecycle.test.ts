import { strictEqual } from "node:assert";
import {
  getInvoiceSubscriptionId,
  normalizeBillingInterval,
  normalizePlan,
  normalizeStripeStatus,
} from "./lifecycle.ts";

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
