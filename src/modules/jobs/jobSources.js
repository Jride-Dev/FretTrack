export const JOB_SOURCE_OPTIONS = [
  { value: 'Walk-In', label: 'Walk-In' },
  { value: 'Telephone Appt.', label: 'Telephone Appt.' },
  { value: 'Referral', label: 'Referral' },
  { value: 'Sub-Contract', label: 'Sub-Contract' },
  { value: 'mail_in', label: 'Mail In / Shipped In' }
];

export function normalizeJobSource(source) {
  const value = String(source || '').trim();
  return JOB_SOURCE_OPTIONS.some((option) => option.value === value) ? value : 'Walk-In';
}

export function getJobSourceLabel(source) {
  return JOB_SOURCE_OPTIONS.find((option) => option.value === normalizeJobSource(source))?.label || 'Walk-In';
}
