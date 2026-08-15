import JobInfoSection from './JobInfoSection';

export default function JobIntakeSections({
  canWrite,
  amplifierRepairEnabled,
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
