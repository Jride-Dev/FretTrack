import DamageMapSection from './DamageMapSection';
import TechDetailsSection from './TechDetailsSection';
import { normalizeInstrumentType } from '../instruments/instrumentService';

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
  onTechFieldChange
}) {
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
