export default function PrintActions({
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
      <button type="button" onClick={finishJob}>Finish / Picked Up</button>
      <button type="button" onClick={exportJobJson}>Export Job JSON</button>
      <button type="button" onClick={emailWorkOrder}>Email Work Order</button>
      <button type="button" onClick={printJobSheet}>Print Job Sheet</button>
      <button type="button" onClick={printCustomerReport}>Print Customer Report</button>
    </div>
  );
}
