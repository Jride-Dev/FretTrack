export const JOB_PRIORITY_OPTIONS = [
  {
    value: 'high',
    label: 'HIGH',
    shortLabel: 'HIGH',
    className: 'priority-high',
    description: 'Customer wants it done now.'
  },
  {
    value: 'medium',
    label: 'Medium',
    shortLabel: 'Medium',
    className: 'priority-medium',
    description: 'Has a deadline, but it is within 2 weeks.'
  },
  {
    value: 'regular',
    label: 'Regular / Low',
    shortLabel: 'Regular',
    className: 'priority-regular',
    description: 'Customer does not need the instrument in the next 2+ weeks.'
  }
];

export function normalizeJobPriority(priority) {
  const value = String(priority || '').trim().toLowerCase();
  return JOB_PRIORITY_OPTIONS.some((option) => option.value === value) ? value : 'regular';
}

export function getJobPriorityOption(priority) {
  return JOB_PRIORITY_OPTIONS.find((option) => option.value === normalizeJobPriority(priority)) || JOB_PRIORITY_OPTIONS[2];
}

export function getJobPriorityLabel(priority) {
  return getJobPriorityOption(priority).label;
}

export function getJobPriorityShortLabel(priority) {
  return getJobPriorityOption(priority).shortLabel;
}
