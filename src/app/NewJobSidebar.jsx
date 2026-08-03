import { Fragment } from 'react';
import JobForm from '../modules/jobs/JobForm.jsx';
import JobList from '../modules/jobs/JobList.jsx';
import UpcomingSchedulePanel from '../modules/scheduling/UpcomingSchedulePanel.jsx';
import { money } from '../shared/utils/money.js';

export default function NewJobSidebar({
  isCollapsed,
  onToggle,
  jobs,
  customers,
  selectedJobId,
  shopProfile,
  membership,
  assignableMembers,
  billingAccess,
  betaApproved,
  canEditJobs,
  pendingNewJobCustomer,
  tillSummary,
  moneyOptions,
  onJobSaved,
  onOfflineDraftSaved,
  onSelectJob,
  onOpenCurrentJobs,
  onOpenSchedule,
  onNotice
}) {
  return (
    <aside className="new-job-sidebar no-print" aria-label="New job sections">
      <div className="new-job-sidebar-controls">
        <button
          type="button"
          className="button-tertiary new-job-sidebar-toggle"
          onClick={onToggle}
          aria-expanded={!isCollapsed}
          aria-controls="new-job-sidebar-content"
        >
          {isCollapsed ? 'Show sections' : 'Hide sections'}
        </button>
      </div>
      <div id="new-job-sidebar-content" className="new-job-sidebar-content" hidden={isCollapsed}>
        <JobForm
          jobs={jobs}
          customers={customers}
          canWrite={canEditJobs}
          shopProfile={shopProfile}
          assignableMembers={assignableMembers}
          membership={membership}
          entitlementSnapshot={billingAccess}
          betaApproved={betaApproved}
          initialCustomer={pendingNewJobCustomer}
          onJobSaved={onJobSaved}
          onOfflineDraftSaved={onOfflineDraftSaved}
          onNotice={onNotice}
        />
        <JobList
          jobs={jobs}
          selectedJobId={selectedJobId}
          onSelectJob={onSelectJob}
          onViewAll={onOpenCurrentJobs}
        />
        <section className="panel till-summary">
          <h2>Till Summary</h2>
          <div className="totals">
            <span>Paid In</span>
            <strong>{money(tillSummary.paidTotal, moneyOptions)}</strong>
            <span>{shopProfile?.taxLabel || 'Sales Tax'}</span>
            <strong>{money(tillSummary.salesTaxAccrued, moneyOptions)}</strong>
            <span>Open Balance</span>
            <strong>{money(tillSummary.openBalance, moneyOptions)}</strong>
            {Object.entries(tillSummary.byMethod).map(([method, amount]) => (
              <Fragment key={method}>
                <span>{method}</span>
                <strong>{money(amount, moneyOptions)}</strong>
              </Fragment>
            ))}
          </div>
        </section>
        {membership?.shopId && (
          <UpcomingSchedulePanel
            shopId={membership.shopId}
            onOpenSchedule={onOpenSchedule}
          />
        )}
      </div>
    </aside>
  );
}
