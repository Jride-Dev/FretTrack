import DamageMapSection from './DamageMapSection';
import TechDetailsSection from './TechDetailsSection';
import { normalizeInstrumentType } from '../instruments/instrumentService';
import AmplifierElectricalMeasurements from '../amplifiers/AmplifierElectricalMeasurements.jsx';
import {
  AMPLIFIER_FINAL_TEST_STATUSES,
  normalizeAmplifierDetails
} from '../amplifiers/amplifierRepair.js';
import KeyboardDiagnosticChecklist from '../keyboards/KeyboardDiagnosticChecklist.jsx';
import KeyboardFunctionalTests from '../keyboards/KeyboardFunctionalTests.jsx';
import {
  KEYBOARD_FINAL_TEST_STATUSES,
  normalizeKeyboardDetails
} from '../keyboards/keyboardRepair.js';

function SpecialistInspectionField({ children, name, value, onChange, canWrite, rows = 3 }) {
  return (
    <label className="wide">
      {children}
      <textarea name={name} value={value} onChange={(event) => onChange(event.target.value)} rows={rows} disabled={!canWrite} />
    </label>
  );
}

export default function JobInspectionSections({
  canWrite,
  draftJob,
  formatMeasurementDelta,
  lengthUnit,
  outerStringLabels,
  onDamageMapChange,
  onDamageViewImageUpload,
  onNeckInspectionChange,
  onStringGaugeChange,
  onStringGaugesChange,
  onSpecialistFieldChange,
  onTechFieldChange
}) {
  const instrumentType = normalizeInstrumentType(draftJob.instrumentType || draftJob.techDetails?.instrumentType);

  if (instrumentType === 'Amplifier') {
    const amplifier = normalizeAmplifierDetails(draftJob.techDetails?.amplifier);
    return (
      <div className="specialist-inspection specialist-amplifier-inspection">
        <section className="panel">
          <h3>Amplifier Inspection</h3>
          <p className="muted-text">Document received condition, safety observations, electrical results, and final verification for this amplifier.</p>
          <div className="form-grid amplifier-bench-grid">
            <SpecialistInspectionField name="safetyNotes" value={amplifier.safetyNotes} canWrite={canWrite} onChange={(value) => onSpecialistFieldChange(['amplifier', 'safetyNotes'], value)}>
              Safety / Visual Condition
            </SpecialistInspectionField>
            <SpecialistInspectionField name="diagnosis" value={amplifier.diagnosis} canWrite={canWrite} rows={4} onChange={(value) => onSpecialistFieldChange(['amplifier', 'diagnosis'], value)}>
              Amplifier Diagnosis
            </SpecialistInspectionField>
            <SpecialistInspectionField name="benchTestNotes" value={amplifier.benchTestNotes} canWrite={canWrite} rows={4} onChange={(value) => onSpecialistFieldChange(['amplifier', 'benchTestNotes'], value)}>
              Bench Test Observations
            </SpecialistInspectionField>
            <label>
              Amplifier Final Test
              <select value={amplifier.finalTestStatus} onChange={(event) => onSpecialistFieldChange(['amplifier', 'finalTestStatus'], event.target.value)} disabled={!canWrite}>
                {AMPLIFIER_FINAL_TEST_STATUSES.map((value) => <option key={value}>{value}</option>)}
              </select>
            </label>
          </div>
        </section>
        <AmplifierElectricalMeasurements
          amplifier={amplifier}
          canWrite={canWrite}
          onMeasurementChange={(stage, name, value) => onSpecialistFieldChange(['amplifier', 'electricalMeasurements', stage, name], value)}
          onDigitalChange={(name, value) => onSpecialistFieldChange(['amplifier', 'digitalDiagnostics', name], value)}
        />
      </div>
    );
  }

  if (instrumentType === 'Keyboard') {
    const keyboard = normalizeKeyboardDetails(draftJob.techDetails?.keyboard);
    return (
      <div className="specialist-inspection specialist-keyboard-inspection">
        <section className="panel">
          <h3>Keyboard Inspection</h3>
          <p className="muted-text">Document keybed, contacts, power, controls, MIDI behavior, and final functional verification for this keyboard.</p>
          <div className="form-grid keyboard-bench-grid amplifier-bench-grid">
            <SpecialistInspectionField name="affectedKeys" value={keyboard.affectedKeys} canWrite={canWrite} onChange={(value) => onSpecialistFieldChange(['keyboard', 'affectedKeys'], value)}>
              Affected Keys / Key Range
            </SpecialistInspectionField>
            <SpecialistInspectionField name="keybedNotes" value={keyboard.keybedNotes} canWrite={canWrite} rows={4} onChange={(value) => onSpecialistFieldChange(['keyboard', 'keybedNotes'], value)}>
              Keybed / Contact Inspection
            </SpecialistInspectionField>
            <SpecialistInspectionField name="powerSupplyReadings" value={keyboard.powerSupplyReadings} canWrite={canWrite} onChange={(value) => onSpecialistFieldChange(['keyboard', 'powerSupplyReadings'], value)}>
              Power Supply Readings
            </SpecialistInspectionField>
            <SpecialistInspectionField name="initialTestNotes" value={keyboard.initialTestNotes} canWrite={canWrite} rows={4} onChange={(value) => onSpecialistFieldChange(['keyboard', 'initialTestNotes'], value)}>
              Initial Keyboard Test Notes
            </SpecialistInspectionField>
            <SpecialistInspectionField name="midiDiagnosticSummary" value={keyboard.midiDiagnosticSummary} canWrite={canWrite} onChange={(value) => onSpecialistFieldChange(['keyboard', 'midiDiagnosticSummary'], value)}>
              MIDI Diagnostic Summary
            </SpecialistInspectionField>
            <SpecialistInspectionField name="finalTestNotes" value={keyboard.finalTestNotes} canWrite={canWrite} rows={4} onChange={(value) => onSpecialistFieldChange(['keyboard', 'finalTestNotes'], value)}>
              Final Keyboard Test Notes
            </SpecialistInspectionField>
            <label>
              Keyboard Final Test
              <select value={keyboard.finalTestStatus} onChange={(event) => onSpecialistFieldChange(['keyboard', 'finalTestStatus'], event.target.value)} disabled={!canWrite}>
                {KEYBOARD_FINAL_TEST_STATUSES.map((value) => <option key={value}>{value}</option>)}
              </select>
            </label>
          </div>
        </section>
        <KeyboardFunctionalTests
          keyboard={keyboard}
          canWrite={canWrite}
          onChange={(stage, name, value) => onSpecialistFieldChange(['keyboard', 'functionalTests', stage, name], value)}
        />
        <KeyboardDiagnosticChecklist
          keyboard={keyboard}
          canWrite={canWrite}
          onChange={(value) => onSpecialistFieldChange(['keyboard', 'diagnosticChecklist'], value)}
        />
      </div>
    );
  }

  return (
    <>
      <TechDetailsSection
        canWrite={canWrite}
        draftJob={draftJob}
        formatMeasurementDelta={formatMeasurementDelta}
        lengthUnit={lengthUnit}
        outerStringLabels={outerStringLabels}
        updateNeckInspection={onNeckInspectionChange}
        updateStringGauge={onStringGaugeChange}
        updateStringGauges={onStringGaugesChange}
        updateTechField={onTechFieldChange}
      />
      <DamageMapSection
        canWrite={canWrite}
        instrumentType={normalizeInstrumentType(draftJob.instrumentType)}
        damageMap={draftJob.techDetails.damageMap}
        onChange={onDamageMapChange}
        onViewImageUpload={onDamageViewImageUpload}
      />
    </>
  );
}
