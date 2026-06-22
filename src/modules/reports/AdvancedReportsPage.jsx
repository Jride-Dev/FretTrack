import { useEffect, useMemo, useState } from 'react';
import { formatShopDate, formatShopDateTime } from '../../shared/utils/dateFormat';
import { money } from '../../shared/utils/money';
import { canUseAdvancedReporting } from '../billing/entitlementService';
import { getCurrentShopId, getShopMoneyOptions } from '../shops/shopConfig';
import {
  buildAdvancedOperationalReport,
  buildAdvancedReportMetrics,
  loadAdvancedOperationalReportData
} from './advancedReportsService';

export default function AdvancedReportsPage({
  customers = [],
  entitlementSnapshot = null,
  jobs = [],
  onOpenJob,
  onNotice,
  shopId = getCurrentShopId(),
  shopProfile = null
}) {
  const isEntitled = canUseAdvancedReporting(entitlementSnapshot);
  const [reportData, setReportData] = useState({
    parts: [],
    vendors: [],
    purchaseOrders: [],
    purchaseHistory: [],
    scheduleEvents: [],
    jobEvents: []
  });
  const [isLoadingReports, setIsLoadingReports] = useState(false);
  const [loadError, setLoadError] = useState('');
  const moneyOptions = getShopMoneyOptions(shopProfile || undefined);
  const dateOptions = {
    dateFormat: shopProfile?.dateFormat,
    locale: shopProfile?.locale
  };
  const metrics = useMemo(() => buildAdvancedReportMetrics({
    jobs,
    customers,
    parts: reportData.parts,
    shopId,
    shopProfile
  }), [customers, jobs, reportData.parts, shopId, shopProfile]);
  const operationalReport = useMemo(() => buildAdvancedOperationalReport({
    jobs,
    parts: reportData.parts,
    vendors: reportData.vendors,
    purchaseOrders: reportData.purchaseOrders,
    purchaseHistory: reportData.purchaseHistory,
    scheduleEvents: reportData.scheduleEvents,
    jobEvents: reportData.jobEvents,
    shopId
  }), [jobs, reportData, shopId]);

  useEffect(() => {
    if (!isEntitled || !shopId) {
      setReportData({
        parts: [],
        vendors: [],
        purchaseOrders: [],
        purchaseHistory: [],
        scheduleEvents: [],
        jobEvents: []
      });
      return undefined;
    }

    let isMounted = true;
    setIsLoadingReports(true);
    setLoadError('');
    loadAdvancedOperationalReportData({ shopId })
      .then((loadedReportData) => {
        if (isMounted) {
          setReportData(loadedReportData);
        }
      })
      .catch((error) => {
        console.error('Advanced reports data load failed.', error);
        const message = error.message || 'Unable to load advanced report data.';
        if (isMounted) {
          setLoadError(message);
        }
        onNotice?.({ type: 'error', message });
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingReports(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isEntitled, onNotice, shopId]);

  if (!isEntitled) {
    return (
      <section className="panel advanced-reports-page">
        <div className="panel-heading">
          <div>
            <h2>Reports</h2>
            <p className="muted-text">Advanced Reporting is available on Pro. Trial and Shop access keep core shop workflow separate from Pro reporting.</p>
          </div>
          <span className="billing-status">Pro</span>
        </div>
        <section className="premium-placeholder">
          <h3>Advanced Reporting</h3>
          <p>Pro unlocks job aging, overdue work, low-stock inventory, purchase history, landed cost, schedule workload, and operational reporting for this shop.</p>
          <p className="muted-text">Billing self-service is not connected yet. An operator can enable Pro access during beta.</p>
        </section>
      </section>
    );
  }

  return (
    <section className="panel advanced-reports-page">
      <div className="panel-heading">
        <div>
          <h2>Reports</h2>
          <p className="muted-text">Pro operational dashboard. Real shop data only: no charts, exports, PDFs, Stripe, or billing actions in this phase.</p>
        </div>
        {isLoadingReports && <span className="muted-text">Loading reports...</span>}
      </div>

      {loadError && (
        <p className="save-status error">Advanced report data could not be fully loaded: {loadError}</p>
      )}

      <ReportSection title="Shop Overview" description="Counts that help decide what needs attention today.">
        <MetricCard label="Open Jobs" value={operationalReport.overview.openJobs} />
        <MetricCard label="Ready for Pickup" value={operationalReport.overview.readyForPickup} />
        <MetricCard label="Waiting on Parts" value={operationalReport.overview.waitingOnParts} />
        <MetricCard label="Waiting on Customer" value={operationalReport.overview.waitingOnCustomer} />
        <MetricCard label="Overdue Jobs" value={operationalReport.overview.overdueJobs} tone={operationalReport.overview.overdueJobs ? 'warning' : ''} />
        <MetricCard label="High-Priority Jobs" value={operationalReport.overview.highPriorityJobs} tone={operationalReport.overview.highPriorityJobs ? 'warning' : ''} />
        <MetricCard label="Low-Stock Parts" value={operationalReport.overview.lowStockParts} tone={operationalReport.overview.lowStockParts ? 'warning' : ''} />
        <MetricCard label="Open Purchase Orders" value={operationalReport.overview.openPurchaseOrders} />
        <MetricCard label="Upcoming Schedule Events" value={operationalReport.overview.upcomingScheduleEvents} />
      </ReportSection>

      <ReportSection title="Revenue Snapshot" description="Payment-based totals from the existing accounting selectors.">
        <MetricCard label="This Month" value={money(metrics.revenue.thisMonth, moneyOptions)} />
        <MetricCard label="Last Month" value={money(metrics.revenue.lastMonth, moneyOptions)} />
        <MetricCard label="Year to Date" value={money(metrics.revenue.yearToDate, moneyOptions)} />
      </ReportSection>

      <ReportSection title="Baseline Metrics" description="Phase 1 metrics remain available alongside the operational tables.">
        <MetricCard label="Open Jobs" value={metrics.jobs.openJobs} />
        <MetricCard label="Completed Jobs" value={metrics.jobs.completedJobs} />
        <MetricCard label="Avg Completion Time" value={formatDays(metrics.jobs.averageCompletionTimeDays)} />
        <MetricCard label="Total Customers" value={metrics.customers.totalCustomers} />
        <MetricCard label="New This Month" value={metrics.customers.newCustomersThisMonth} />
        <MetricCard label="Repeat Customers" value={metrics.customers.repeatCustomers} />
        <MetricCard label="Low Stock Count" value={metrics.inventory.lowStockCount} />
        <MetricCard label="Total Parts" value={metrics.inventory.totalParts} />
        <MetricCard label="Inventory Value Estimate" value={money(metrics.inventory.inventoryValueEstimate, moneyOptions)} />
      </ReportSection>

      <ReportDetails title="Jobs by Status" description="Current job count by workflow status.">
        <ReportTable
          headers={['Status', 'Jobs']}
          rows={operationalReport.jobsByStatus}
          emptyText="No jobs found for this shop."
          renderRow={(row) => (
            <tr key={row.status}>
              <td>{row.status}</td>
              <td>{row.count}</td>
            </tr>
          )}
        />
      </ReportDetails>

      <ReportDetails title="Priority Report" description="Open jobs grouped by intake priority.">
        <div className="priority-report-grid">
          {operationalReport.priorityReport.map((priority) => (
            <section className="priority-report-card" key={priority.priority}>
              <div>
                <span className={`priority-badge priority-${priority.priority}`}>{priority.label}</span>
                <strong>{priority.count}</strong>
              </div>
              {priority.jobs.length ? (
                <ul>
                  {priority.jobs.map((job) => (
                    <li key={job.id}>
                      <JobReference row={job} onOpenJob={onOpenJob} />
                      <span>{job.customerName}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="empty-state">No open {priority.label.toLowerCase()} jobs.</p>
              )}
            </section>
          ))}
        </div>
      </ReportDetails>

      <ReportDetails title="Overdue / Promise Date" description="Open jobs past their promise date.">
        <ReportTable
          headers={['Job #', 'Customer', 'Instrument', 'Status', 'Priority', 'Promise Date', 'Days Overdue']}
          rows={operationalReport.overdueJobs}
          emptyText="No overdue jobs."
          renderRow={(row) => (
            <tr key={row.id}>
              <td><JobReference row={row} onOpenJob={onOpenJob} /></td>
              <td>{row.customerName}</td>
              <td>{row.instrument}</td>
              <td>{row.status}</td>
              <td><span className={`priority-badge priority-${row.priority}`}>{row.priorityLabel}</span></td>
              <td>{formatDate(row.promiseDate, dateOptions)}</td>
              <td>{row.daysOverdue}</td>
            </tr>
          )}
        />
      </ReportDetails>

      <ReportDetails title="Ready for Pickup" description="Open jobs marked ready for customer pickup.">
        <JobTable
          rows={operationalReport.readyForPickup}
          emptyText="No jobs are marked ready for pickup."
          dateOptions={dateOptions}
          onOpenJob={onOpenJob}
        />
      </ReportDetails>

      <ReportDetails title="Waiting on Parts" description="Open jobs currently blocked by parts.">
        <JobTable
          rows={operationalReport.waitingOnParts}
          emptyText="No jobs are waiting on parts."
          dateOptions={dateOptions}
          onOpenJob={onOpenJob}
        />
      </ReportDetails>

      <ReportDetails title="Job Aging" description="Open jobs sorted by days since intake.">
        <ReportTable
          headers={['Job #', 'Customer', 'Instrument', 'Status', 'Priority', 'Intake Date', 'Age']}
          rows={operationalReport.jobAging}
          emptyText="No open jobs to age."
          renderRow={(row) => (
            <tr key={row.id}>
              <td><JobReference row={row} onOpenJob={onOpenJob} /></td>
              <td>{row.customerName}</td>
              <td>{row.instrument}</td>
              <td>{row.status}</td>
              <td><span className={`priority-badge priority-${row.priority}`}>{row.priorityLabel}</span></td>
              <td>{formatDate(row.dateReceived, dateOptions)}</td>
              <td>{row.ageDays} days</td>
            </tr>
          )}
        />
      </ReportDetails>

      <ReportDetails title="Recent Work-Log Activity" description="Latest work-log entries recorded against jobs.">
        <ReportTable
          headers={['Date', 'Job #', 'Customer', 'Entry']}
          rows={operationalReport.recentWorkActivity}
          emptyText="No recent work-log activity."
          renderRow={(row) => (
            <tr key={row.id}>
              <td>{formatDateTime(row.createdAt, dateOptions) || '-'}</td>
              <td><JobReference row={row} onOpenJob={onOpenJob} /></td>
              <td>{row.customerName}</td>
              <td>{row.note}</td>
            </tr>
          )}
        />
      </ReportDetails>

      <ReportDetails title="Inventory Low Stock" description="Parts where quantity on hand is at or below desired stock level.">
        <ReportTable
          headers={['Part', 'On Hand', 'Desired', 'Vendor', 'Location']}
          rows={operationalReport.lowStockParts}
          emptyText="No low-stock parts based on desired stock levels."
          renderRow={(row) => (
            <tr key={row.id}>
              <td>{row.name}</td>
              <td>{row.onHand}</td>
              <td>{row.desiredStockLevel}</td>
              <td>{row.vendorName || '-'}</td>
              <td>{row.location || '-'}</td>
            </tr>
          )}
        />
      </ReportDetails>

      <ReportDetails title="Purchase Order Status" description="Open purchase orders with ordered, received, and remaining quantities.">
        <ReportTable
          headers={['PO #', 'Vendor', 'Status', 'Ordered', 'Received', 'Remaining', 'Est. Total', 'Shipping']}
          rows={operationalReport.purchaseOrders}
          emptyText="No open purchase orders."
          renderRow={(row) => (
            <tr key={row.id}>
              <td>{row.poNumber}</td>
              <td>{row.vendorName || '-'}</td>
              <td>{formatStatus(row.status)}</td>
              <td>{row.orderedQty}</td>
              <td>{row.receivedQty}</td>
              <td>{row.remainingQty}</td>
              <td>{money(row.estimatedTotal, moneyOptions)}</td>
              <td>{money(row.shippingCost, moneyOptions)}</td>
            </tr>
          )}
        />
      </ReportDetails>

      <ReportDetails title="Purchase History / Landed Cost" description="Recent received inventory with shipping allocation and landed cost.">
        <ReportTable
          headers={['Received', 'Part', 'Vendor', 'Qty', 'Unit Cost', 'Shipping Allocated', 'Landed Unit', 'Total Landed']}
          rows={operationalReport.purchaseHistory}
          emptyText="No purchase history yet."
          renderRow={(row) => (
            <tr key={row.id}>
              <td>{formatDate(row.receivedAt, dateOptions)}</td>
              <td>{row.partName}</td>
              <td>{row.vendorName || '-'}</td>
              <td>{row.quantity}</td>
              <td>{money(row.unitCost, moneyOptions)}</td>
              <td>{money(row.shippingAllocated, moneyOptions)}</td>
              <td>{money(row.landedUnitCost, moneyOptions)}</td>
              <td>{money(row.totalLandedCost, moneyOptions)}</td>
            </tr>
          )}
        />
      </ReportDetails>

      <ReportDetails title="Upcoming Schedule Workload" description="Scheduled work in the next 30 days.">
        <ReportTable
          headers={['Date / Time', 'Type', 'Title', 'Job', 'Status']}
          rows={operationalReport.upcomingScheduleEvents}
          emptyText="No upcoming scheduled work in the next 30 days."
          renderRow={(row) => (
            <tr key={row.id}>
              <td>{formatDateTime(row.startsAt, dateOptions) || '-'}</td>
              <td>{formatStatus(row.eventType)}</td>
              <td>{row.title}</td>
              <td>{row.jobId ? <JobReference row={{ ...row, id: row.jobId, jobNumber: row.jobNumber || row.jobLabel || 'Open job' }} onOpenJob={onOpenJob} /> : '-'}</td>
              <td>{formatStatus(row.status)}</td>
            </tr>
          )}
        />
      </ReportDetails>
    </section>
  );
}

function ReportSection({ children, description, title }) {
  return (
    <section className="report-card-section">
      <div>
        <h3>{title}</h3>
        {description && <p className="muted-text">{description}</p>}
      </div>
      <div className="report-card-grid">{children}</div>
    </section>
  );
}

function ReportDetails({ children, description, title }) {
  return (
    <details className="report-detail-section" open>
      <summary>
        <span>{title}</span>
        {description && <small>{description}</small>}
      </summary>
      {children}
    </details>
  );
}

function MetricCard({ label, tone = '', value }) {
  return (
    <div className={`report-metric-card${tone ? ` ${tone}` : ''}`}>
      <span>{label}</span>
      <strong>{value ?? '-'}</strong>
    </div>
  );
}

function ReportTable({ emptyText, headers, renderRow, rows }) {
  if (!rows.length) {
    return <p className="empty-state">{emptyText}</p>;
  }

  return (
    <div className="report-table-wrap">
      <table className="report-table">
        <thead>
          <tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr>
        </thead>
        <tbody>{rows.map(renderRow)}</tbody>
      </table>
    </div>
  );
}

function JobTable({ dateOptions, emptyText, onOpenJob, rows }) {
  return (
    <ReportTable
      headers={['Job #', 'Customer', 'Instrument', 'Status', 'Priority', 'Promise Date']}
      rows={rows}
      emptyText={emptyText}
      renderRow={(row) => (
        <tr key={row.id}>
          <td><JobReference row={row} onOpenJob={onOpenJob} /></td>
          <td>{row.customerName}</td>
          <td>{row.instrument}</td>
          <td>{row.status}</td>
          <td><span className={`priority-badge priority-${row.priority}`}>{row.priorityLabel}</span></td>
          <td>{formatDate(row.promiseDate, dateOptions)}</td>
        </tr>
      )}
    />
  );
}

function JobReference({ onOpenJob, row }) {
  const label = row.jobNumber || 'Open job';
  const targetJobId = row.jobId || row.id;
  if (!targetJobId) {
    return <span>{label}</span>;
  }
  if (!onOpenJob) {
    return <span>{label}</span>;
  }
  return (
    <button type="button" className="table-link" onClick={() => onOpenJob(targetJobId)}>
      {label}
    </button>
  );
}

function formatDays(value) {
  if (!Number.isFinite(value)) {
    return '-';
  }
  return `${value.toFixed(1)} days`;
}

function formatDate(value, dateOptions) {
  return formatShopDate(value, dateOptions) || '-';
}

function formatStatus(value = '') {
  return String(value || '')
    .replace(/_/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ') || '-';
}
