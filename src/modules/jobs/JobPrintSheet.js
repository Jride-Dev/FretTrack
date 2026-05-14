import { retailTotal, rowQuantity } from '../billing/accounting';
import { getPrintFooterText, getShopSettings } from '../shops/shopConfig';
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
        <span>Date Received</span><strong>{draftJob.dateReceived}</strong>
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
              <td>{money((Number(row.retail) || 0) * rowQuantity(row))}</td>
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
              <td>{row.includedInService ? 'Included' : money(retailTotal(row))}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="totals">
        <span>Services</span>
        <strong>{money(totals.servicesTotal)}</strong>
        <span>Billable Parts</span>
        <strong>{money(totals.partsTotal)}</strong>
        <span>Included Parts</span>
        <strong>{money(totals.includedPartsTotal)}</strong>
        <span>Subtotal</span>
        <strong>{money(totals.subtotal)}</strong>
        <span>Discount</span>
        <strong>-{money(totals.discountAmount)}</strong>
        <span>Sales Tax</span>
        <strong>{money(totals.salesTaxAmount)}</strong>
        <span>Total Due</span>
        <strong>{money(totals.totalDue)}</strong>
        <span>Paid</span>
        <strong>{money(totals.paidTotal)}</strong>
        <span>Balance</span>
        <strong>{money(totals.balanceDue)}</strong>
      </div>
      {printFooterText && <p className="print-footer-text">{printFooterText}</p>}
    </section>
  );
}
