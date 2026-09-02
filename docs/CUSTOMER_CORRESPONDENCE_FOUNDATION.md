# Customer Correspondence Foundation

FretTrack now has a provider-neutral database and repository foundation for keeping customer correspondence attached to the correct shop and customer. The foundation is intentionally headless: it prepares safe storage and application boundaries without presenting an unfinished conversation interface or enabling inbound email or SMS.

## Implemented Boundary

Migration `20260902082416_customer_correspondence_backend.sql` adds one durable `customer_conversation_threads` row per shop, customer, and channel. Existing `customer_messages` rows are backfilled as outbound correspondence and gain direct shop scope, thread identity, direction, sender, received/read timestamps, and explicit customer-report selection.

`src/modules/messaging/customerCorrespondence.js` owns provider-neutral normalization, chronological sorting, direction and channel constants, thread normalization, and customer-report eligibility rules. `src/modules/messaging/customerCorrespondenceRepository.js` supplies narrow read and mutation operations for future UI consumers. Existing Message History and outbound email behavior remain unchanged.

## Routing and History Safety

Every job-linked message derives and validates its shop and customer from the work order. A message cannot later be moved to another shop, customer, job, thread, channel, or direction. Existing outbound messages sharing a shop, customer, and channel are grouped into the same thread.

Incoming provider messages may be stored without a work-order assignment. Provider adapters must not attach an inbound message to the newest work order by assumption. When routing is ambiguous, the message belongs in the shop's future unassigned correspondence queue until a staff member deliberately assigns it.

Inbound provider IDs have a partial unique index so a provider retry cannot create duplicate inbound history. The future adapter must still verify the provider signature before inserting any row.

## Access and Report Selection

Conversation threads and messages remain protected by shop membership and work-order access. Anonymous callers receive no table or RPC access. Authenticated browser clients cannot forge inbound provider messages or directly rewrite provider-owned delivery state.

Two security-definer RPCs expose only the staff actions the future interface needs:

- `set_customer_message_report_inclusion` changes the explicit report-selection flag after checking shop or work-order write access and completed customer-facing eligibility.
- `mark_customer_message_read` records read state only for received inbound correspondence after the same access checks.

Customer reports may include only explicitly selected, nonblank sent/delivered outbound or received inbound correspondence. Failed, pending, scheduled, canceling, canceled, internal, and unselected records remain ineligible.

## Not Yet Enabled

This foundation does not add a conversation panel, change current printing, receive inbound provider webhooks, subscribe the browser to Realtime, or enable SMS delivery. Resend and Twilio secrets remain server-only. Existing immediate email, Scheduled Email, Automated Service Reminders, and Message History continue to behave as before.

## Next Delivery Order

1. Add a focused correspondence UI that consumes the repository without duplicating message state.
2. Add deliberate staff controls for unassigned inbound routing, read state, and customer-report selection.
3. Extend the isolated Customer Service Report renderer to consume only eligible selected correspondence.
4. Add one signed and replay-safe inbound provider adapter at a time.
5. Add Realtime delivery only after authorization, reconnect, ordering, and duplicate-event behavior have executable tests.

Database coverage lives in `supabase/tests/database/customer_correspondence_backend.test.sql`; provider-neutral normalization coverage lives in `scripts/customer-correspondence.test.mjs`.
