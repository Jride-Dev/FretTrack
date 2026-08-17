import JobInfoSection from './JobInfoSection';

export default function JobIntakeSections({
  canWrite,
  amplifierRepairEnabled,
  keyboardRepairEnabled,
  draftJob,
  intakeTypes,
  normalizeInstrumentType,
  onContactPreferenceChange,
  onFieldChange,
  onInstrumentTypeChange,
  onStringCountChange,
  onTechFieldChange
}) {
  return (
    <JobInfoSection
      canWrite={canWrite}
      amplifierRepairEnabled={amplifierRepairEnabled}
      keyboardRepairEnabled={keyboardRepairEnabled}
      draftJob={draftJob}
      intakeTypes={intakeTypes}
      normalizeInstrumentType={normalizeInstrumentType}
      setInstrumentType={onInstrumentTypeChange}
      updateStringCount={onStringCountChange}
      updateContactPreference={onContactPreferenceChange}
      updateField={onFieldChange}
      updateTechField={onTechFieldChange}
    />
  );
}
