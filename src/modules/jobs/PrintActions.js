export default function PrintActions({
  canSendEmail = true,
  canWrite = true,
  documentType = 'work_order',
  closeDetail,
  emailWorkOrder,
  exportJobJson,
  finishJob,
  printJobSheet,
  printCustomerReport
}) {
  const isEstimate = documentType === 'estimate';
  return (
    <div className="actions no-print">
      <button type="button" onClick={closeDetail}>Close Detail</button>
      <button type="button" onClick={finishJob} disabled={!canWrite}>Finish / Picked Up</button>
      <button type="button" onClick={exportJobJson}>Export Job JSON</button>
      <button type="button" onClick={emailWorkOrder} disabled={!canWrite || !canSendEmail}>{isEstimate ? 'Email Estimate' : 'Email Work Order'}</button>
      <button type="button" onClick={printJobSheet}>{isEstimate ? 'Print Estimate' : 'Print Job Sheet'}</button>
      <button type="button" onClick={printCustomerReport}>Print Customer Report</button>
    </div>
  );
}
