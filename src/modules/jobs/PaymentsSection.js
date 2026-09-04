export default function PaymentsSection({
  canRecord = true,
  canIssueAdjustments = false,
  isRecording = false,
  addPayment,
  payment,
  paymentTargets = [],
  payments,
  setPayment
}) {
  const isAdjustment = ['refund', 'void'].includes(String(payment.type || '').toLowerCase());
  return (
    <>
      <form className="row-form payment-form no-print" onSubmit={addPayment}>
        <input type="date" value={payment.date} onChange={(event) => setPayment((current) => ({ ...current, date: event.target.value }))} disabled={!canRecord || isRecording} />
        <select value={payment.type || 'payment'} onChange={(event) => setPayment((current) => ({ ...current, type: event.target.value, appliesToPaymentId: event.target.value === 'payment' ? '' : current.appliesToPaymentId, amount: event.target.value === 'payment' ? current.amount : '' }))} disabled={!canRecord || isRecording} aria-label="Payment entry type">
          <option value="payment">Payment</option>
          {canIssueAdjustments && <option value="refund">Refund</option>}
          {canIssueAdjustments && <option value="void">Payment Void</option>}
        </select>
        {isAdjustment && (
          <select
            value={payment.appliesToPaymentId || ''}
            onChange={(event) => {
              const target = paymentTargets.find((row) => row.id === event.target.value);
              setPayment((current) => ({ ...current, appliesToPaymentId: event.target.value, amount: target ? (target.remainingMinor / 100).toFixed(2) : '' }));
            }}
            disabled={!canRecord || isRecording}
            aria-label="Original payment"
          >
            <option value="">Select original payment…</option>
            {paymentTargets.map((target) => (
              <option key={target.id} value={target.id}>
                {target.date || 'Undated'} · {target.method || 'Other'} · ${(target.remainingMinor / 100).toFixed(2)} remaining
              </option>
            ))}
          </select>
        )}
        <input type="number" min="0.01" step="0.01" max={isAdjustment && payment.appliesToPaymentId ? ((paymentTargets.find((row) => row.id === payment.appliesToPaymentId)?.remainingMinor || 0) / 100).toFixed(2) : undefined} placeholder={isAdjustment ? 'Adjustment amount' : 'Payment amount'} value={payment.amount} onChange={(event) => setPayment((current) => ({ ...current, amount: event.target.value }))} disabled={!canRecord || isRecording} />
        <select value={payment.method} onChange={(event) => setPayment((current) => ({ ...current, method: event.target.value }))} disabled={!canRecord || isRecording} aria-label="Payment method">
          <option value="Cash">Cash</option>
          <option value="Card">Card</option>
          <option value="Check">Check</option>
          <option value="Other">Other</option>
        </select>
        <input placeholder={isAdjustment ? 'Reason (required)' : 'Payment note'} value={payment.note} onChange={(event) => setPayment((current) => ({ ...current, note: event.target.value }))} disabled={!canRecord || isRecording} />
        <button type="submit" disabled={!canRecord || isRecording || (isAdjustment && !payment.appliesToPaymentId)}>{isRecording ? 'Recording…' : isAdjustment ? `Record ${payment.type === 'void' ? 'Void' : 'Refund'}` : 'Add Payment'}</button>
      </form>
      {isAdjustment && <p className="muted-text payment-adjustment-help">Refunds are capped at the remaining amount for the selected payment. A payment void must close that remaining amount. Record the actual provider action before saving the adjustment.</p>}
      {payments.length > 0 && (
        <table className="payments-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Method</th>
              <th>Note</th>
              <th>Applied to</th>
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
                <td>{row.appliesToPaymentId ? (payments.find((paymentRow) => paymentRow.id === row.appliesToPaymentId)?.date || row.appliesToPaymentId) : '—'}</td>
                <td>{row.amount || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
