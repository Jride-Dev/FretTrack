import { useMemo, useState } from 'react';
import { formatShopDate } from '../../shared/utils/dateFormat';
import { getShopDateOptions } from '../shops/shopConfig';
import { sortNewestFirst } from './jobSelectors';
import { getJobPriorityOption, getJobPriorityShortLabel } from './jobPriority';
import { isCurrentJob } from './currentJobStatus.js';

function searchableText(job) {
  return [
    job.jobNumber,
    job.customerName,
    job.customerFirstName,
    job.customerLastName,
    job.phone,
    job.email,
    job.guitarBrand,
    job.model,
    job.serial,
    job.status,
    job.priority,
    job.accountingVoidReason
  ]
    .join(' ')
    .toLowerCase();
}

export default function JobList({ jobs, selectedJobId, onSelect, onSelectJob, onViewAll }) {
  const [search, setSearch] = useState('');
  const [showClosed, setShowClosed] = useState(false);
  const handleSelect = onSelectJob || onSelect;
  const dateOptions = getShopDateOptions();

  const filteredJobs = useMemo(() => {
    const sortedJobs = sortNewestFirst(jobs).filter((job) => showClosed || isCurrentJob(job));
    return sortedJobs.filter((job) => searchableText(job).includes(search.toLowerCase()));
  }, [jobs, search, showClosed]);

  return (
    <section className="panel current-jobs-summary">
      <div className="current-jobs-summary-heading">
        <h2>Current Jobs</h2>
        {onViewAll && <button type="button" onClick={onViewAll}>View all current jobs</button>}
      </div>
      <label className="current-jobs-summary-search">
        Search
        <input
          type="search"
          placeholder="Search current jobs..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </label>
      <label className="table-checkbox current-jobs-summary-filter">
        <input
          type="checkbox"
          checked={showClosed}
          onChange={(event) => setShowClosed(event.target.checked)}
        />
        Show closed jobs
      </label>
      {filteredJobs.length === 0 ? (
        <p className="empty">{jobs.length === 0 ? 'No jobs yet.' : 'No matching current jobs.'}</p>
      ) : (
        <div className="current-jobs-summary-list">
          {filteredJobs.map((job) => (
            <button
              key={job.id}
              type="button"
              onClick={() => handleSelect(job.id)}
              className={job.id === selectedJobId ? 'current-jobs-summary-item selected' : 'current-jobs-summary-item'}
            >
              <span className="current-jobs-summary-primary">
                <strong>#{job.jobNumber}</strong>
                <span className={`priority-badge ${getJobPriorityOption(job.priority).className}`}>
                  {getJobPriorityShortLabel(job.priority)}
                </span>
              </span>
              <span className="current-jobs-summary-status">{job.accountingVoidedAt ? 'Accounting Excluded' : job.status}</span>
              <span className="current-jobs-summary-description">
                {[job.customerName, [job.guitarBrand, job.model].filter(Boolean).join(' ')].filter(Boolean).join(' | ')}
              </span>
              <span className="current-jobs-summary-date">{formatShopDate(job.dateReceived, dateOptions)}</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
