import { useEffect, useMemo, useState } from 'react';
import { formatShopDate } from '../../shared/utils/dateFormat.js';
import { getShopDateOptions } from '../shops/shopConfig.js';
import { formatInstrumentLabel } from '../instruments/instrumentService.js';
import { JOB_PRIORITY_OPTIONS, getJobPriorityOption, getJobPriorityShortLabel, normalizeJobPriority } from './jobPriority.js';
import { JOB_STATUSES } from './JobStatusSelect.jsx';
import { listAssignableShopMembers, resolveJobAssignee } from './teamAssignment.js';
import { isCurrentJob } from './currentJobStatus.js';

const PRIORITY_ORDER = { high: 0, medium: 1, regular: 2 };

function cleanText(value) {
  return String(value || '').trim().toLowerCase();
}

export function getJobDueDate(job = {}) {
  return job.promiseDate || job.promise_date || job.promisedDate || job.dueDate || job.techDetails?.dueDate || '';
}

export function getJobDueState(job = {}, now = new Date()) {
  const dueValue = getJobDueDate(job);
  if (!dueValue) {
    return '';
  }
  const dueDate = /^\d{4}-\d{2}-\d{2}$/.test(String(dueValue))
    ? new Date(`${dueValue}T23:59:59`)
    : new Date(dueValue);
  if (Number.isNaN(dueDate.getTime())) {
    return '';
  }
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / 86400000);
  if (daysUntilDue < 0) {
    return 'overdue';
  }
  return daysUntilDue <= 7 ? 'due-soon' : '';
}

export function filterAndSortCurrentJobs(jobs = [], filters = {}, now = new Date()) {
  const search = cleanText(filters.search);
  const visible = jobs.filter((job) => {
    if (filters.scope !== 'all' && !isCurrentJob(job)) {
      return false;
    }
    if (filters.priority && normalizeJobPriority(job.priority || job.techDetails?.priority) !== filters.priority) {
      return false;
    }
    if (filters.status && job.status !== filters.status) {
      return false;
    }
    if (filters.due && getJobDueState(job, now) !== filters.due) {
      return false;
    }
    if (filters.assignedMemberId === 'unassigned' && job.assignedMemberId) {
      return false;
    }
    if (
      filters.assignedMemberId
      && filters.assignedMemberId !== 'unassigned'
      && job.assignedMemberId !== filters.assignedMemberId
    ) {
      return false;
    }
    if (!search) {
      return true;
    }
    return [
      job.jobNumber,
      job.customerName,
      job.instrumentType,
      job.guitarBrand,
      job.model,
      job.serial,
      job.assignedMemberDisplayName,
      job.accountingVoidReason
    ].some((value) => cleanText(value).includes(search));
  });

  return visible.sort((left, right) => {
    switch (filters.sortBy) {
      case 'priority':
        return PRIORITY_ORDER[normalizeJobPriority(left.priority)] - PRIORITY_ORDER[normalizeJobPriority(right.priority)];
      case 'dueDate':
        return compareDueDates(getJobDueDate(left), getJobDueDate(right));
      case 'jobNumber':
        return String(left.jobNumber || '').localeCompare(String(right.jobNumber || ''), undefined, { numeric: true });
      case 'status':
        return String(left.status || '').localeCompare(String(right.status || ''));
      case 'assignedTechnician':
        return String(left.assignedMemberDisplayName || '').localeCompare(String(right.assignedMemberDisplayName || ''));
      case 'dateReceived':
      default:
        return new Date(right.dateReceived || 0).getTime() - new Date(left.dateReceived || 0).getTime();
    }
  });
}

function compareDueDates(left, right) {
  if (!left && !right) return 0;
  if (!left) return 1;
  if (!right) return -1;
  return new Date(left).getTime() - new Date(right).getTime();
}

export default function CurrentJobsPage({
  jobs = [],
  onSelectJob,
  shopProfile = null,
  assignableMembers = [],
  teamAssignmentEnabled = false,
  initialAssigneeFilter = ''
}) {
  const [filters, setFilters] = useState({
    search: '',
    priority: '',
    status: '',
    due: '',
    assignedMemberId: initialAssigneeFilter,
    scope: 'active',
    sortBy: 'priority'
  });
  const dateOptions = getShopDateOptions(shopProfile || undefined);
  const visibleJobs = useMemo(() => filterAndSortCurrentJobs(jobs, filters), [jobs, filters]);
  const shopId = jobs.find((job) => job.shopId)?.shopId || shopProfile?.shopId || '';
  const assignmentChoices = useMemo(
    () => listAssignableShopMembers(assignableMembers, shopId),
    [assignableMembers, shopId]
  );

  useEffect(() => {
    setFilters((current) => ({ ...current, assignedMemberId: initialAssigneeFilter || '' }));
  }, [initialAssigneeFilter]);

  function updateFilter(name, value) {
    setFilters((current) => ({ ...current, [name]: value }));
  }

  return (
    <section className="panel current-jobs-page">
      <div className="section-header">
        <div>
          <h2>Current Jobs</h2>
          <p className="muted-text">Review active shop work, priorities, statuses, and due dates.</p>
        </div>
        <strong>{visibleJobs.length} job{visibleJobs.length === 1 ? '' : 's'}</strong>
      </div>

      <div className="current-jobs-filters no-print">
        <label className="current-jobs-search">
          Search
          <input
            type="search"
            value={filters.search}
            onChange={(event) => updateFilter('search', event.target.value)}
            placeholder="Job number, customer, instrument, brand, or model"
          />
        </label>
        <label>
          Priority
          <select value={filters.priority} onChange={(event) => updateFilter('priority', event.target.value)}>
            <option value="">All priorities</option>
            {JOB_PRIORITY_OPTIONS.map((priority) => <option key={priority.value} value={priority.value}>{priority.label}</option>)}
          </select>
        </label>
        <label>
          Status
          <select value={filters.status} onChange={(event) => updateFilter('status', event.target.value)}>
            <option value="">All statuses</option>
            {JOB_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
        </label>
        <label>
          Due
          <select value={filters.due} onChange={(event) => updateFilter('due', event.target.value)}>
            <option value="">Any due date</option>
            <option value="overdue">Overdue</option>
            <option value="due-soon">Due within 7 days</option>
          </select>
        </label>
        {teamAssignmentEnabled && (
          <label>
            Assigned Technician
            <select
              value={filters.assignedMemberId}
              onChange={(event) => updateFilter('assignedMemberId', event.target.value)}
            >
              <option value="">All technicians</option>
              <option value="unassigned">Unassigned</option>
              {assignmentChoices.map((member) => (
                <option key={member.id} value={member.id}>{member.displayName || 'Team member'}</option>
              ))}
            </select>
          </label>
        )}
        <label>
          Scope
          <select value={filters.scope} onChange={(event) => updateFilter('scope', event.target.value)}>
            <option value="active">Active jobs</option>
            <option value="all">All jobs</option>
          </select>
        </label>
        <label>
          Sort
          <select value={filters.sortBy} onChange={(event) => updateFilter('sortBy', event.target.value)}>
            <option value="priority">Priority</option>
            <option value="dateReceived">Date received</option>
            <option value="dueDate">Due date</option>
            <option value="jobNumber">Job number</option>
            <option value="status">Status</option>
            <option value="assignedTechnician">Assigned technician</option>
          </select>
        </label>
      </div>

      <div className="current-jobs-table" role="table" aria-label="Current jobs">
        <div className="current-jobs-heading" role="row">
          <span>Priority</span><span>Status</span><span>Job</span><span>Customer</span><span>Instrument</span><span>Assigned Technician</span><span>Received</span><span>Due</span>
        </div>
        {visibleJobs.map((job) => {
          const priority = getJobPriorityOption(job.priority || job.techDetails?.priority);
          const dueState = getJobDueState(job);
          const assignee = resolveJobAssignee(job, assignableMembers, job.shopId);
          return (
            <button
              key={job.id}
              type="button"
              className="current-job-row"
              onClick={() => onSelectJob(job.id)}
              role="row"
              aria-label={`Open job ${job.jobNumber || ''} for ${job.customerName || 'customer'}`}
            >
              <span role="cell" data-label="Priority"><span className={`priority-badge ${priority.className}`}>{getJobPriorityShortLabel(job.priority || job.techDetails?.priority)}</span></span>
              <span role="cell" data-label="Status">{job.accountingVoidedAt ? 'Accounting Excluded' : job.status || '-'}</span>
              <strong role="cell" data-label="Job">#{job.jobNumber || '-'}</strong>
              <span role="cell" data-label="Customer">{job.customerName || '-'}</span>
              <span role="cell" data-label="Instrument">{[formatInstrumentLabel(job), job.guitarBrand, job.model].filter(Boolean).join(' ') || '-'}</span>
              <span role="cell" data-label="Assigned Technician">
                {assignee.name}
                {assignee.historical && <small>Inactive or removed</small>}
              </span>
              <span role="cell" data-label="Received">{formatShopDate(job.dateReceived, dateOptions) || '-'}</span>
              <span role="cell" data-label="Due" className={dueState || undefined}>
                {formatShopDate(getJobDueDate(job), dateOptions) || '-'}
                {dueState === 'overdue' && <small>Overdue</small>}
                {dueState === 'due-soon' && <small>Due soon</small>}
              </span>
            </button>
          );
        })}
        {!visibleJobs.length && <p className="empty">No jobs match these filters.</p>}
      </div>
    </section>
  );
}
