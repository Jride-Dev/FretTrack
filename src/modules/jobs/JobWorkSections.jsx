import ServicesList from '../../components/ServicesList';
import WorkLogSection from './WorkLogSection';

export default function JobWorkSections({
  canWrite,
  draftJob,
  onAddService,
  onAppendWorkLog,
  onRemoveService,
  onRemoveWorkLogEntry,
  onSaveWorkLogChanges,
  onUpdateService,
  onUpdateWorkLogEntry,
  service,
  services,
  setService,
  setWorkLogText,
  workLogText
}) {
  return (
    <>
      <WorkLogSection
        canWrite={canWrite}
        appendWorkLog={onAppendWorkLog}
        draftJob={draftJob}
        removeWorkLogEntry={onRemoveWorkLogEntry}
        saveWorkLogChanges={onSaveWorkLogChanges}
        setWorkLogText={setWorkLogText}
        updateWorkLogEntry={onUpdateWorkLogEntry}
        workLogText={workLogText}
      />
      <ServicesList
        canWrite={canWrite}
        services={services}
        service={service}
        setService={setService}
        onAddService={onAddService}
        onUpdateService={onUpdateService}
        onRemoveService={onRemoveService}
      />
    </>
  );
}
