import PaymentsSection from './PaymentsSection';
import { money } from '../../shared/utils/money';
import { getShopMoneyOptions } from '../shops/shopConfig';

export default function TotalsSection({
  canSendEmail = true,
  canWrite = true,
  canManageJobCharges = canWrite,
  canRecordJobPayments = canWrite,
  canIssuePaymentAdjustments = canWrite,
  canFinalizeJobInvoices = false,
  createEstimateLink,
  changeInvoiceFinalization,
  addPayment,
  draftJob,
  emailInvoice,
  emailEstimate,
  publicEstimateLink = '',
  payment,
  payments,
  finalizationReason = '',
  isCreatingPublicEstimateLink = false,
  isChangingInvoiceState = false,
  isRecordingPayment = false,
  setFinalizationReason,
  setPayment,
  shopTaxCalculationMode = 'disabled',
  shopTaxRate = '',
  taxSettings,
  totals,
  updateDiscountField,
  updateTaxField,
  useShopTaxRate
}) {
  const taxLabel = taxSettings.taxLabel || 'Sales Tax';
  const moneyOptions = getShopMoneyOptions({
    currencyCode: taxSettings.currencyCode,
    locale: taxSettings.locale
  });
  const estimateStatus = draftJob.estimateStatus || 'draft';
  const taxEnabled = taxSettings.calculationMode === 'manual';

  return (
    <section className="work-order-section billing-workspace-section totals-workspace-section">
      <h3>Totals</h3>
      <div className="discount-controls no-print">
        <label>
          Discount Type
          <select name="discountType" value={draftJob.discountType || 'none'} onChange={updateDiscountField} disabled={!canWrite || !canManageJobCharges}>
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
            disabled={!canWrite || !canManageJobCharges || (draftJob.discountType || 'none') === 'none'}
          />
        </label>
        <label>
          State
          <input name="state" value={taxSettings.state || ''} onChange={updateTaxField} disabled={!canWrite || !canManageJobCharges || !taxEnabled} />
        </label>
        <label>
          {taxLabel} %
          <input type="number" min="0" max="100" step="0.001" name="salesTaxRate" value={taxSettings.salesTaxRate || ''} onChange={updateTaxField} disabled={!canWrite || !canManageJobCharges || !taxEnabled} />
        </label>
        {shopTaxCalculationMode === 'manual' && shopTaxRate !== '' && (
          <button type="button" className="button-tertiary" onClick={useShopTaxRate} disabled={!canWrite || !canManageJobCharges}>
            Apply Current Shop Tax Profile ({shopTaxRate}%)
          </button>
        )}
        <label className="checkline">
          <input type="checkbox" name="taxableParts" checked={taxSettings.taxableParts !== false} onChange={updateTaxField} disabled={!canWrite || !canManageJobCharges || !taxEnabled} />
          Tax Parts
        </label>
        <label className="checkline">
          <input type="checkbox" name="taxableServices" checked={Boolean(taxSettings.taxableServices)} onChange={updateTaxField} disabled={!canWrite || !canManageJobCharges || !taxEnabled} />
          Tax Services
        </label>
      </div>
      {!taxEnabled && <p className="muted-text">Tax calculation is disabled for this work order. Configure and enable manual tax in Shop Settings before applying tax.</p>}
      <PaymentsSection
        addPayment={addPayment}
        payment={payment}
        payments={payments}
        setPayment={setPayment}
        canRecord={canWrite && canRecordJobPayments}
        canIssueAdjustments={canIssuePaymentAdjustments}
        isRecording={isRecordingPayment}
      />
      {draftJob.invoiceFinalizedAt && (
        <p className="notice-success">Invoice {draftJob.invoiceNumber ? `#${draftJob.invoiceNumber} ` : ''}revision {draftJob.invoiceRevision || 1} finalized. Parts, services, discounts, and tax settings are locked.</p>
      )}
      {canFinalizeJobInvoices && (
        <div className="invoice-finalization-controls no-print">
          <label>
            {draftJob.invoiceFinalizedAt ? 'Reason for reopening' : 'Finalization note'}
            <input
              value={finalizationReason}
              onChange={(event) => setFinalizationReason(event.target.value)}
              placeholder="Required audit reason"
              disabled={isChangingInvoiceState}
            />
          </label>
          <button type="button" onClick={() => changeInvoiceFinalization(!draftJob.invoiceFinalizedAt)} disabled={isChangingInvoiceState || finalizationReason.trim().length < 8}>
            {isChangingInvoiceState ? 'Saving…' : draftJob.invoiceFinalizedAt ? 'Reopen Invoice' : 'Finalize Invoice'}
          </button>
        </div>
      )}
      <div className="mode-actions no-print totals-actions">
        {(draftJob.documentType === 'estimate' || ['sent', 'approved'].includes(estimateStatus)) && (
          <>
            <button type="button" onClick={emailEstimate} disabled={!canWrite || !canSendEmail}>Email Estimate</button>
            {canFinalizeJobInvoices && <button type="button" className="button-tertiary" onClick={createEstimateLink} disabled={isCreatingPublicEstimateLink}>{isCreatingPublicEstimateLink ? 'Creating link…' : 'Create Customer Link'}</button>}
          </>
        )}
        <button type="button" onClick={emailInvoice} disabled={!canWrite || !canSendEmail}>Email Invoice</button>
      </div>
      {publicEstimateLink && (
        <div className="public-estimate-link-control no-print">
          <label>
            Customer estimate link
            <input value={publicEstimateLink} readOnly onFocus={(event) => event.target.select()} aria-label="Customer estimate link" />
          </label>
          <a href={publicEstimateLink} target="_blank" rel="noreferrer">Open customer view</a>
          <small>This link is bound to revision {draftJob.estimateRevision || 1} and expires automatically.</small>
        </div>
      )}
      <div className="totals">
        <span>Billable Parts</span>
        <strong>{money(totals.partsTotal, moneyOptions)}</strong>
        <span>Included Parts</span>
        <strong>{money(totals.includedPartsTotal, moneyOptions)}</strong>
        <span>Services</span>
        <strong>{money(totals.servicesTotal, moneyOptions)}</strong>
        <span>Subtotal</span>
        <strong>{money(totals.subtotal, moneyOptions)}</strong>
        <span>Discount</span>
        <strong>-{money(totals.discountAmount, moneyOptions)}</strong>
        <span>Taxable Amount</span>
        <strong>{money(totals.taxableAmount, moneyOptions)}</strong>
        <span>{taxLabel}</span>
        <strong>{money(totals.salesTaxAmount, moneyOptions)}</strong>
        <span>Total Due</span>
        <strong>{money(totals.totalDue, moneyOptions)}</strong>
        <span>Paid</span>
        <strong>{money(totals.paidTotal, moneyOptions)}</strong>
        <span>Balance</span>
        <strong>{money(totals.balanceDue, moneyOptions)}</strong>
      </div>
    </section>
  );
}
