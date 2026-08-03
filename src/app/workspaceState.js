export function resolveStoredWorkspaceState({
  workspaceState = {},
  jobs = [],
  isAllowedMode = () => false
} = {}) {
  if (
    workspaceState.mode === 'detail'
    && jobs.some((job) => job.id === workspaceState.selectedJobId)
  ) {
    return { mode: 'detail', selectedJobId: workspaceState.selectedJobId };
  }

  if (
    workspaceState.mode
    && workspaceState.mode !== 'detail'
    && isAllowedMode(workspaceState.mode)
  ) {
    return { mode: workspaceState.mode, selectedJobId: null };
  }

  return { mode: 'new', selectedJobId: null };
}
