export default function PaymentsSection({
  addPayment,
  payment,
  payments,
  removePayment,
  setPayment,
  updatePayment
}) {
  return (
    <>
      <form className="row-form payment-form no-print" onSubmit={addPayment}>
        <input type="date" value={payment.date} onChange={(event) => setPayment((current) => ({ ...current, date: event.target.value }))} />
        <input type="number" min="0" step="0.01" placeholder="Payment amount" value={payment.amount} onChange={(event) => setPayment((current) => ({ ...current, amount: event.target.value }))} />
        <select value={payment.method} onChange={(event) => setPayment((current) => ({ ...current, method: event.target.value }))}>
          <option value="Cash">Cash</option>
          <option value="Card">Card</option>
          <option value="Check">Check</option>
          <option value="Other">Other</option>
        </select>
        <input placeholder="Payment note" value={payment.note} onChange={(event) => setPayment((current) => ({ ...current, note: event.target.value }))} />
        <button type="submit">Add Payment</button>
      </form>
      {payments.length > 0 && (
        <table className="payments-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Method</th>
              <th>Note</th>
              <th>Amount</th>
              <th className="no-print">Remove</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((row) => (
              <tr key={row.id}>
                <td><input type="date" value={row.date || ''} onChange={(event) => updatePayment(row.id, 'date', event.target.value)} /></td>
                <td>
                  <select value={row.method || 'Cash'} onChange={(event) => updatePayment(row.id, 'method', event.target.value)}>
                    <option value="Cash">Cash</option>
                    <option value="Card">Card</option>
                    <option value="Check">Check</option>
                    <option value="Other">Other</option>
                  </select>
                </td>
                <td><input value={row.note || ''} onChange={(event) => updatePayment(row.id, 'note', event.target.value)} /></td>
                <td><input type="number" min="0" step="0.01" value={row.amount || ''} onChange={(event) => updatePayment(row.id, 'amount', event.target.value)} /></td>
                <td className="no-print"><button type="button" onClick={() => removePayment(row.id)}>Remove</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
