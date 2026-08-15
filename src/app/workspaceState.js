export function resolveStoredWorkspaceState({
  workspaceState = {},
  jobs = [],
  isAllowedMode = () => false
} = {}) {
  const isDetailMode = ['detail', 'amplifier-detail'].includes(workspaceState.mode);

  const selectedJob = jobs.find((job) => job.id === workspaceState.selectedJobId);
  if (isDetailMode && selectedJob) {
    const instrumentType = String(selectedJob.instrumentType || selectedJob.techDetails?.instrumentType || '').trim().toLowerCase();
    return {
      mode: instrumentType === 'amplifier' ? 'amplifier-detail' : 'detail',
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
