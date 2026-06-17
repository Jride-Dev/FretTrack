import { useMemo, useState } from 'react';
import { formatShopDate } from '../../shared/utils/dateFormat';
import { getShopDateOptions } from '../shops/shopConfig';
import { sortNewestFirst } from './jobSelectors';
import { getJobPriorityOption, getJobPriorityShortLabel } from './jobPriority';

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

export default function JobList({ jobs, selectedJobId, onSelect, onSelectJob }) {
  const [search, setSearch] = useState('');
  const [showPickedUp, setShowPickedUp] = useState(false);
  const handleSelect = onSelectJob || onSelect;
  const dateOptions = getShopDateOptions();

  const filteredJobs = useMemo(() => {
    const sortedJobs = sortNewestFirst(jobs).filter((job) => showPickedUp || !['Picked Up', 'Picked up'].includes(job.status));
    return sortedJobs.filter((job) => searchableText(job).includes(search.toLowerCase()));
  }, [jobs, search, showPickedUp]);

  return (
    <section className="panel job-list">
      <h2>Current Jobs</h2>
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
          checked={showPickedUp}
          onChange={(event) => setShowPickedUp(event.target.checked)}
        />
        Show picked up jobs
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
              <span>{job.customerName}</span>
              <span>
                {job.guitarBrand} {job.model}
              </span>
              <span>{job.status}</span>
              <span>{formatShopDate(job.dateReceived, dateOptions)}</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
