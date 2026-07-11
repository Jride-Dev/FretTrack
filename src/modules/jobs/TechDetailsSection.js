import NeckInspectionSection from './NeckInspectionSection';
import { getGaugeSlotLabel, getInstrumentStringCount, getStringGaugePresets } from '../instruments/instrumentService';

export default function TechDetailsSection({
  canWrite = true,
  draftJob,
  formatMeasurementDelta,
  lengthUnit,
  outerStringLabels,
  updateNeckInspection,
  updateStringGauge,
  updateStringGauges,
  updateTechField
}) {
  const stringCount = getInstrumentStringCount(draftJob);
  const gaugePresets = getStringGaugePresets(draftJob.instrumentType, stringCount);

  return (
    <section>
      <h3>Tech Details</h3>
      <div className="form-grid">
        <fieldset className="wide string-gauges">
          <legend>String Gauges</legend>
          {gaugePresets.length > 0 && (
            <label className="wide string-gauge-preset">
              Gauge Preset
              <select
                value=""
                disabled={!canWrite}
                onChange={(event) => {
                  const preset = gaugePresets.find((option) => option.id === event.target.value);
                  if (preset && updateStringGauges) {
                    updateStringGauges(preset.gauges);
                  }
                }}
              >
                <option value="">Manual / custom</option>
                {gaugePresets.map((preset) => (
                  <option key={preset.id} value={preset.id}>{preset.label}</option>
                ))}
              </select>
            </label>
          )}
          {draftJob.techDetails.stringGauges.map((gauge, index) => (
            <label key={index}>
              {getGaugeSlotLabel(index, stringCount, draftJob.instrumentType)}
              <input
                value={gauge}
                onChange={(event) => updateStringGauge(index, event.target.value)}
                disabled={!canWrite}
              />
            </label>
          ))}
        </fieldset>
        <label>
          New String Brand
          <input name="newStringBrand" value={draftJob.techDetails.newStringBrand} onChange={updateTechField} disabled={!canWrite} />
        </label>
        <label>
          New String Gauge
          <input name="newStringGauge" value={draftJob.techDetails.newStringGauge} onChange={updateTechField} disabled={!canWrite} />
        </label>
        <NeckInspectionSection
          lengthUnit={lengthUnit}
          outerStringLabels={outerStringLabels}
          techDetails={draftJob.techDetails}
          formatMeasurementDelta={formatMeasurementDelta}
          updateNeckInspection={updateNeckInspection}
          canWrite={canWrite}
        />
        <label className="wide">
          Notes
          <textarea name="notes" value={draftJob.techDetails.notes} onChange={updateTechField} rows="6" disabled={!canWrite} />
        </label>
      </div>
    </section>
  );
}
