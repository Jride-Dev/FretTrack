import { countAssignedActiveJobs } from '../jobs/teamAssignment.js';

export default function TeamWorkloadSummary({
  jobs = [],
  members = [],
  shopId = '',
  enabled = false,
  isLoading = false,
  error = '',
  onOpenCurrentJobs
}) {
  if (!enabled) {
    return (
      <section className="team-workload-summary locked-feature-panel">
        <strong>Team Workload - Available in Pro</strong>
        <p>Shop Team Members remain available. Pro adds job assignment and workload visibility.</p>
      </section>
    );
  }

  const workload = countAssignedActiveJobs({ jobs, members, shopId });

  return (
    <section className="team-workload-summary" aria-labelledby="team-workload-title">
      <div className="panel-heading">
        <div>
          <h3 id="team-workload-title">Team Workload</h3>
          <p className="muted-text">Active assigned work only. This is workload visibility, not employee scoring.</p>
        </div>
      </div>
      {isLoading && <p className="muted-text">Loading team workload...</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {!isLoading && !error && (
        <div className="team-workload-grid">
          {workload.members.map((entry) => (
            <button
              key={entry.member.id}
              type="button"
              className="team-workload-card"
              onClick={() => onOpenCurrentJobs?.(entry.member.id)}
              disabled={!onOpenCurrentJobs}
            >
              <strong>{entry.name}</strong>
              <span>{entry.activeJobCount} active</span>
              <span>{entry.overdueJobCount} overdue</span>
            </button>
          ))}
          <button
            type="button"
            className="team-workload-card"
            onClick={() => onOpenCurrentJobs?.('unassigned')}
            disabled={!onOpenCurrentJobs}
          >
            <strong>Unassigned</strong>
            <span>{workload.unassignedActiveJobCount} active</span>
          </button>
        </div>
      )}
    </section>
  );
}
