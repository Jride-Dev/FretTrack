import UnsavedChangesBadge from '../../shared/components/UnsavedChangesBadge.jsx';
import JobAssignmentControl from './JobAssignmentControl.jsx';
import JobStatusSelect from './JobStatusSelect.jsx';
import JobAccountingVoidControl from './JobAccountingVoidControl.jsx';
import WorkspacePageHeader from '../../shared/components/WorkspacePageHeader.jsx';

export default function JobDetailHeader({
  draftJob,
  canWrite,
  isDirty,
  saveStatus,
  assignableMembers,
  assignableMembersLoading,
  assignableMembersError,
  membership,
  entitlementSnapshot,
  betaApproved,
  onStatusChange,
  onAssignmentChanged,
  onNotice,
  canManageAccountingVoid = false,
  onAccountingVoidChange
}) {
  return (
    <>
      <WorkspacePageHeader
        eyebrow={`${draftJob.instrumentType || draftJob.techDetails?.instrumentType || 'Instrument'} work order${draftJob.jobNumber ? ` · ${draftJob.jobNumber}` : ''}`}
        title={draftJob.customerName || 'Unnamed Customer'}
        description={[draftJob.guitarBrand, draftJob.model].filter(Boolean).join(' ') || 'Instrument details not yet recorded'}
        actions={<JobStatusSelect canWrite={canWrite} value={draftJob.status} onChange={onStatusChange} />}
      />
      <JobAssignmentControl
        job={draftJob}
        members={assignableMembers}
        membersError={assignableMembersError}
        membersLoading={assignableMembersLoading}
        membership={membership}
        entitlementSnapshot={entitlementSnapshot}
        betaApproved={betaApproved}
        onAssignmentChanged={onAssignmentChanged}
        onNotice={onNotice}
      />
      <JobAccountingVoidControl
        job={draftJob}
        canManage={canManageAccountingVoid}
        onChange={onAccountingVoidChange}
        onNotice={onNotice}
      />
      {(isDirty || saveStatus === 'saving' || saveStatus === 'error') && (
        <UnsavedChangesBadge
          state={saveStatus}
          reminder={isDirty ? 'Remember to save before leaving.' : ''}
        />
      )}
    </>
  );
}
