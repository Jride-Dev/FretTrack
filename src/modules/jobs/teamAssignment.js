import { isReadOnlyStatus, canUseTeamAssignment } from '../billing/entitlementService.js';
const ASSIGNMENT_MANAGE_ROLES = new Set(['owner', 'admin']);
const CLOSED_JOB_STATUSES = new Set(['completed', 'picked up', 'cancelled', 'archived']);

function normalizeRole(role) {
  return String(role || '').trim().toLowerCase();
}

export function listAssignableShopMembers(members = [], shopId = '') {
  if (!shopId) {
    return [];
  }

  return members
    .filter((member) => (
      member?.shopId === shopId
      && member?.id
      && member?.status === 'active'
    ))
    .sort((left, right) => (
      getMemberDisplayName(left).localeCompare(getMemberDisplayName(right))
    ));
}

export function canManageJobAssignment({
  role,
  entitlementSnapshot,
  betaApproved = false,
  shopId = '',
  jobShopId = ''
} = {}) {
  return Boolean(shopId)
    && shopId === jobShopId
    && ASSIGNMENT_MANAGE_ROLES.has(normalizeRole(role))
    && !isReadOnlyStatus(entitlementSnapshot)
    && canUseTeamAssignment(entitlementSnapshot, { betaApproved });
}

export function canSelfAssignJob({
  role,
  entitlementSnapshot,
  betaApproved = false,
  shopId = '',
  jobShopId = '',
  currentMemberId = '',
  assignedMemberId = '',
  nextAssignedMemberId = ''
} = {}) {
  if (
    normalizeRole(role) !== 'tech'
    || !currentMemberId
    || !shopId
    || shopId !== jobShopId
    || isReadOnlyStatus(entitlementSnapshot)
    || !canUseTeamAssignment(entitlementSnapshot, { betaApproved })
  ) {
    return false;
  }

  return (
    (!assignedMemberId && nextAssignedMemberId === currentMemberId)
    || (assignedMemberId === currentMemberId && !nextAssignedMemberId)
  );
}

export function canChangeJobAssignment(context = {}) {
  return canManageJobAssignment(context) || canSelfAssignJob(context);
}

export function getAvailableAssignmentChoices({
  members = [],
  role,
  currentMemberId = '',
  shopId = '',
  canManage = false
} = {}) {
  const activeMembers = listAssignableShopMembers(members, shopId);
  if (canManage || ASSIGNMENT_MANAGE_ROLES.has(normalizeRole(role))) {
    return activeMembers;
  }
  return activeMembers.filter((member) => member.id === currentMemberId);
}

export function resolveJobAssignee(job = {}, members = [], shopId = '') {
  const assignedMemberId = job.assignedMemberId || job.assigned_member_id || '';
  const member = listAssignableShopMembers(members, shopId)
    .find((candidate) => candidate.id === assignedMemberId);
  const fallbackName = String(
    job.assignedMemberDisplayName
    || job.assigned_member_display_name
    || ''
  ).trim();

  if (member) {
    return {
      id: member.id,
      name: getMemberDisplayName(member),
      active: true,
      historical: false
    };
  }

  if (assignedMemberId || fallbackName) {
    return {
      id: assignedMemberId,
      name: fallbackName || 'Former shop member',
      active: false,
      historical: true
    };
  }

  return {
    id: '',
    name: 'Unassigned',
    active: false,
    historical: false
  };
}

export function countAssignedActiveJobs({
  jobs = [],
  members = [],
  shopId = '',
  now = new Date()
} = {}) {
  const activeJobs = jobs.filter((job) => job.shopId === shopId && isActiveJob(job));
  const counts = listAssignableShopMembers(members, shopId).map((member) => {
    const assignedJobs = activeJobs.filter((job) => job.assignedMemberId === member.id);
    return {
      member,
      name: getMemberDisplayName(member),
      activeJobCount: assignedJobs.length,
      overdueJobCount: assignedJobs.filter((job) => isOverdueJob(job, now)).length
    };
  });

  return {
    members: counts,
    unassignedActiveJobCount: activeJobs.filter((job) => !job.assignedMemberId).length
  };
}

export function getMemberDisplayName(member = {}) {
  return String(member.displayName || member.email || 'Team member').trim() || 'Team member';
}

function isActiveJob(job = {}) {
  return !CLOSED_JOB_STATUSES.has(String(job.status || '').trim().toLowerCase());
}

function isOverdueJob(job = {}, now = new Date()) {
  const dueValue = job.promiseDate
    || job.promise_date
    || job.promisedDate
    || job.dueDate
    || job.techDetails?.dueDate
    || '';
  if (!dueValue) {
    return false;
  }
  const dueDate = /^\d{4}-\d{2}-\d{2}$/.test(String(dueValue))
    ? new Date(`${dueValue}T23:59:59`)
    : new Date(dueValue);
  if (Number.isNaN(dueDate.getTime())) {
    return false;
  }
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return dueDate < today;
}
