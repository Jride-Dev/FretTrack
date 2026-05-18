import { retailTotal, rowQuantity } from '../billing/accounting';
import { formatShopDate } from '../../shared/utils/dateFormat';
import { formatLength } from '../../shared/utils/measurements';
import { getPrintFooterText, getShopDateOptions, getShopMoneyOptions, getShopSettings } from '../shops/shopConfig';
import { money } from '../../shared/utils/money';

export default function JobPrintSheet({
  draftJob,
  normalizeInstrumentType,
  parts,
  services,
  totals
}) {
  const shopSettings = getShopSettings();
  const printFooterText = getPrintFooterText();
  const taxSettings = draftJob.techDetails?.tax || {};
  const moneyOptions = getShopMoneyOptions({
    currencyCode: taxSettings.currencyCode || shopSettings.currencyCode,
    locale: taxSettings.locale || shopSettings.locale
  });
  const dateOptions = getShopDateOptions({
    dateFormat: taxSettings.dateFormat || shopSettings.dateFormat,
    locale: taxSettings.locale || shopSettings.locale
  });
  const taxLabel = taxSettings.taxLabel || shopSettings.taxLabel || 'Sales Tax';

  return (
    <section className="print-sheet">
      <div className="print-invoice-header">
        <img src={shopSettings.logoUrl || '/frettrack-wordmark.jpg'} alt={shopSettings.shopName || 'FretTrack Systems'} />
        <div>
          <h2>Job Sheet</h2>
          <p>{shopSettings.shopName}</p>
          <p>{[shopSettings.phone, shopSettings.email].filter(Boolean).join(' | ')}</p>
        </div>
      </div>
      <div className="print-grid">
        <span>Customer</span><strong>{draftJob.customerName}</strong>
        <span>Phone</span><strong>{draftJob.phone}</strong>
        <span>Email</span><strong>{draftJob.email}</strong>
        <span>Instrument</span><strong>{normalizeInstrumentType(draftJob.instrumentType)}</strong>
        <span>Brand / Model</span><strong>{draftJob.guitarBrand} {draftJob.model}</strong>
        <span>Serial</span><strong>{draftJob.serial}</strong>
        <span>Color</span><strong>{draftJob.color}</strong>
        <span>Job Number</span><strong>{draftJob.jobNumber}</strong>
        <span>Date Received</span><strong>{formatShopDate(draftJob.dateReceived, dateOptions)}</strong>
        <span>Status</span><strong>{draftJob.status}</strong>
        <span>Job Source</span><strong>{draftJob.techDetails.intakeType || 'Walk-In'}</strong>
        <span>Sub-Contract</span><strong>{draftJob.techDetails.subcontractorName || '-'}</strong>
        <span>Reason For Visit</span><strong>{draftJob.reasonForVisit}</strong>
      </div>
      <h3>Services</h3>
      <table>
        <tbody>
          {services.map((row) => (
            <tr key={row.id}>
              <td>{row.description}</td>
              <td>{row.quantity || 1}</td>
              <td>{money((Number(row.retail) || 0) * rowQuantity(row), moneyOptions)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h3>Parts</h3>
      <table>
        <tbody>
          {parts.map((row) => (
            <tr key={row.id}>
              <td>{row.name}</td>
              <td>{row.quantity || 1}</td>
              <td>{row.includedInService ? 'Included' : money(retailTotal(row), moneyOptions)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="totals">
        <span>Services</span>
        <strong>{money(totals.servicesTotal, moneyOptions)}</strong>
        <span>Billable Parts</span>
        <strong>{money(totals.partsTotal, moneyOptions)}</strong>
        <span>Included Parts</span>
        <strong>{money(totals.includedPartsTotal, moneyOptions)}</strong>
        <span>Subtotal</span>
        <strong>{money(totals.subtotal, moneyOptions)}</strong>
        <span>Discount</span>
        <strong>-{money(totals.discountAmount, moneyOptions)}</strong>
        <span>{taxLabel}</span>
        <strong>{money(totals.salesTaxAmount, moneyOptions)}</strong>
        <span>Total Due</span>
        <strong>{money(totals.totalDue, moneyOptions)}</strong>
        <span>Paid</span>
        <strong>{money(totals.paidTotal, moneyOptions)}</strong>
        <span>Balance</span>
        <strong>{money(totals.balanceDue, moneyOptions)}</strong>
      </div>
      {draftJob.techDetails?.neckInspection && (
        <>
          <h3>Setup Measurements</h3>
          <table>
            <tbody>
              {['initial', 'final'].map((stageKey) => {
                const stage = draftJob.techDetails.neckInspection?.[stageKey] || {};
                const unit = stage.lengthUnit || stage.reliefUnit || draftJob.techDetails.lengthUnit || 'in';
                return (
                  <tr key={stageKey}>
                    <td>{stageKey === 'initial' ? 'Initial' : 'Final'}</td>
                    <td>Relief: {formatLength(stage.relief, stage.reliefUnit || unit)}</td>
                    <td>Nut: {formatLength(stage.nutHighE, stage.nutHighEUnit || unit)} / {formatLength(stage.nutLowE, stage.nutLowEUnit || unit)}</td>
                    <td>12th: {formatLength(stage.actionHighE12th, stage.actionHighE12thUnit || unit)} / {formatLength(stage.actionLowE12th, stage.actionLowE12thUnit || unit)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}
      {printFooterText && <p className="print-footer-text">{printFooterText}</p>}
    </section>
  );
}
