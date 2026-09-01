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
  changeEstimateState,
  changeInvoiceFinalization,
  addPayment,
  draftJob,
  emailInvoice,
  estimateNote = '',
  payment,
  payments,
  finalizationReason = '',
  isChangingEstimateState = false,
  isChangingInvoiceState = false,
  isRecordingPayment = false,
  setEstimateNote,
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
  const estimateLocked = estimateStatus !== 'draft';
  const estimateBlocksFinalization = estimateStatus === 'sent' || estimateStatus === 'declined';
  const taxEnabled = taxSettings.calculationMode === 'manual';

  return (
    <section>
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
      {estimateLocked && (
        <p className={`commerce-state-notice ${estimateStatus === 'approved' ? 'is-approved' : ''}`}>
          Estimate revision {draftJob.estimateRevision || 1}: {formatEstimateStatus(estimateStatus)}. Parts, services, discounts, and tax settings are locked.
        </p>
      )}
      {canFinalizeJobInvoices && !draftJob.invoiceFinalizedAt && (
        <div className="invoice-finalization-controls no-print">
          <label>
            Estimate audit note
            <input
              value={estimateNote}
              onChange={(event) => setEstimateNote(event.target.value)}
              placeholder={estimateStatus === 'draft' ? 'How the estimate was provided' : 'Customer decision or revision reason'}
              disabled={isChangingEstimateState}
            />
          </label>
          <div className="mode-actions">
            {estimateStatus === 'draft' && (
              <button type="button" onClick={() => changeEstimateState('sent')} disabled={isChangingEstimateState || estimateNote.trim().length < 8}>
                {isChangingEstimateState ? 'Saving…' : 'Mark Estimate Sent'}
              </button>
            )}
            {estimateStatus === 'sent' && (
              <>
                <button type="button" onClick={() => changeEstimateState('approved')} disabled={isChangingEstimateState || estimateNote.trim().length < 8}>Record Approval</button>
                <button type="button" onClick={() => changeEstimateState('declined')} disabled={isChangingEstimateState || estimateNote.trim().length < 8}>Record Decline</button>
                <button type="button" className="button-tertiary" onClick={() => changeEstimateState('draft')} disabled={isChangingEstimateState || estimateNote.trim().length < 8}>Return to Draft</button>
              </>
            )}
            {(estimateStatus === 'approved' || estimateStatus === 'declined') && (
              <button type="button" className="button-tertiary" onClick={() => changeEstimateState('draft')} disabled={isChangingEstimateState || estimateNote.trim().length < 8}>
                {isChangingEstimateState ? 'Saving…' : 'Start Revised Estimate'}
              </button>
            )}
          </div>
        </div>
      )}
      {draftJob.invoiceFinalizedAt && (
        <p className="notice-success">Invoice revision {draftJob.invoiceRevision || 1} finalized. Parts, services, discounts, and tax settings are locked.</p>
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
          <button type="button" onClick={() => changeInvoiceFinalization(!draftJob.invoiceFinalizedAt)} disabled={isChangingInvoiceState || finalizationReason.trim().length < 8 || estimateBlocksFinalization}>
            {isChangingInvoiceState ? 'Saving…' : draftJob.invoiceFinalizedAt ? 'Reopen Invoice' : 'Finalize Invoice'}
          </button>
          {estimateBlocksFinalization && <small>Record customer approval or return the estimate to draft before finalizing.</small>}
        </div>
      )}
      <div className="mode-actions no-print totals-actions">
        <button type="button" onClick={emailInvoice} disabled={!canWrite || !canSendEmail}>Email Invoice</button>
      </div>
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

function formatEstimateStatus(status) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}
