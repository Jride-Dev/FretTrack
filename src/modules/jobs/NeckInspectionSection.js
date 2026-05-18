import { getLengthUnitLabel, normalizeLengthUnit, parseLengthInput } from '../../shared/utils/measurements';

export default function NeckInspectionSection({
  lengthUnit = 'in',
  techDetails,
  formatMeasurementDelta,
  updateNeckInspection
}) {
  const preferredUnit = normalizeLengthUnit(lengthUnit);

  function getStageLengthUnit(stage) {
    return normalizeLengthUnit(stage.lengthUnit || stage.reliefUnit, preferredUnit);
  }

  function updateLengthField(stageKey, field, value, unit) {
    const parsed = parseLengthInput(value, unit);
    updateNeckInspection(stageKey, {
      [field]: parsed.value,
      [`${field}Unit`]: parsed.unit,
      lengthUnit: parsed.unit
    });
  }

  function renderNeckStage(stageKey, title) {
    const stage = techDetails.neckInspection?.[stageKey] || {};
    const stageLengthUnit = getStageLengthUnit(stage);
    const unitLabel = getLengthUnitLabel(stageLengthUnit);
    return (
      <fieldset className="neck-stage">
        <legend>{title}</legend>
        <label>
          Relief ({unitLabel})
          <input value={stage.relief || ''} onChange={(event) => updateLengthField(stageKey, 'relief', event.target.value, stageLengthUnit)} />
        </label>
        <label>
          Relief Unit
          <select
            value={stage.reliefUnit || stageLengthUnit}
            onChange={(event) => {
              updateNeckInspection(stageKey, 'reliefUnit', event.target.value);
              updateNeckInspection(stageKey, 'lengthUnit', event.target.value);
            }}
          >
            <option value="in">inches</option>
            <option value="mm">mm</option>
          </select>
        </label>
        <label className="wide">
          Method
          <input value={stage.reliefMethod || ''} onChange={(event) => updateNeckInspection(stageKey, 'reliefMethod', event.target.value)} />
        </label>
        <label>
          Action High E @ 3rd ({unitLabel})
          <input value={stage.nutHighE || ''} onChange={(event) => updateLengthField(stageKey, 'nutHighE', event.target.value, stageLengthUnit)} />
        </label>
        <label>
          Action Low E @ 3rd ({unitLabel})
          <input value={stage.nutLowE || ''} onChange={(event) => updateLengthField(stageKey, 'nutLowE', event.target.value, stageLengthUnit)} />
        </label>
        <label>
          Action High E @ 12th ({unitLabel})
          <input value={stage.actionHighE12th || ''} onChange={(event) => updateLengthField(stageKey, 'actionHighE12th', event.target.value, stageLengthUnit)} />
        </label>
        <label>
          Action Low E @ 12th ({unitLabel})
          <input value={stage.actionLowE12th || ''} onChange={(event) => updateLengthField(stageKey, 'actionLowE12th', event.target.value, stageLengthUnit)} />
        </label>
        <label>
          3rd Fret Height
          <select value={stage.nutStatus || 'OK'} onChange={(event) => updateNeckInspection(stageKey, 'nutStatus', event.target.value)}>
            <option value="OK">OK</option>
            <option value="High">High</option>
            <option value="Low">Low</option>
          </select>
        </label>
        <label>
          Fret Condition
          <select value={stage.fretCondition || 'Good'} onChange={(event) => updateNeckInspection(stageKey, 'fretCondition', event.target.value)}>
            <option value="Good">Good</option>
            <option value="Minor wear">Minor wear</option>
            <option value="Needs level">Needs level</option>
            <option value="Needs refret">Needs refret</option>
          </select>
        </label>
        <label>
          Neck Condition
          <select value={stage.neckCondition || 'Straight'} onChange={(event) => updateNeckInspection(stageKey, 'neckCondition', event.target.value)}>
            <option value="Straight">Straight</option>
            <option value="Backbow">Backbow</option>
            <option value="Upbow">Upbow</option>
            <option value="Twist">Twist</option>
          </select>
        </label>
        <label>
          Truss Rod
          <select value={stage.trussRodStatus || 'Unknown'} onChange={(event) => updateNeckInspection(stageKey, 'trussRodStatus', event.target.value)}>
            <option value="Working">Working</option>
            <option value="Maxed">Maxed</option>
            <option value="Frozen">Frozen</option>
            <option value="Unknown">Unknown</option>
          </select>
        </label>
        <label className="checkline">
          <input type="checkbox" checked={Boolean(stage.twist)} onChange={(event) => updateNeckInspection(stageKey, 'twist', event.target.checked)} />
          Twist
        </label>
        <label className="checkline">
          <input type="checkbox" checked={Boolean(stage.buzzPresent)} onChange={(event) => updateNeckInspection(stageKey, 'buzzPresent', event.target.checked)} />
          Buzz present
        </label>
        <label className="checkline">
          <input type="checkbox" checked={Boolean(stage.deadSpots)} onChange={(event) => updateNeckInspection(stageKey, 'deadSpots', event.target.checked)} />
          Dead spots
        </label>
        <label className="checkline">
          <input type="checkbox" checked={Boolean(stage.highFrets)} onChange={(event) => updateNeckInspection(stageKey, 'highFrets', event.target.checked)} />
          High frets
        </label>
        <label className="wide">
          Fret Notes
          <textarea value={stage.fretNotes || ''} onChange={(event) => updateNeckInspection(stageKey, 'fretNotes', event.target.value)} rows="2" />
        </label>
        <label className="wide">
          Notes
          <textarea value={stage.notes || ''} onChange={(event) => updateNeckInspection(stageKey, 'notes', event.target.value)} rows="3" />
        </label>
      </fieldset>
    );
  }

  return (
    <>
      <div className="wide neck-inspection-grid">
        {renderNeckStage('initial', 'Initial Neck Inspection')}
        {renderNeckStage('final', 'Final Neck Inspection')}
      </div>
      <div className="wide neck-deltas">
        <strong>Measured Changes</strong>
        <span>Relief: {formatMeasurementDelta(techDetails.neckInspection?.initial?.relief, techDetails.neckInspection?.final?.relief, getStageLengthUnit(techDetails.neckInspection?.initial || {}))}</span>
        <span>Action High E @ 3rd: {formatMeasurementDelta(techDetails.neckInspection?.initial?.nutHighE, techDetails.neckInspection?.final?.nutHighE, getStageLengthUnit(techDetails.neckInspection?.initial || {}))}</span>
        <span>Action Low E @ 3rd: {formatMeasurementDelta(techDetails.neckInspection?.initial?.nutLowE, techDetails.neckInspection?.final?.nutLowE, getStageLengthUnit(techDetails.neckInspection?.initial || {}))}</span>
        <span>Action High E @ 12th: {formatMeasurementDelta(techDetails.neckInspection?.initial?.actionHighE12th, techDetails.neckInspection?.final?.actionHighE12th, getStageLengthUnit(techDetails.neckInspection?.initial || {}))}</span>
        <span>Action Low E @ 12th: {formatMeasurementDelta(techDetails.neckInspection?.initial?.actionLowE12th, techDetails.neckInspection?.final?.actionLowE12th, getStageLengthUnit(techDetails.neckInspection?.initial || {}))}</span>
      </div>
    </>
  );
}
