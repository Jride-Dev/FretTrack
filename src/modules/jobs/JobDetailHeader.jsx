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
  onDocumentTypeChange,
  onAssignmentChanged,
  onNotice,
  canManageAccountingVoid = false,
  onAccountingVoidChange
}) {
  const isEstimate = draftJob.documentType === 'estimate';
  return (
    <>
      <WorkspacePageHeader
        eyebrow={`${draftJob.instrumentType || draftJob.techDetails?.instrumentType || 'Instrument'} ${isEstimate ? 'estimate' : 'work order'}${draftJob.jobNumber ? ` · ${draftJob.jobNumber}` : ''}`}
        title={draftJob.customerName || 'Unnamed Customer'}
        description={[draftJob.guitarBrand, draftJob.model].filter(Boolean).join(' ') || 'Instrument details not yet recorded'}
        actions={(
          <div className="job-header-controls">
            <label>
              Document Type
              <select value={draftJob.documentType || 'work_order'} onChange={(event) => onDocumentTypeChange?.(event.target.value)} disabled={!canWrite}>
                <option value="work_order">Work Order</option>
                <option value="estimate">Estimate</option>
              </select>
            </label>
            <JobStatusSelect canWrite={canWrite} value={draftJob.status} onChange={onStatusChange} />
          </div>
        )}
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
