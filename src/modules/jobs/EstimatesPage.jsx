import { useMemo, useState } from 'react';
import WorkspacePageHeader from '../../shared/components/WorkspacePageHeader.jsx';
import WorkspaceSection from '../../shared/components/WorkspaceSection.jsx';
import { formatShopDateTime } from '../../shared/utils/dateFormat.js';
import { fromMinorUnits, money } from '../../shared/utils/money.js';

const FILTERS = [
  ['all', 'All estimates'],
  ['sent', 'Sent'],
  ['approved', 'Approved'],
  ['declined', 'Declined'],
  ['draft', 'Draft']
];

export default function EstimatesPage({ jobs = [], moneyOptions = {}, dateOptions = {}, onOpenJob }) {
  const [filter, setFilter] = useState('all');
  const estimates = useMemo(() => jobs
    .filter((job) => filter === 'all' || (job.estimateStatus || 'draft') === filter)
    .sort((left, right) => new Date(right.estimateSentAt || right.updatedAt || 0) - new Date(left.estimateSentAt || left.updatedAt || 0)), [filter, jobs]);

  return (
    <main className="workspace-page estimates-page">
      <WorkspacePageHeader
        eyebrow="Billing workspace"
        title="Estimates"
        description="Prepare, send, and track customer-reviewed estimate revisions without losing the locked totals that were sent."
      />
      <WorkspaceSection
        title="Estimate queue"
        description="Open a work order to edit a draft, send a revision, record approval or decline, or email the exact locked estimate."
        actions={(
          <label>
            Status
            <select value={filter} onChange={(event) => setFilter(event.target.value)} aria-label="Estimate status filter">
              {FILTERS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
        )}
      >
        {estimates.length === 0 ? (
          <p className="empty">No estimates match this filter.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Job</th><th>Customer</th><th>Instrument</th><th>Revision</th><th>Status</th><th>Total</th><th>Updated</th><th>Action</th></tr>
              </thead>
              <tbody>
                {estimates.map((job) => {
                  const snapshot = job.estimateSnapshot || {};
                  const total = snapshot.totalMinor == null ? null : fromMinorUnits(snapshot.totalMinor, snapshot.currencyCode || moneyOptions.currency);
                  return (
                    <tr key={job.id}>
                      <td>{job.jobNumber || 'Unnumbered'}</td>
                      <td>{job.customerName || 'Unnamed customer'}</td>
                      <td>{[job.guitarBrand, job.model].filter(Boolean).join(' ') || job.instrumentType || 'Instrument'}</td>
                      <td>{job.estimateRevision || 0}</td>
                      <td><span className={`estimate-status estimate-status-${job.estimateStatus || 'draft'}`}>{formatStatus(job.estimateStatus || 'draft')}</span></td>
                      <td>{total == null ? 'Draft' : money(total, moneyOptions)}</td>
                      <td>{formatShopDateTime(job.estimateSentAt || job.updatedAt, dateOptions) || '-'}</td>
                      <td><button type="button" onClick={() => onOpenJob?.(job.id)}>Open Work Order</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </WorkspaceSection>
    </main>
  );
}

function formatStatus(status) {
  const value = String(status || 'draft');
  return value.charAt(0).toUpperCase() + value.slice(1);
}
