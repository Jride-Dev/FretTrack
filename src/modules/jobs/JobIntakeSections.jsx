import JobInfoSection from './JobInfoSection';

export default function JobIntakeSections({
  canWrite,
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
