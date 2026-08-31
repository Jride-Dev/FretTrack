export default function PaymentsSection({
  canRecord = true,
  canIssueAdjustments = false,
  isRecording = false,
  addPayment,
  payment,
  payments,
  setPayment
}) {
  return (
    <>
      <form className="row-form payment-form no-print" onSubmit={addPayment}>
        <input type="date" value={payment.date} onChange={(event) => setPayment((current) => ({ ...current, date: event.target.value }))} disabled={!canRecord || isRecording} />
        <select value={payment.type || 'payment'} onChange={(event) => setPayment((current) => ({ ...current, type: event.target.value }))} disabled={!canRecord || isRecording} aria-label="Payment entry type">
          <option value="payment">Payment</option>
          {canIssueAdjustments && <option value="refund">Refund</option>}
          {canIssueAdjustments && <option value="void">Payment Void</option>}
        </select>
        <input type="number" min="0" step="0.01" placeholder="Payment amount" value={payment.amount} onChange={(event) => setPayment((current) => ({ ...current, amount: event.target.value }))} disabled={!canRecord || isRecording} />
        <select value={payment.method} onChange={(event) => setPayment((current) => ({ ...current, method: event.target.value }))} disabled={!canRecord || isRecording} aria-label="Payment method">
          <option value="Cash">Cash</option>
          <option value="Card">Card</option>
          <option value="Check">Check</option>
          <option value="Other">Other</option>
        </select>
        <input placeholder="Payment note" value={payment.note} onChange={(event) => setPayment((current) => ({ ...current, note: event.target.value }))} disabled={!canRecord || isRecording} />
        <button type="submit" disabled={!canRecord || isRecording}>{isRecording ? 'Recording…' : 'Add Payment'}</button>
      </form>
      {payments.length > 0 && (
        <table className="payments-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Method</th>
              <th>Note</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((row) => (
              <tr key={row.id}>
                <td>{row.date || ''}</td>
                <td>{row.type === 'void' ? 'Payment Void' : row.type === 'refund' ? 'Refund' : 'Payment'}</td>
                <td>{row.method || 'Other'}</td>
                <td>{row.note || ''}</td>
                <td>{row.amount || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
