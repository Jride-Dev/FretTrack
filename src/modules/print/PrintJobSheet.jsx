import { formatShopDate } from '../../shared/utils/dateFormat.js';
import { formatLength } from '../../shared/utils/measurements.js';
import { money } from '../../shared/utils/money.js';
import { retailTotal, rowQuantity } from '../billing/accounting.js';
import { normalizeAmplifierDetails } from '../amplifiers/amplifierRepair.js';
import { normalizeKeyboardDetails } from '../keyboards/keyboardRepair.js';
import { getJobSourceLabel } from '../jobs/jobSources.js';
import { getPrintFooterText, getShopDateOptions, getShopMoneyOptions, getShopSettings } from '../shops/shopConfig.js';
import './PrintStyles.css';

const GUITAR_FAMILY = new Set(['electric', 'acoustic', 'bass']);

function display(value, fallback = '-') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function FieldGrid({ rows }) {
  return (
    <dl className="print-document-fields">
      {rows.map(([label, value]) => (
        <div key={label}><dt>{label}</dt><dd>{display(value)}</dd></div>
      ))}
    </dl>
  );
}

function GuitarFinalInspection({ techDetails, lengthUnit, outerStringLabels }) {
  const final = techDetails.neckInspection?.final;
  if (!final) return null;
  const flags = [
    final.twist ? 'Twist' : '',
    final.buzzPresent ? 'Buzz present' : '',
    final.deadSpots ? 'Dead spots' : '',
    final.highFrets ? 'High frets' : ''
  ].filter(Boolean);

  return (
    <section className="print-document-section">
      <h2>Final guitar inspection</h2>
      <FieldGrid rows={[
        [`Relief (${lengthUnit})`, formatLength(final.relief, lengthUnit)],
        [`Action ${outerStringLabels.treble} / ${outerStringLabels.bass} at 3rd (${lengthUnit})`, `${formatLength(final.nutHighE, lengthUnit) || '-'} / ${formatLength(final.nutLowE, lengthUnit) || '-'}`],
        [`Action ${outerStringLabels.treble} / ${outerStringLabels.bass} at 12th (${lengthUnit})`, `${formatLength(final.actionHighE12th, lengthUnit) || '-'} / ${formatLength(final.actionLowE12th, lengthUnit) || '-'}`],
        ['Fret condition', final.fretCondition],
        ['Neck condition', final.neckCondition],
        ['Truss rod', final.trussRodStatus],
        ['Inspection flags', flags.join(', ')],
        ['Final notes', final.notes]
      ]} />
    </section>
  );
}

function SpecialistFinalInspection({ techDetails, instrumentType }) {
  if (instrumentType === 'Amplifier') {
    const amplifier = normalizeAmplifierDetails(techDetails.amplifier);
    return (
      <section className="print-document-section">
        <h2>Amplifier service summary</h2>
        <FieldGrid rows={[
          ['Configuration', [amplifier.amplifierType, amplifier.technology].filter(Boolean).join(' / ')],
          ['Diagnosis', amplifier.diagnosis],
          ['Repair performed', amplifier.repairPerformed],
          ['Parts replaced', amplifier.partsReplaced],
          ['Bench test', amplifier.benchTestNotes],
          ['Final test', amplifier.finalTestStatus]
        ]} />
      </section>
    );
  }

  if (instrumentType === 'Keyboard') {
    const keyboard = normalizeKeyboardDetails(techDetails.keyboard);
    return (
      <section className="print-document-section">
        <h2>Keyboard service summary</h2>
        <FieldGrid rows={[
          ['Keyboard profile', `${display(keyboard.keyCount, 'Unknown')} keys / ${display(keyboard.keyAction, 'Unknown')} / ${display(keyboard.sensorTechnology, 'Unknown')}`],
          ['Affected keys or range', keyboard.affectedKeys],
          ['MIDI diagnostic summary', keyboard.midiDiagnosticSummary],
          ['Diagnosis', keyboard.diagnosis],
          ['Repair performed', keyboard.repairPerformed],
          ['Final test notes', keyboard.finalTestNotes],
          ['Final test', keyboard.finalTestStatus]
        ]} />
      </section>
    );
  }

  return null;
}

export default function PrintJobSheet({
  draftJob,
  documentType = 'work_order',
  formatInstrumentLabel,
  lengthUnit = 'in',
  normalizeInstrumentType,
  outerStringLabels = { treble: 'High E', bass: 'Low E' },
  parts = [],
  services = [],
  shopSettings: providedShopSettings = null,
  totals
}) {
  const shopSettings = providedShopSettings || getShopSettings();
  const printFooterText = getPrintFooterText();
  const techDetails = draftJob.techDetails || {};
  const taxSettings = techDetails.tax || {};
  const instrumentType = normalizeInstrumentType(draftJob.instrumentType || techDetails.instrumentType);
  const isGuitarFamily = GUITAR_FAMILY.has(String(instrumentType || '').toLowerCase());
  const moneyOptions = getShopMoneyOptions({
    currencyCode: shopSettings.currencyCode || taxSettings.currencyCode,
    locale: shopSettings.locale || taxSettings.locale
  });
  const dateOptions = getShopDateOptions({
    dateFormat: shopSettings.dateFormat || taxSettings.dateFormat,
    locale: shopSettings.locale || taxSettings.locale
  });
  const taxLabel = shopSettings.taxLabel || taxSettings.taxLabel || 'Sales Tax';
  const isEstimate = documentType === 'estimate';

  return (
    <article className="print-job-sheet" data-print-document="job-sheet">
      <header className="print-document-header">
        <img src={shopSettings.logoUrl || '/frettrack-wordmark.jpg'} alt={shopSettings.shopName || 'FretTrack'} decoding="sync" />
        <div>
          <p className="print-document-kicker">{isEstimate ? 'Customer copy' : 'Shop copy'}</p>
          <h1>{isEstimate ? 'Estimate' : 'Job Sheet'}</h1>
          <p>{display(shopSettings.shopName, 'FretTrack')} | {isEstimate ? 'Estimate' : 'Work order'} {display(draftJob.jobNumber)}</p>
          {draftJob.invoiceFinalizedAt && draftJob.invoiceNumber && <p>Invoice #{draftJob.invoiceNumber} | Revision {draftJob.invoiceRevision || 1}</p>}
          {shopSettings.address && <p className="print-shop-address">{shopSettings.address}</p>}
          <p>{[shopSettings.phone, shopSettings.email].filter(Boolean).join(' | ')}</p>
        </div>
      </header>

      <section className="print-document-section">
        <h2>{isEstimate ? 'Estimate summary' : 'Work order summary'}</h2>
        <FieldGrid rows={[
          ['Customer', draftJob.customerName],
          ['Phone', draftJob.phone],
          ['Email', draftJob.email],
          ['Instrument', formatInstrumentLabel ? formatInstrumentLabel(draftJob) : instrumentType],
          ['Brand / model', [draftJob.guitarBrand, draftJob.model].filter(Boolean).join(' ')],
          ['Serial number', draftJob.serial],
          ['Color', draftJob.color],
          ['Date received', formatShopDate(draftJob.dateReceived, dateOptions)],
          ['Status', draftJob.status],
          ['Job source', getJobSourceLabel(techDetails.intakeType)],
          ['Sub-contract', techDetails.subcontractorName],
          ['Reason for visit', draftJob.reasonForVisit]
        ]} />
      </section>

      <section className="print-document-section">
        <h2>Services</h2>
        {services.length > 0 ? (
          <table className="print-document-table">
            <thead><tr><th scope="col">Service</th><th scope="col">Qty</th><th scope="col">Line total</th></tr></thead>
            <tbody>{services.map((row) => (
              <tr key={row.id}><td>{display(row.description)}</td><td>{row.quantity || 1}</td><td>{money((Number(row.retail) || 0) * rowQuantity(row), moneyOptions)}</td></tr>
            ))}</tbody>
          </table>
        ) : <p>No services recorded.</p>}
      </section>

      <section className="print-document-section">
        <h2>Parts</h2>
        {parts.length > 0 ? (
          <table className="print-document-table">
            <thead><tr><th scope="col">Part</th><th scope="col">Qty</th><th scope="col">Unit price</th><th scope="col">Line total</th></tr></thead>
            <tbody>{parts.map((row) => (
              <tr key={row.id}>
                <td>{row.sku ? `${row.sku} - ${row.name}` : display(row.name)}</td>
                <td>{row.quantity || 1}</td>
                <td>{money(Number(row.retail) || 0, moneyOptions)}</td>
                <td>{row.includedInService ? 'Included' : money(retailTotal(row), moneyOptions)}</td>
              </tr>
            ))}</tbody>
          </table>
        ) : <p>No parts recorded.</p>}
      </section>

      <section className="print-document-section print-job-sheet-financials">
        <h2>{isEstimate ? 'Estimate summary' : 'Invoice summary'}</h2>
        <dl className="print-job-sheet-totals">
          <div><dt>Services</dt><dd>{money(totals.servicesTotal, moneyOptions)}</dd></div>
          <div><dt>Billable parts</dt><dd>{money(totals.partsTotal, moneyOptions)}</dd></div>
          <div><dt>Included parts</dt><dd>{money(totals.includedPartsTotal, moneyOptions)}</dd></div>
          <div><dt>Subtotal</dt><dd>{money(totals.subtotal, moneyOptions)}</dd></div>
          <div><dt>Discount</dt><dd>-{money(totals.discountAmount, moneyOptions)}</dd></div>
          <div><dt>{taxLabel}</dt><dd>{money(totals.salesTaxAmount, moneyOptions)}</dd></div>
          <div className="is-total"><dt>{isEstimate ? 'Estimated total' : 'Total due'}</dt><dd>{money(totals.totalDue, moneyOptions)}</dd></div>
          {!isEstimate && <div><dt>Paid</dt><dd>{money(totals.paidTotal, moneyOptions)}</dd></div>}
          {!isEstimate && <div className="is-balance"><dt>Balance</dt><dd>{money(totals.balanceDue, moneyOptions)}</dd></div>}
        </dl>
      </section>

      {isGuitarFamily ? (
        <>
          <section className="print-document-section">
            <h2>Guitar service summary</h2>
            <FieldGrid rows={[
              ['New string brand', techDetails.newStringBrand],
              ['New string gauge', techDetails.newStringGauge]
            ]} />
          </section>
          <GuitarFinalInspection techDetails={techDetails} lengthUnit={lengthUnit} outerStringLabels={outerStringLabels} />
        </>
      ) : <SpecialistFinalInspection techDetails={techDetails} instrumentType={instrumentType} />}

      {printFooterText && <footer className="print-document-footer">{printFooterText}</footer>}
    </article>
  );
}
