export function resolveStoredWorkspaceState({
  workspaceState = {},
  jobs = [],
  isAllowedMode = () => false
} = {}) {
  const isDetailMode = ['detail', 'amplifier-detail', 'keyboard-detail'].includes(workspaceState.mode);

  const selectedJob = jobs.find((job) => job.id === workspaceState.selectedJobId);
  if (isDetailMode && selectedJob) {
    const instrumentType = String(selectedJob.instrumentType || selectedJob.techDetails?.instrumentType || '').trim().toLowerCase();
    const specialistMode = instrumentType === 'amplifier'
      ? 'amplifier-detail'
      : instrumentType === 'keyboard'
        ? 'keyboard-detail'
        : 'detail';
    return {
      mode: workspaceState.mode === 'detail' ? 'detail' : specialistMode,
      selectedJobId: workspaceState.selectedJobId
    };
  }

  if (
    workspaceState.mode
    && !isDetailMode
    && isAllowedMode(workspaceState.mode)
  ) {
    return { mode: workspaceState.mode, selectedJobId: null };
  }

  return { mode: 'new', selectedJobId: null };
}
