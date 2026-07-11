export default function PrintActions({
  canSendEmail = true,
  canWrite = true,
  closeDetail,
  emailWorkOrder,
  exportJobJson,
  finishJob,
  printJobSheet,
  printCustomerReport
}) {
  return (
    <div className="actions no-print">
      <button type="button" onClick={closeDetail}>Close Job Detail</button>
      <button type="button" onClick={finishJob} disabled={!canWrite}>Finish / Picked Up</button>
      <button type="button" onClick={exportJobJson}>Export Job JSON</button>
      <button type="button" onClick={emailWorkOrder} disabled={!canWrite || !canSendEmail}>Email Work Order</button>
      <button type="button" onClick={printJobSheet}>Print Job Sheet</button>
      <button type="button" onClick={printCustomerReport}>Print Customer Report</button>
    </div>
  );
}
