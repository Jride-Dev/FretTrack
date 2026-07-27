import { useMemo, useState } from 'react';
import {
  canManageJobAssignment,
  canSelfAssignJob,
  getAvailableAssignmentChoices,
  resolveJobAssignee
} from './teamAssignment.js';
import { updateJobAssignment } from './teamAssignmentService.js';

export default function JobAssignmentControl({
  job,
  members = [],
  membersError = '',
  membersLoading = false,
  membership = null,
  entitlementSnapshot = null,
  betaApproved = false,
  onAssignmentChanged,
  onNotice
}) {
  const [isSaving, setIsSaving] = useState(false);
  const shopId = job?.shopId || '';
  const assignedMemberId = job?.assignedMemberId || '';
  const assignee = resolveJobAssignee(job, members, shopId);
  const canManage = canManageJobAssignment({
    role: membership?.role,
    entitlementSnapshot,
    betaApproved,
    shopId: membership?.shopId || '',
    jobShopId: shopId
  });
  const canClaim = canSelfAssignJob({
    role: membership?.role,
    entitlementSnapshot,
    betaApproved,
    shopId: membership?.shopId || '',
    jobShopId: shopId,
    currentMemberId: membership?.id || '',
    assignedMemberId,
    nextAssignedMemberId: membership?.id || ''
  });
  const canRemoveSelf = canSelfAssignJob({
    role: membership?.role,
    entitlementSnapshot,
    betaApproved,
    shopId: membership?.shopId || '',
    jobShopId: shopId,
    currentMemberId: membership?.id || '',
    assignedMemberId,
    nextAssignedMemberId: ''
  });
  const choices = useMemo(() => getAvailableAssignmentChoices({
    members,
    role: membership?.role,
    currentMemberId: membership?.id || '',
    shopId,
    canManage
  }), [canManage, members, membership?.id, membership?.role, shopId]);

  async function saveAssignment(nextAssignedMemberId) {
    if (isSaving || nextAssignedMemberId === assignedMemberId) {
      return;
    }
    setIsSaving(true);
    try {
      const assignment = await updateJobAssignment({
        jobId: job.id,
        shopId,
        assignedMemberId: nextAssignedMemberId,
        expectedAssignmentUpdatedAt: job.assignmentUpdatedAt || null
      });
      onAssignmentChanged?.(assignment);
      onNotice?.({
        type: 'success',
        message: nextAssignedMemberId ? 'Assigned technician updated.' : 'Job assignment cleared.'
      });
    } catch (error) {
      onNotice?.({
        type: 'error',
        message: error instanceof Error ? error.message : 'Unable to update the assigned technician.'
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="job-assignment-control no-print" aria-labelledby="job-assignment-title">
      <div>
        <h3 id="job-assignment-title">Assigned Technician</h3>
        <p className="muted-text">
          {assignee.name}
          {assignee.historical && !membersLoading && !membersError ? ' (inactive or removed)' : ''}
        </p>
      </div>

      {membersLoading && <p className="muted-text">Loading active shop members...</p>}
      {membersError && <p className="form-error" role="alert">{membersError}</p>}

      {canManage && (
        <label>
          Assignment
          <select
            value={assignedMemberId}
            onChange={(event) => saveAssignment(event.target.value)}
            disabled={isSaving || membersLoading || Boolean(membersError)}
          >
            <option value="">Unassigned</option>
            {choices.map((member) => (
              <option key={member.id} value={member.id}>{member.displayName || 'Team member'}</option>
            ))}
            {assignedMemberId && !choices.some((member) => member.id === assignedMemberId) && (
              <option value={assignedMemberId} disabled>
                {assignee.name}{!membersLoading && !membersError ? ' (inactive or removed)' : ''}
              </option>
            )}
          </select>
        </label>
      )}

      {!canManage && canClaim && (
        <button type="button" onClick={() => saveAssignment(membership.id)} disabled={isSaving}>
          {isSaving ? 'Assigning...' : 'Assign myself'}
        </button>
      )}

      {!canManage && canRemoveSelf && (
        <button type="button" onClick={() => saveAssignment('')} disabled={isSaving}>
          {isSaving ? 'Removing...' : 'Remove myself'}
        </button>
      )}

      {!canManage && !canClaim && !canRemoveSelf && (
        <p className="muted-text">Assignment is read-only for your current role or plan.</p>
      )}

      {!membersLoading && !membersError && canManage && choices.length === 0 && (
        <p className="muted-text">No active shop members are available for assignment.</p>
      )}
    </section>
  );
}
