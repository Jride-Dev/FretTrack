import NeckInspectionSection from './NeckInspectionSection';
import { getGaugeSlotLabel, getInstrumentStringCount } from '../instruments/instrumentService';

export default function TechDetailsSection({
  draftJob,
  formatMeasurementDelta,
  lengthUnit,
  outerStringLabels,
  updateNeckInspection,
  updateStringGauge,
  updateTechField
}) {
  return (
    <section>
      <h3>Tech Details</h3>
      <div className="form-grid">
        <fieldset className="wide string-gauges">
          <legend>String Gauges</legend>
          {draftJob.techDetails.stringGauges.map((gauge, index) => (
            <label key={index}>
              {getGaugeSlotLabel(index, getInstrumentStringCount(draftJob), draftJob.instrumentType)}
              <input
                value={gauge}
                onChange={(event) => updateStringGauge(index, event.target.value)}
              />
            </label>
          ))}
        </fieldset>
        <label>
          New String Brand
          <input name="newStringBrand" value={draftJob.techDetails.newStringBrand} onChange={updateTechField} />
        </label>
        <label>
          New String Gauge
          <input name="newStringGauge" value={draftJob.techDetails.newStringGauge} onChange={updateTechField} />
        </label>
        <NeckInspectionSection
          lengthUnit={lengthUnit}
          outerStringLabels={outerStringLabels}
          techDetails={draftJob.techDetails}
          formatMeasurementDelta={formatMeasurementDelta}
          updateNeckInspection={updateNeckInspection}
        />
        <label className="wide">
          Notes
          <textarea name="notes" value={draftJob.techDetails.notes} onChange={updateTechField} rows="6" />
        </label>
      </div>
    </section>
  );
}
