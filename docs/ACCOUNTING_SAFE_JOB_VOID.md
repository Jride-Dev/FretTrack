# Accounting-Safe Work-Order Exclusion

FretTrack preserves invalid and test work orders instead of deleting their customer, billing, communication, or audit history. A writable shop owner or admin can use **Exclude / Void Work Order** from the work-order header. An excluded work order remains readable and searchable through closed-job history, but it is read-only and does not contribute to accounting totals, payment summaries, open balances, till totals, advanced operational metrics, or current-job counts.

Every exclusion and restoration requires an audit reason. Supabase stores the acting user, timestamp, and reason on the work order and adds the action to the job timeline. Direct field updates cannot set or clear the exclusion state, and ordinary edits are rejected while the work order is excluded.

Recorded payments are never erased as part of this action. If a payment remains on the work order—or the timeline proves a payment was recorded and then removed—the database refuses the exclusion. Staff must add an explicit **Refund** or **Payment Void** entry in Parts & Billing so the saved payment ledger nets to zero. The adjustment remains visible in payment history and accounting reports. Once the ledger is balanced, the work-order exclusion is the explicit invoice/accounting void record.

Excluding a work order also deactivates any loyalty award from that work and cancels any unsent automated service reminder sourced from it. Restoring the work order reruns those existing eligibility checks; it does not blindly recreate an award or reminder.

This feature is operational bookkeeping support, not a general ledger, payment-processor refund, or tax filing system. A Refund or Payment Void entry records what the shop did; staff must still perform the actual refund or card void with the original payment provider when applicable.
