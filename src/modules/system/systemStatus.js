export const SYSTEM_STATUS_LABELS = {
  operational: 'Operational',
  maintenance: 'Maintenance',
  degraded: 'Degraded',
  outage: 'Outage'
};

export function normalizeSystemStatus(value = {}) {
  const status = Object.prototype.hasOwnProperty.call(SYSTEM_STATUS_LABELS, value.status)
    ? value.status
    : 'operational';
  return {
    status,
    statusLabel: SYSTEM_STATUS_LABELS[status],
    publicNoticeTitle: value.publicNoticeTitle || '',
    publicNoticeMessage: value.publicNoticeMessage || '',
    noticeType: value.noticeType || (status === 'operational' ? 'recovery' : status),
    statusChangedAt: value.statusChangedAt || '',
    lastUpdatedAt: value.lastUpdatedAt || '',
    incidentState: status !== 'operational'
  };
}

export function getElapsedStatusText(status, now = Date.now()) {
  const changedAt = Date.parse(status?.statusChangedAt || '');
  if (!Number.isFinite(changedAt)) {
    return status?.incidentState ? 'Incident duration unavailable' : 'Uptime unavailable';
  }

  const elapsedMinutes = Math.max(0, Math.floor((Number(now) - changedAt) / 60000));
  const days = Math.floor(elapsedMinutes / 1440);
  const hours = Math.floor((elapsedMinutes % 1440) / 60);
  const minutes = elapsedMinutes % 60;
  const duration = [
    days ? `${days}d` : '',
    hours || days ? `${hours}h` : '',
    `${minutes}m`
  ].filter(Boolean).join(' ');

  return `${status?.incidentState ? 'Incident duration' : 'Uptime'} ${duration}`;
}

export function formatStatusTimestamp(value) {
  const timestamp = Date.parse(value || '');
  if (!Number.isFinite(timestamp)) {
    return 'Update time unavailable';
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(timestamp);
}
