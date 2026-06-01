import { formatShopDate, formatShopDateTime } from '../../shared/utils/dateFormat';
import { getPrintFooterText, getShopDateOptions, getShopSettings } from '../shops/shopConfig';

export default function CustomerDamageReport({
  draftJob,
  formatInstrumentLabel,
  formatMeasurementDelta,
  lengthUnit = 'in',
  outerStringLabels = { treble: 'High E', bass: 'Low E' },
  normalizeInstrumentType,
  reportDamageView,
  services,
  workOrderImages
}) {
  const shopSettings = getShopSettings();
  const printFooterText = getPrintFooterText();
  const dateOptions = getShopDateOptions({
    dateFormat: draftJob.techDetails?.tax?.dateFormat || shopSettings.dateFormat,
    locale: draftJob.techDetails?.tax?.locale || shopSettings.locale
  });
  const printableWorkOrderImages = workOrderImages.filter((image) => image.url);

  return (
    <section className="customer-report">
      <div className="print-invoice-header print-section">
        <img src={shopSettings.logoUrl || '/frettrack-wordmark.jpg'} alt={shopSettings.shopName || 'FretTrack Systems'} />
        <div>
          <h2>Customer Damage Acknowledgment</h2>
          <p>{shopSettings.shopName} | Job {draftJob.jobNumber}</p>
        </div>
      </div>
      <section className="print-section">
        <div className="print-grid print-job-summary">
          <span>Customer</span><strong>{draftJob.customerName}</strong>
          <span>Phone</span><strong>{draftJob.phone}</strong>
          <span>Instrument</span><strong>{formatInstrumentLabel ? formatInstrumentLabel(draftJob) : normalizeInstrumentType(draftJob.instrumentType)}</strong>
          <span>Brand / Model</span><strong>{draftJob.guitarBrand} {draftJob.model}</strong>
          <span>Serial</span><strong>{draftJob.serial}</strong>
          <span>Date Received</span><strong>{formatShopDate(draftJob.dateReceived, dateOptions)}</strong>
        </div>
      </section>
      {reportDamageView('front')}
      {reportDamageView('back')}
      <section className="print-section">
      <h3>Neck Measurements</h3>
      <table>
        <tbody>
          <tr>
            <td>Relief</td>
            <td>{formatMeasurementDelta(draftJob.techDetails.neckInspection?.initial?.relief, draftJob.techDetails.neckInspection?.final?.relief, lengthUnit)}</td>
          </tr>
          <tr>
            <td>Action {outerStringLabels.treble} @ 3rd</td>
            <td>{formatMeasurementDelta(draftJob.techDetails.neckInspection?.initial?.nutHighE, draftJob.techDetails.neckInspection?.final?.nutHighE, lengthUnit)}</td>
          </tr>
          <tr>
            <td>Action {outerStringLabels.bass} @ 3rd</td>
            <td>{formatMeasurementDelta(draftJob.techDetails.neckInspection?.initial?.nutLowE, draftJob.techDetails.neckInspection?.final?.nutLowE, lengthUnit)}</td>
          </tr>
          <tr>
            <td>Action {outerStringLabels.treble} @ 12th</td>
            <td>{formatMeasurementDelta(draftJob.techDetails.neckInspection?.initial?.actionHighE12th, draftJob.techDetails.neckInspection?.final?.actionHighE12th, lengthUnit)}</td>
          </tr>
          <tr>
            <td>Action {outerStringLabels.bass} @ 12th</td>
            <td>{formatMeasurementDelta(draftJob.techDetails.neckInspection?.initial?.actionLowE12th, draftJob.techDetails.neckInspection?.final?.actionLowE12th, lengthUnit)}</td>
          </tr>
          <tr>
            <td>Fret Condition</td>
            <td>{draftJob.techDetails.neckInspection?.initial?.fretCondition} -&gt; {draftJob.techDetails.neckInspection?.final?.fretCondition}</td>
          </tr>
          <tr>
            <td>Neck Condition</td>
            <td>{draftJob.techDetails.neckInspection?.initial?.neckCondition} -&gt; {draftJob.techDetails.neckInspection?.final?.neckCondition}</td>
          </tr>
          <tr>
            <td>Truss Rod</td>
            <td>{draftJob.techDetails.neckInspection?.initial?.trussRodStatus} -&gt; {draftJob.techDetails.neckInspection?.final?.trussRodStatus}</td>
          </tr>
        </tbody>
      </table>
      </section>
      <section className="print-section">
        <h3>Work Performed</h3>
        <table>
          <tbody>
            {services.map((row) => (
              <tr key={row.id}>
                <td>{row.description}</td>
                <td>{row.quantity || 1}</td>
              </tr>
            ))}
            {draftJob.workLog.map((entry) => (
              <tr key={entry.id}>
                <td>{formatShopDateTime(entry.timestamp, dateOptions)}</td>
                <td>{entry.text}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="print-section">
        <h3>Authorization</h3>
        <p>{draftJob.techDetails.damageMap?.liabilityText || 'Customer acknowledges documented condition and authorizes repair intake.'}</p>
        <p>Damage acknowledgment checked: {draftJob.techDetails.damageMap?.liabilityAcknowledged ? 'Yes' : 'No'}</p>
      </section>
      {printableWorkOrderImages.length > 0 && (
        <section className="work-order-photos print-section">
          <h3>Work Order Pictures</h3>
          <div className="work-order-photo-grid">
            {printableWorkOrderImages.map((image) => (
              <figure key={image.id} className="work-order-photo">
                <img src={image.url} alt={image.name || image.fileName || 'Work order upload'} />
                <figcaption>{image.name || image.fileName || 'Work order picture'}</figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}
      <section className="signature-grid print-section">
        <span>Customer Signature</span>
        <span>Date</span>
      </section>
      {printFooterText && <p className="print-footer-text">{printFooterText}</p>}
    </section>
  );
}
