import { retailTotal, rowQuantity } from '../billing/accounting';
import { formatShopDate } from '../../shared/utils/dateFormat';
import { formatLength } from '../../shared/utils/measurements';
import { getPrintFooterText, getShopDateOptions, getShopMoneyOptions, getShopSettings } from '../shops/shopConfig';
import { money } from '../../shared/utils/money';

export default function JobPrintSheet({
  draftJob,
  formatInstrumentLabel,
  normalizeInstrumentType,
  outerStringLabels = { treble: 'High E', bass: 'Low E' },
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
  const techDetails = draftJob.techDetails || {};
  const finalNeckInspection = techDetails.neckInspection?.final || {};
  const finalLengthUnit = finalNeckInspection.lengthUnit || finalNeckInspection.reliefUnit || techDetails.lengthUnit || 'in';
  const finalFlags = [
    finalNeckInspection.twist ? 'Twist' : '',
    finalNeckInspection.buzzPresent ? 'Buzz present' : '',
    finalNeckInspection.deadSpots ? 'Dead spots' : '',
    finalNeckInspection.highFrets ? 'High frets' : ''
  ].filter(Boolean);

  return (
    <section className="print-sheet">
      <div className="print-invoice-header print-section">
        <img src={shopSettings.logoUrl || '/frettrack-wordmark.jpg'} alt={shopSettings.shopName || 'FretTrack Systems'} />
        <div>
          <h2>Job Sheet</h2>
          <p>{shopSettings.shopName}</p>
          <p>{[shopSettings.phone, shopSettings.email].filter(Boolean).join(' | ')}</p>
        </div>
      </div>
      <section className="print-section">
        <div className="print-grid print-job-summary">
          <span>Customer</span><strong>{draftJob.customerName}</strong>
          <span>Phone</span><strong>{draftJob.phone}</strong>
          <span>Email</span><strong>{draftJob.email}</strong>
          <span>Instrument</span><strong>{formatInstrumentLabel ? formatInstrumentLabel(draftJob) : normalizeInstrumentType(draftJob.instrumentType)}</strong>
          <span>Brand / Model</span><strong>{draftJob.guitarBrand} {draftJob.model}</strong>
          <span>Serial</span><strong>{draftJob.serial}</strong>
          <span>Color</span><strong>{draftJob.color}</strong>
          <span>Job Number</span><strong>{draftJob.jobNumber}</strong>
          <span>Date Received</span><strong>{formatShopDate(draftJob.dateReceived, dateOptions)}</strong>
          <span>Status</span><strong>{draftJob.status}</strong>
          <span>Job Source</span><strong>{techDetails.intakeType || 'Walk-In'}</strong>
          <span>Sub-Contract</span><strong>{techDetails.subcontractorName || '-'}</strong>
          <span>Reason For Visit</span><strong>{draftJob.reasonForVisit}</strong>
        </div>
      </section>
      <section className="print-section">
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
      </section>
      <section className="print-section">
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
      </section>
      <section className="totals print-section print-totals">
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
      </section>
      <section className="print-section">
        <h3>Tech Summary</h3>
        <div className="print-grid">
          <span>New String Brand</span><strong>{techDetails.newStringBrand || '-'}</strong>
          <span>New String Gauge</span><strong>{techDetails.newStringGauge || '-'}</strong>
        </div>
      </section>
      {techDetails.neckInspection?.final && (
        <section className="print-section print-neck-inspection">
          <h3>Final Neck Inspection</h3>
          <table>
            <tbody>
              <tr>
                <td>Relief</td>
                <td>{formatLength(finalNeckInspection.relief, finalNeckInspection.reliefUnit || finalLengthUnit) || '-'}</td>
              </tr>
              <tr>
                <td>Action {outerStringLabels.treble} / {outerStringLabels.bass} @ 3rd</td>
                <td>{formatLength(finalNeckInspection.nutHighE, finalNeckInspection.nutHighEUnit || finalLengthUnit) || '-'} / {formatLength(finalNeckInspection.nutLowE, finalNeckInspection.nutLowEUnit || finalLengthUnit) || '-'}</td>
              </tr>
              <tr>
                <td>Action {outerStringLabels.treble} / {outerStringLabels.bass} @ 12th</td>
                <td>{formatLength(finalNeckInspection.actionHighE12th, finalNeckInspection.actionHighE12thUnit || finalLengthUnit) || '-'} / {formatLength(finalNeckInspection.actionLowE12th, finalNeckInspection.actionLowE12thUnit || finalLengthUnit) || '-'}</td>
              </tr>
              <tr>
                <td>Fret Condition</td>
                <td>{finalNeckInspection.fretCondition || '-'}</td>
              </tr>
              <tr>
                <td>Neck Condition</td>
                <td>{finalNeckInspection.neckCondition || '-'}</td>
              </tr>
              <tr>
                <td>Truss Rod</td>
                <td>{finalNeckInspection.trussRodStatus || '-'}</td>
              </tr>
              <tr>
                <td>Flags</td>
                <td>{finalFlags.join(', ') || '-'}</td>
              </tr>
              <tr>
                <td>Fret Notes</td>
                <td>{finalNeckInspection.fretNotes || '-'}</td>
              </tr>
              <tr>
                <td>Notes</td>
                <td>{finalNeckInspection.notes || '-'}</td>
              </tr>
            </tbody>
          </table>
        </section>
      )}
      {printFooterText && <p className="print-footer-text">{printFooterText}</p>}
    </section>
  );
}
