import UnsavedChangesBadge from '../../shared/components/UnsavedChangesBadge.jsx';
import JobAssignmentControl from './JobAssignmentControl.jsx';
import JobStatusSelect from './JobStatusSelect.jsx';
import JobAccountingVoidControl from './JobAccountingVoidControl.jsx';

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
      <div className="detail-header">
        <div>
          <h2>{draftJob.customerName}</h2>
          <p>
            {draftJob.guitarBrand} {draftJob.model} {draftJob.jobNumber ? `- Job ${draftJob.jobNumber}` : ''}
          </p>
        </div>
        <JobStatusSelect canWrite={canWrite} value={draftJob.status} onChange={onStatusChange} />
      </div>
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
