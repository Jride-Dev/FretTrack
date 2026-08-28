import { formatShopDate, formatShopDateTime } from '../../shared/utils/dateFormat.js';
import { money } from '../../shared/utils/money.js';
import { retailTotal } from '../billing/accounting.js';
import { normalizeAmplifierDetails } from '../amplifiers/amplifierRepair.js';
import { normalizeKeyboardDetails } from '../keyboards/keyboardRepair.js';
import { getPrintFooterText, getShopDateOptions, getShopMoneyOptions, getShopSettings } from '../shops/shopConfig.js';
import PrintDamageMapFigure from './PrintDamageMapFigure.jsx';
import './PrintStyles.css';

const DAMAGE_VIEW_ORDER = ['front', 'back', 'headstock', 'serial_number'];
const GUITAR_FAMILY = new Set(['electric', 'acoustic', 'bass']);

function display(value, fallback = '-') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function PrintFieldGrid({ rows }) {
  return (
    <dl className="print-document-fields">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{display(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

function GuitarInspection({ draftJob, formatMeasurementDelta, lengthUnit, outerStringLabels }) {
  const inspection = draftJob.techDetails?.neckInspection || {};
  const initial = inspection.initial || {};
  const final = inspection.final || {};
  const delta = (left, right) => formatMeasurementDelta?.(left, right, lengthUnit) || '-';

  return (
    <section className="print-document-section">
      <h3>Neck measurements</h3>
      <table className="print-document-table">
        <thead><tr><th scope="col">Measurement</th><th scope="col">Initial to final</th></tr></thead>
        <tbody>
          <tr><td>Relief ({lengthUnit})</td><td>{delta(initial.relief, final.relief)}</td></tr>
          <tr><td>Action {outerStringLabels.treble} at 3rd ({lengthUnit})</td><td>{delta(initial.nutHighE, final.nutHighE)}</td></tr>
          <tr><td>Action {outerStringLabels.bass} at 3rd ({lengthUnit})</td><td>{delta(initial.nutLowE, final.nutLowE)}</td></tr>
          <tr><td>Action {outerStringLabels.treble} at 12th ({lengthUnit})</td><td>{delta(initial.actionHighE12th, final.actionHighE12th)}</td></tr>
          <tr><td>Action {outerStringLabels.bass} at 12th ({lengthUnit})</td><td>{delta(initial.actionLowE12th, final.actionLowE12th)}</td></tr>
          <tr><td>Fret condition</td><td>{display(initial.fretCondition)} to {display(final.fretCondition)}</td></tr>
          <tr><td>Neck condition</td><td>{display(initial.neckCondition)} to {display(final.neckCondition)}</td></tr>
          <tr><td>Truss rod</td><td>{display(initial.trussRodStatus)} to {display(final.trussRodStatus)}</td></tr>
        </tbody>
      </table>
    </section>
  );
}

function SpecialistInspection({ draftJob, instrumentType }) {
  if (instrumentType === 'Amplifier') {
    const amplifier = normalizeAmplifierDetails(draftJob.techDetails?.amplifier);
    return (
      <section className="print-document-section">
        <h3>Amplifier inspection</h3>
        <PrintFieldGrid rows={[
          ['Configuration', [amplifier.amplifierType, amplifier.technology].filter(Boolean).join(' / ')],
          ['Safety and visual condition', amplifier.safetyNotes],
          ['Diagnosis', amplifier.diagnosis],
          ['Repair performed', amplifier.repairPerformed],
          ['Parts replaced', amplifier.partsReplaced],
          ['Bench test observations', amplifier.benchTestNotes],
          ['Final test', amplifier.finalTestStatus]
        ]} />
      </section>
    );
  }

  if (instrumentType === 'Keyboard') {
    const keyboard = normalizeKeyboardDetails(draftJob.techDetails?.keyboard);
    return (
      <section className="print-document-section">
        <h3>Keyboard inspection</h3>
        <PrintFieldGrid rows={[
          ['Keyboard profile', `${display(keyboard.keyCount, 'Unknown')} keys / ${display(keyboard.keyAction, 'Unknown')} / ${display(keyboard.sensorTechnology, 'Unknown')}`],
          ['Affected keys or range', keyboard.affectedKeys],
          ['Keybed and contact condition', keyboard.keybedNotes],
          ['Power supply readings', keyboard.powerSupplyReadings],
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

export default function PrintDamageReport({
  draftJob,
  formatInstrumentLabel,
  formatMeasurementDelta,
  lengthUnit = 'in',
  normalizeInstrumentType,
  outerStringLabels = { treble: 'High E', bass: 'Low E' },
  parts = [],
  services = [],
  shopSettings: providedShopSettings = null,
  workOrderImages = []
}) {
  const shopSettings = providedShopSettings || getShopSettings();
  const printFooterText = getPrintFooterText();
  const techDetails = draftJob.techDetails || {};
  const damageMap = techDetails.damageMap || {};
  const instrumentType = normalizeInstrumentType(draftJob.instrumentType || techDetails.instrumentType);
  const isGuitarFamily = GUITAR_FAMILY.has(String(instrumentType || '').toLowerCase());
  const dateOptions = getShopDateOptions({
    dateFormat: techDetails.tax?.dateFormat || shopSettings.dateFormat,
    locale: techDetails.tax?.locale || shopSettings.locale
  });
  const moneyOptions = getShopMoneyOptions(techDetails.tax || shopSettings);
  const printableWorkOrderImages = workOrderImages.filter((image) => image.url);
  const workLog = Array.isArray(draftJob.workLog) ? draftJob.workLog : [];
  const hasDamageEvidence = DAMAGE_VIEW_ORDER.some((viewName) => {
    const view = damageMap.views?.[viewName] || {};
    return Boolean(view.imageUrl || view.storagePath || view.imageId || view.marks?.length);
  });

  return (
    <article className="print-damage-report" data-print-document="customer-report">
      <header className="print-document-header">
        <img src={shopSettings.logoUrl || '/frettrack-wordmark.jpg'} alt={shopSettings.shopName || 'FretTrack'} decoding="sync" />
        <div>
          <p className="print-document-kicker">Customer copy</p>
          <h1>Service and Condition Report</h1>
          <p>{display(shopSettings.shopName, 'FretTrack')} | Work order {display(draftJob.jobNumber)}</p>
          {shopSettings.address && <p>{shopSettings.address}</p>}
          <p>{[shopSettings.phone, shopSettings.email].filter(Boolean).join(' | ')}</p>
        </div>
      </header>

      <section className="print-document-section print-document-summary">
        <h2>Work order summary</h2>
        <PrintFieldGrid rows={[
          ['Customer', draftJob.customerName],
          ['Phone', draftJob.phone],
          ['Email', draftJob.email],
          ['Instrument', formatInstrumentLabel ? formatInstrumentLabel(draftJob) : instrumentType],
          ['Brand / model', [draftJob.guitarBrand, draftJob.model].filter(Boolean).join(' ')],
          ['Serial number', draftJob.serial],
          ['Date received', formatShopDate(draftJob.dateReceived, dateOptions)],
          ['Reported concern', draftJob.reasonForVisit]
        ]} />
      </section>

      {hasDamageEvidence && (
        <section className="print-document-section print-condition-section">
          <h2>Documented condition</h2>
          <p className="print-document-intro">Numbered markers correspond to the condition notes recorded by the shop.</p>
          {DAMAGE_VIEW_ORDER.map((viewName) => (
            <PrintDamageMapFigure key={viewName} damageMap={damageMap} viewName={viewName} />
          ))}
        </section>
      )}

      {isGuitarFamily
        ? <GuitarInspection draftJob={draftJob} formatMeasurementDelta={formatMeasurementDelta} lengthUnit={lengthUnit} outerStringLabels={outerStringLabels} />
        : <SpecialistInspection draftJob={draftJob} instrumentType={instrumentType} />}

      <section className="print-document-section">
        <h2>Work performed</h2>
        {(services.length > 0 || workLog.length > 0) ? (
          <table className="print-document-table">
            <thead><tr><th scope="col">Date / item</th><th scope="col">Details</th><th scope="col">Qty</th></tr></thead>
            <tbody>
              {services.map((row) => (
                <tr key={row.id}><td>Service</td><td>{display(row.description)}</td><td>{row.quantity || 1}</td></tr>
              ))}
              {workLog.map((entry) => (
                <tr key={entry.id}><td>{formatShopDateTime(entry.timestamp, dateOptions) || 'Work note'}</td><td>{display(entry.text)}</td><td>-</td></tr>
              ))}
            </tbody>
          </table>
        ) : <p>No completed work entries were recorded.</p>}
      </section>

      {parts.length > 0 && (
        <section className="print-document-section">
          <h2>Parts</h2>
          <table className="print-document-table">
            <thead><tr><th scope="col">Part</th><th scope="col">Qty</th><th scope="col">Unit price</th><th scope="col">Line total</th></tr></thead>
            <tbody>
              {parts.map((row) => (
                <tr key={row.id}>
                  <td>{row.sku ? `${row.sku} - ${row.name}` : display(row.name)}</td>
                  <td>{row.quantity || 1}</td>
                  <td>{money(Number(row.retail) || 0, moneyOptions)}</td>
                  <td>{row.includedInService ? 'Included' : money(retailTotal(row), moneyOptions)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="print-document-section print-authorization-section">
        <h2>Authorization and acknowledgment</h2>
        <p>{damageMap.liabilityText || 'Customer acknowledges the documented condition and authorizes the work recorded by the shop.'}</p>
        {isGuitarFamily && <p><strong>Damage acknowledgment recorded:</strong> {damageMap.liabilityAcknowledged ? 'Yes' : 'No'}</p>}
      </section>

      {printableWorkOrderImages.length > 0 && (
        <section className="print-document-section print-document-photos">
          <h2>Work order pictures</h2>
          <div className="print-document-photo-grid">
            {printableWorkOrderImages.map((image) => (
              <figure key={image.id}>
                <img src={image.url} alt={image.name || image.fileName || 'Work order upload'} decoding="sync" />
                <figcaption>{image.name || image.fileName || 'Work order picture'}</figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      <section className="print-document-signatures">
        <span>Customer signature</span>
        <span>Date</span>
      </section>
      {printFooterText && <footer className="print-document-footer">{printFooterText}</footer>}
    </article>
  );
}
