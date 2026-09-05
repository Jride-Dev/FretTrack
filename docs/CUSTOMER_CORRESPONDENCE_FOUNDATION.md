# Customer Correspondence Foundation

FretTrack now has a provider-neutral database, repository, and focused customer Conversation view for keeping correspondence attached to the correct shop and customer. The first inbound adapter is a signed, replay-safe Resend email ingress; SMS and browser Realtime delivery remain disabled.

## Implemented Boundary

Migration `20260902082416_customer_correspondence_backend.sql` adds one durable `customer_conversation_threads` row per shop, customer, and channel. Existing `customer_messages` rows are backfilled as outbound correspondence and gain direct shop scope, thread identity, direction, sender, received/read timestamps, and explicit customer-report selection.

`src/modules/messaging/customerCorrespondence.js` owns provider-neutral normalization, chronological sorting, direction and channel constants, thread normalization, and customer-report eligibility rules. `src/modules/messaging/customerCorrespondenceRepository.js` supplies the narrow read and mutation operations used by the Conversation and Unassigned Inbox interfaces. Existing Message History remains authoritative.

## Routing and History Safety

Every job-linked message derives and validates its shop and customer from the work order. A message cannot later be moved to another shop, customer, job, thread, channel, or direction. Existing outbound messages sharing a shop, customer, and channel are grouped into the same thread.

Incoming provider messages may be stored without a work-order assignment. Provider adapters must not attach an inbound message to the newest work order by assumption. When routing is ambiguous, the message belongs in the shop's Unassigned Inbox until a staff member deliberately assigns it.

Inbound provider IDs have a partial unique index so a provider retry cannot create duplicate inbound history. The Resend adapter also claims each signed provider event in a service-only replay ledger, verifies the raw Svix signature and timestamp window before parsing, and looks up the full received email when the webhook payload is only a notification. Provider event IDs and provider message IDs remain text identities in those dedicated fields; the UUID `request_id` column is reserved for outbound client operations and remains empty on inbound messages. Every existing shop is backfilled with one opaque receiving address, pre-release manual routes are rotated, and a database trigger gives every newly created shop its own address automatically. The database prevents both multiple active routes for one shop and reuse of an active address across shops. Unmatched or cross-shop ambiguous recipients are acknowledged and ignored. A customer is attached only when the routed shop has one exact normalized email match, and every inbound message starts without a work-order assignment.

## Access and Report Selection

Conversation threads and messages remain protected by shop membership and work-order access. Anonymous callers receive no table or RPC access. Authenticated browser clients cannot forge inbound provider messages or directly rewrite provider-owned delivery state.

Two security-definer RPCs expose only the staff actions the interface needs:

- `set_customer_message_report_inclusion` changes the explicit report-selection flag after checking shop or work-order write access and completed customer-facing eligibility.
- `mark_customer_message_read` records read state only for received inbound correspondence after the same access checks.

Customer reports may include only explicitly selected, nonblank sent/delivered outbound or received inbound correspondence. Failed, pending, scheduled, canceling, canceled, internal, and unselected records remain ineligible.

## Shipped UI and Remaining Boundaries

The customer profile Conversation panel now lists only that customer's email/SMS history, keeps the customer's unassigned records visible, shows inbound read state, and lets authorized staff explicitly include eligible correspondence in a customer report. A separate Messages workspace contains the shop-wide Unassigned Inbox so an incoming reply is not presented as part of every customer profile. Staff can route a received message only to a matching same-shop, same-customer work order, and the system never guesses a route. The isolated Customer Service and Condition Report print/email renderers include only explicitly selected, eligible messages assigned to that work order. The Resend webhook is service-only and does not subscribe the browser to Realtime or enable SMS delivery. Resend and Twilio secrets remain server-only. Outbound sending uses the restricted `RESEND_API_KEY`; received-message retrieval uses a separate read-capable `RESEND_RECEIVING_API_KEY`; webhook verification uses `RESEND_WEBHOOK_SECRET`. Immediate and Scheduled Email sends use the sending shop's private route as Resend's `reply_to` address, so a customer's normal Reply action enters only that shop's signed inbound flow. Automated Service Reminders and job-level Message History otherwise continue to behave as before.

## Next Delivery Order

1. Add the next signed and replay-safe inbound adapter (SMS) only after consent, opt-out, routing, retry, and cost controls are specified.
2. Add Realtime delivery only after authorization, reconnect, ordering, and duplicate-event behavior have executable tests.

Database coverage lives in `supabase/tests/database/customer_correspondence_backend.test.sql`; provider-neutral normalization coverage lives in `scripts/customer-correspondence.test.mjs`.
