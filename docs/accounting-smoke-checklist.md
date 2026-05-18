# Accounting Smoke Checklist

Run these against one test shop, then repeat the cross-shop item with a second shop account/member.

1. Paid job: create a job with labor and a billable part, add a full cash payment, then confirm Accounting / Reports shows job totals, paid in, parts revenue, labor revenue, tax, and no open balance.
2. Partial payment: create a job with a balance larger than the payment, then confirm the payment method total increases and the job appears in Open Balances.
3. Refund: add or import a payment event with a negative amount or `type: refund`, then confirm Refunds / Voids increases without deleting the original payment.
4. Discount: add a dollar or percent discount, then confirm Discounts increases and job total drops.
5. Taxable part plus non-taxable labor: keep parts taxable and labor non-taxable, then confirm Tax Collected uses the part subtotal as taxable and labor appears as non-taxable.
6. Cash/card split payments: add two payments with different methods, then confirm Payments By Method has separate rows and the same combined paid total.
7. Cross-shop isolation: switch to another shop and confirm the report only includes jobs for that selected shop.
8. Export: click Export CSV and confirm the file includes summary, payments by method, tax collected, open balances, and job detail.
9. Print/PDF: click Print / PDF and confirm the print view shows the report tables without job form controls.
10. UK currency: set a test shop to GBP/en-GB with tax label VAT, then confirm reports and printed job sheets show £ amounts, VAT wording, and CSV rows include `currency_code` as `GBP`.
11. US date format: set a test shop to `MM/DD/YYYY`, print a job sheet, and confirm intake/work log dates use month/day/year.
12. UK date format: set a test shop to `DD/MM/YYYY`, print a job sheet, and confirm intake/work log dates use day/month/year.
13. UK report export: export Accounting / Reports for a UK shop and confirm display date columns use `DD/MM/YYYY` while ISO safety columns remain ISO.
14. Event timeline ordering/display: add two events on different timestamps and confirm newest ordering is unchanged while displayed dates follow the selected shop format.
