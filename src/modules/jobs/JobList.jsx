import { useMemo, useState } from 'react';
import { formatShopDate } from '../../shared/utils/dateFormat';
import { getShopDateOptions } from '../shops/shopConfig';
import { sortNewestFirst } from './jobSelectors';
import { getJobPriorityOption, getJobPriorityShortLabel } from './jobPriority';
import { isCurrentJob } from './CurrentJobsPage.jsx';

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
    job.priority
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
    <section className="panel job-list">
      <div className="job-list-heading">
        <h2>Current Jobs</h2>
        {onViewAll && <button type="button" onClick={onViewAll}>View all current jobs</button>}
      </div>
      <label className="job-search">
        Search
        <input
          type="search"
          placeholder="Search current jobs..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </label>
      <label className="table-checkbox job-filter-toggle">
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
        <div className="list">
          {filteredJobs.map((job) => (
            <button
              key={job.id}
              type="button"
              onClick={() => handleSelect(job.id)}
              className={job.id === selectedJobId ? 'job-row selected' : 'job-row'}
            >
              <span className="job-number-priority">
                <strong>#{job.jobNumber}</strong>
                <span className={`priority-badge ${getJobPriorityOption(job.priority).className}`}>
                  {getJobPriorityShortLabel(job.priority)}
                </span>
              </span>
              <span className="job-row-customer">{job.customerName}</span>
              <span className="job-row-instrument">
                {job.guitarBrand} {job.model}
              </span>
              <span className="job-row-status">{job.status}</span>
              <span className="job-row-date">{formatShopDate(job.dateReceived, dateOptions)}</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
