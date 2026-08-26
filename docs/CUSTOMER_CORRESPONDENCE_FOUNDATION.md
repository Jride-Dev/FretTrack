# Customer Correspondence Foundation

FretTrack's customer correspondence foundation is intentionally headless. It defines the application-level message contract while leaving user-interface work, inbound provider webhooks, Realtime subscriptions, and database expansion for a later focused release.

## Current Boundary

`src/modules/messaging/customerCorrespondence.js` owns correspondence normalization, chronological sorting, direction and channel constants, and customer-report eligibility rules. Existing outbound email and SMS rows from `public.customer_messages` continue to work without a schema change. `jobService.js` consumes this boundary instead of maintaining a second private message mapper.

This foundation does not add a conversation panel, alter printing, enable SMS, receive provider webhooks, subscribe to Realtime, add tables or columns, apply a migration, or change any plan entitlement.

## Future Database Contract

When two-way correspondence is scheduled for implementation, create a reviewed migration for a shop/customer conversation thread and extend message records with the minimum durable fields required for `thread_id`, `shop_id`, `direction`, `sender_address`, `received_at`, `read_at`, and `include_in_customer_report`. Existing rows must backfill as outbound. Provider message identifiers must remain unique enough to make webhook retries idempotent.

Do not attach an inbound message to the newest work order by assumption. Route it to an unassigned correspondence queue whenever a shop/customer has more than one plausible active work order.

## Future Provider Adapters

Provider code belongs behind narrow Edge Function boundaries:

- outbound email continues through Resend;
- inbound email, if enabled, requires verified Resend receiving webhooks and deterministic reply routing;
- outbound SMS continues through Twilio only after the product entitlement and cost model are finalized;
- inbound SMS and delivery callbacks require Twilio signature verification, provider-ID replay protection, opt-out handling, and explicit shop/customer routing.

Provider secrets and service-role credentials must never enter the browser bundle.

## Future UI and Reports

The existing Message History surface should eventually consume the normalized correspondence contract. A customer report may include only explicitly selected, customer-facing sent/delivered or received messages. Failed, pending, scheduled, canceling, canceled, blank, internal, and unselected records are ineligible by default.

## Release Order

1. Finalize Shop and Pro pricing, yearly discounts, trial behavior, tax treatment, cancellation terms, and refund policy.
2. Continue extracting high-churn responsibilities from oversized application and job-service modules.
3. Add the reviewed correspondence migration and provider-neutral repository.
4. Add the correspondence UI and customer-report controls.
5. Add inbound provider adapters, Realtime delivery, compliance behavior, and adversarial tests.
