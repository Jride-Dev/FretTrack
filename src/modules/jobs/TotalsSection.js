import PaymentsSection from './PaymentsSection';
import { money } from '../../shared/utils/money';

export default function TotalsSection({
  addPayment,
  draftJob,
  payment,
  payments,
  removePayment,
  setPayment,
  taxSettings,
  totals,
  updateDiscountField,
  updatePayment,
  updateTaxField
}) {
  return (
    <section>
      <h3>Totals</h3>
      <div className="discount-controls no-print">
        <label>
          Discount Type
          <select name="discountType" value={draftJob.discountType || 'none'} onChange={updateDiscountField}>
            <option value="none">No Discount</option>
            <option value="percent">Percent</option>
            <option value="dollar">Dollar Amount</option>
          </select>
        </label>
        <label>
          Discount
          <input
            type="number"
            min="0"
            step="0.01"
            name="discountValue"
            value={draftJob.discountValue || ''}
            onChange={updateDiscountField}
            disabled={(draftJob.discountType || 'none') === 'none'}
          />
        </label>
        <label>
          State
          <input name="state" value={taxSettings.state || ''} onChange={updateTaxField} />
        </label>
        <label>
          Sales Tax %
          <input type="number" min="0" step="0.001" name="salesTaxRate" value={taxSettings.salesTaxRate || ''} onChange={updateTaxField} />
        </label>
        <label className="checkline">
          <input type="checkbox" name="taxableParts" checked={taxSettings.taxableParts !== false} onChange={updateTaxField} />
          Tax Parts
        </label>
        <label className="checkline">
          <input type="checkbox" name="taxableServices" checked={Boolean(taxSettings.taxableServices)} onChange={updateTaxField} />
          Tax Services
        </label>
      </div>
      <PaymentsSection
        addPayment={addPayment}
        payment={payment}
        payments={payments}
        removePayment={removePayment}
        setPayment={setPayment}
        updatePayment={updatePayment}
      />
      <div className="totals">
        <span>Billable Parts</span>
        <strong>{money(totals.partsTotal)}</strong>
        <span>Included Parts</span>
        <strong>{money(totals.includedPartsTotal)}</strong>
        <span>Services</span>
        <strong>{money(totals.servicesTotal)}</strong>
        <span>Subtotal</span>
        <strong>{money(totals.subtotal)}</strong>
        <span>Discount</span>
        <strong>-{money(totals.discountAmount)}</strong>
        <span>Taxable Amount</span>
        <strong>{money(totals.taxableAmount)}</strong>
        <span>Sales Tax</span>
        <strong>{money(totals.salesTaxAmount)}</strong>
        <span>Total Due</span>
        <strong>{money(totals.totalDue)}</strong>
        <span>Paid</span>
        <strong>{money(totals.paidTotal)}</strong>
        <span>Balance</span>
        <strong>{money(totals.balanceDue)}</strong>
      </div>
    </section>
  );
}
