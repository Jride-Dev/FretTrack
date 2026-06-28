import { Component, useEffect, useMemo, useState } from 'react';
import { formatShopDate, formatShopDateTime } from '../../shared/utils/dateFormat';
import { money } from '../../shared/utils/money';
import { canUseAdvancedReporting } from '../billing/entitlementService';
import { getPlanStatus } from '../billing/planStatus';
import { getCurrentShopId, getShopMoneyOptions } from '../shops/shopConfig';
import {
  buildAdvancedOperationalReport,
  buildAdvancedReportMetrics,
  loadAdvancedOperationalReportData
} from './advancedReportsService';
import {
  REPORT_EXPORT_ROW_LIMIT,
  REPORT_PREVIEW_ROW_LIMIT,
  REPORT_SHOW_ALL_ROW_LIMIT,
  buildReportCsv,
  limitReportRows,
  safeReportFilename
} from './reportExport';

const DASH = '\u2014';
const CLOSED_REPORT_STATUSES = new Set(['completed', 'complete', 'picked up', 'picked-up', 'closed', 'cancelled', 'canceled']);
const DEFAULT_REPORT_FILTERS = {
  jobStatusMode: 'all',
  recentActivityDays: '30',
  purchaseHistoryDays: '90'
};

export default function AdvancedReportsPage({
  customers = [],
  entitlementSnapshot = null,
  jobs = [],
  onOpenJob,
  onNotice,
  shopId = getCurrentShopId(),
  shopProfile = null
}) {
  const planStatus = getPlanStatus(entitlementSnapshot || {});
  const isEntitled = canUseAdvancedReporting(entitlementSnapshot) || planStatus.hasAdvancedReporting;
  const [reportData, setReportData] = useState({
    parts: [],
    vendors: [],
    purchaseOrders: [],
    purchaseHistory: [],
    scheduleEvents: [],
    jobEvents: []
  });
  const [reportFilters, setReportFilters] = useState(DEFAULT_REPORT_FILTERS);
  const [isLoadingReports, setIsLoadingReports] = useState(false);
  const [loadError, setLoadError] = useState('');
  const moneyOptions = getShopMoneyOptions(shopProfile || undefined);
  const dateOptions = {
    dateFormat: shopProfile?.dateFormat,
    locale: shopProfile?.locale
  };
  const metrics = useMemo(() => safeBuildMetrics({
    jobs,
    customers,
    parts: reportData.parts,
    shopId,
    shopProfile
  }), [customers, jobs, reportData.parts, shopId, shopProfile]);
  const operationalReport = useMemo(() => applyReportFilters(safeBuildOperationalReport({
    jobs,
    parts: reportData.parts,
    vendors: reportData.vendors,
    purchaseOrders: reportData.purchaseOrders,
    purchaseHistory: reportData.purchaseHistory,
    scheduleEvents: reportData.scheduleEvents,
    jobEvents: reportData.jobEvents,
    shopId
  }), reportFilters), [jobs, reportData, reportFilters, shopId]);
  const reportGeneratedAt = useMemo(() => new Date(), [operationalReport, shopId]);
  const reportScopeText = getReportScopeText(reportFilters);
  const exportSections = useMemo(() => buildReportExportSections({
    dateOptions,
    moneyOptions,
    metrics,
    operationalReport
  }), [dateOptions.dateFormat, dateOptions.locale, metrics, moneyOptions, operationalReport]);
  const exportMap = useMemo(() => new Map(exportSections.map((section) => [section.key, section])), [exportSections]);

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

  function handlePrintReports() {
    window.print();
  }

  function handleExportCsv(exportConfig) {
    if (!exportConfig) {
      return;
    }

    const { csv, exportedRows, totalRows, wasCapped } = buildReportCsv({
      columns: exportConfig.columns,
      rows: exportConfig.rows
    });
    const filename = safeReportFilename(exportConfig.filename || exportConfig.title, reportGeneratedAt);
    downloadTextFile(filename, csv, 'text/csv;charset=utf-8');

    if (!totalRows) {
      onNotice?.({ type: 'success', message: `Exported ${exportConfig.title} headers.` });
      return;
    }

    if (wasCapped) {
      onNotice?.({
        type: 'warning',
        message: `Exported first ${exportedRows} of ${totalRows} rows for ${exportConfig.title}. Narrow the report before exporting more.`
      });
      return;
    }

    onNotice?.({ type: 'success', message: `Exported ${exportedRows} row${exportedRows === 1 ? '' : 's'} for ${exportConfig.title}.` });
  }

  if (!isEntitled) {
    return (
      <section className="panel advanced-reports-page">
        <div className="panel-heading">
          <div>
            <h2>Reports</h2>
            <p className="muted-text">Advanced Reporting is available on Pro. Current plan: {planStatus.planLabel || 'Unknown'}.</p>
          </div>
          <span className={`plan-badge ${planStatus.badgeTone}`}>{planStatus.planLabel || 'Pro'}</span>
        </div>
        <section className="premium-placeholder">
          <h3>Advanced Reporting</h3>
          <p>Pro unlocks job aging, overdue work, low-stock inventory, purchase history, landed cost, schedule workload, and operational reporting for this shop.</p>
          <p className="muted-text">Advanced Reporting is available on Pro.</p>
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
          <p className="muted-text">Pro operational dashboard. Advanced Reporting: Yes. Real shop data only: no charts, exports, PDFs, Stripe, or billing actions in this phase.</p>
          <div className="reports-print-meta">
            <strong>{shopProfile?.shopName || shopProfile?.shop_name || 'FretTrack Reports'}</strong>
            <span>Generated {formatDateTime(reportGeneratedAt, dateOptions)}</span>
            <span>{reportScopeText}</span>
          </div>
        </div>
        <div className="mode-actions reports-page-actions no-print">
          <button type="button" className="button-tertiary" onClick={() => handleExportCsv(exportMap.get('summary'))}>Export Summary CSV</button>
          <button type="button" className="primary-action" onClick={handlePrintReports}>Print Reports</button>
          <span className={`plan-badge ${planStatus.badgeTone}`}>{planStatus.planLabel || 'Pro'}</span>
          {isLoadingReports && <span className="muted-text">Loading reports...</span>}
        </div>
      </div>

      <ReportFilterBar filters={reportFilters} onChange={setReportFilters} />

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

      <ReportDetails title="Jobs by Status" description="Current job count by workflow status." exportConfig={exportMap.get('jobsByStatus')} onExport={handleExportCsv}>
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

      <ReportDetails title="Overdue / Promise Date" description="Open jobs past their promise date." exportConfig={exportMap.get('overdueJobs')} onExport={handleExportCsv}>
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

      <ReportDetails title="Ready for Pickup" description="Open jobs marked ready for customer pickup." exportConfig={exportMap.get('readyForPickup')} onExport={handleExportCsv}>
        <JobTable
          rows={operationalReport.readyForPickup}
          emptyText="No jobs are marked ready for pickup."
          dateOptions={dateOptions}
          onOpenJob={onOpenJob}
        />
      </ReportDetails>

      <ReportDetails title="Waiting on Parts" description="Open jobs currently blocked by parts." exportConfig={exportMap.get('waitingOnParts')} onExport={handleExportCsv}>
        <JobTable
          rows={operationalReport.waitingOnParts}
          emptyText="No jobs are waiting on parts."
          dateOptions={dateOptions}
          onOpenJob={onOpenJob}
        />
      </ReportDetails>

      <ReportDetails title="Job Aging" description="Open jobs sorted by days since intake." exportConfig={exportMap.get('jobAging')} onExport={handleExportCsv}>
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

      <ReportDetails title="Recent Work-Log Activity" description="Latest work-log entries recorded against jobs." exportConfig={exportMap.get('recentWorkActivity')} onExport={handleExportCsv}>
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

      <ReportDetails title="Inventory Low Stock" description="Parts where quantity on hand is at or below desired stock level." exportConfig={exportMap.get('lowStockParts')} onExport={handleExportCsv}>
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

      <ReportDetails title="Purchase Order Status" description="Open purchase orders with ordered, received, and remaining quantities." exportConfig={exportMap.get('purchaseOrders')} onExport={handleExportCsv}>
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

      <ReportDetails title="Purchase History / Landed Cost" description="Recent received inventory with shipping allocation and landed cost." exportConfig={exportMap.get('purchaseHistory')} onExport={handleExportCsv}>
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

      <ReportDetails title="Upcoming Schedule Workload" description="Scheduled work in the next 30 days." exportConfig={exportMap.get('upcomingScheduleEvents')} onExport={handleExportCsv}>
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

function safeBuildMetrics(options) {
  try {
    return buildAdvancedReportMetrics(options);
  } catch (error) {
    console.error('Advanced report metrics failed.', error);
    return getEmptyReportMetrics();
  }
}

function safeBuildOperationalReport(options) {
  try {
    return normalizeOperationalReport(buildAdvancedOperationalReport(options));
  } catch (error) {
    console.error('Advanced operational report failed.', error);
    return getEmptyOperationalReport();
  }
}

function applyReportFilters(report, filters = DEFAULT_REPORT_FILTERS) {
  const normalizedReport = normalizeOperationalReport(report);
  return {
    ...normalizedReport,
    jobsByStatus: filterStatusRows(normalizedReport.jobsByStatus, filters.jobStatusMode),
    recentWorkActivity: filterRowsWithinLastDays(normalizedReport.recentWorkActivity, 'createdAt', filters.recentActivityDays),
    purchaseHistory: filterRowsWithinLastDays(normalizedReport.purchaseHistory, 'receivedAt', filters.purchaseHistoryDays)
  };
}

function buildReportExportSections({ dateOptions, moneyOptions, metrics, operationalReport }) {
  const jobColumns = getJobExportColumns(dateOptions);
  return [
    {
      key: 'summary',
      title: 'Reports Summary',
      rows: buildSummaryRows(metrics, operationalReport, moneyOptions),
      columns: [
        { header: 'Section', key: 'section' },
        { header: 'Metric', key: 'metric' },
        { header: 'Value', key: 'value' }
      ]
    },
    {
      key: 'jobsByStatus',
      title: 'Jobs by Status',
      rows: safeArray(operationalReport.jobsByStatus),
      columns: [
        { header: 'Status', key: 'status' },
        { header: 'Jobs', key: 'count' }
      ]
    },
    {
      key: 'overdueJobs',
      title: 'Overdue Jobs',
      rows: safeArray(operationalReport.overdueJobs),
      columns: [
        ...jobColumns,
        { header: 'Days Overdue', key: 'daysOverdue' }
      ]
    },
    {
      key: 'readyForPickup',
      title: 'Ready for Pickup',
      rows: safeArray(operationalReport.readyForPickup),
      columns: jobColumns
    },
    {
      key: 'waitingOnParts',
      title: 'Waiting on Parts',
      rows: safeArray(operationalReport.waitingOnParts),
      columns: jobColumns
    },
    {
      key: 'jobAging',
      title: 'Job Aging',
      rows: safeArray(operationalReport.jobAging),
      columns: [
        ...jobColumns,
        { header: 'Age Days', key: 'ageDays' }
      ]
    },
    {
      key: 'recentWorkActivity',
      title: 'Recent Work Log Activity',
      rows: safeArray(operationalReport.recentWorkActivity),
      columns: [
        { header: 'Date', value: (row) => formatDateTime(row.createdAt, dateOptions) },
        { header: 'Job #', key: 'jobNumber' },
        { header: 'Customer', key: 'customerName' },
        { header: 'Entry', key: 'note' }
      ]
    },
    {
      key: 'lowStockParts',
      title: 'Low Stock Inventory',
      rows: safeArray(operationalReport.lowStockParts),
      columns: [
        { header: 'Part', key: 'name' },
        { header: 'On Hand', key: 'onHand' },
        { header: 'Desired', key: 'desiredStockLevel' },
        { header: 'Vendor', key: 'vendorName' },
        { header: 'Location', key: 'location' },
        { header: 'Barcode', key: 'barcodeLabel' }
      ]
    },
    {
      key: 'purchaseOrders',
      title: 'Purchase Orders',
      rows: safeArray(operationalReport.purchaseOrders),
      columns: [
        { header: 'PO #', key: 'poNumber' },
        { header: 'Vendor', key: 'vendorName' },
        { header: 'Status', value: (row) => formatStatus(row.status) },
        { header: 'Ordered', key: 'orderedQty' },
        { header: 'Received', key: 'receivedQty' },
        { header: 'Remaining', key: 'remainingQty' },
        { header: 'Estimated Total', value: (row) => money(row.estimatedTotal, moneyOptions) },
        { header: 'Shipping', value: (row) => money(row.shippingCost, moneyOptions) }
      ]
    },
    {
      key: 'purchaseHistory',
      title: 'Purchase Landed Cost History',
      rows: safeArray(operationalReport.purchaseHistory),
      columns: [
        { header: 'Received', value: (row) => formatDate(row.receivedAt, dateOptions) },
        { header: 'Part', key: 'partName' },
        { header: 'Vendor', key: 'vendorName' },
        { header: 'Quantity', key: 'quantity' },
        { header: 'Unit Cost', value: (row) => money(row.unitCost, moneyOptions) },
        { header: 'Shipping Allocated', value: (row) => money(row.shippingAllocated, moneyOptions) },
        { header: 'Landed Unit', value: (row) => money(row.landedUnitCost, moneyOptions) },
        { header: 'Total Landed', value: (row) => money(row.totalLandedCost, moneyOptions) },
        { header: 'PO #', key: 'poNumber' }
      ]
    },
    {
      key: 'upcomingScheduleEvents',
      title: 'Upcoming Schedule',
      rows: safeArray(operationalReport.upcomingScheduleEvents),
      columns: [
        { header: 'Date / Time', value: (row) => formatDateTime(row.startsAt, dateOptions) },
        { header: 'Type', value: (row) => formatStatus(row.eventType) },
        { header: 'Title', key: 'title' },
        { header: 'Job #', value: (row) => row.jobNumber || row.jobLabel || '' },
        { header: 'Status', value: (row) => formatStatus(row.status) }
      ]
    }
  ];
}

function getJobExportColumns(dateOptions) {
  return [
    { header: 'Job #', key: 'jobNumber' },
    { header: 'Customer', key: 'customerName' },
    { header: 'Instrument', key: 'instrument' },
    { header: 'Status', key: 'status' },
    { header: 'Priority', key: 'priorityLabel' },
    { header: 'Promise Date', value: (row) => formatDate(row.promiseDate, dateOptions) },
    { header: 'Intake Date', value: (row) => formatDate(row.dateReceived, dateOptions) }
  ];
}

function buildSummaryRows(metrics, operationalReport, moneyOptions) {
  const overview = operationalReport.overview || {};
  return [
    ['Shop Overview', 'Open Jobs', overview.openJobs],
    ['Shop Overview', 'Ready for Pickup', overview.readyForPickup],
    ['Shop Overview', 'Waiting on Parts', overview.waitingOnParts],
    ['Shop Overview', 'Waiting on Customer', overview.waitingOnCustomer],
    ['Shop Overview', 'Overdue Jobs', overview.overdueJobs],
    ['Shop Overview', 'High-Priority Jobs', overview.highPriorityJobs],
    ['Shop Overview', 'Low-Stock Parts', overview.lowStockParts],
    ['Shop Overview', 'Open Purchase Orders', overview.openPurchaseOrders],
    ['Shop Overview', 'Upcoming Schedule Events', overview.upcomingScheduleEvents],
    ['Revenue Snapshot', 'This Month', money(metrics.revenue.thisMonth, moneyOptions)],
    ['Revenue Snapshot', 'Last Month', money(metrics.revenue.lastMonth, moneyOptions)],
    ['Revenue Snapshot', 'Year to Date', money(metrics.revenue.yearToDate, moneyOptions)],
    ['Baseline Metrics', 'Total Customers', metrics.customers.totalCustomers],
    ['Baseline Metrics', 'Repeat Customers', metrics.customers.repeatCustomers],
    ['Baseline Metrics', 'Inventory Value Estimate', money(metrics.inventory.inventoryValueEstimate, moneyOptions)]
  ].map(([section, metric, value]) => ({ section, metric, value: value ?? '-' }));
}

function getReportScopeText(filters = DEFAULT_REPORT_FILTERS) {
  return [
    'Open-job operational sections',
    `status summary: ${formatStatusMode(filters.jobStatusMode)}`,
    `work logs: ${formatDaysFilter(filters.recentActivityDays)}`,
    `purchase history: ${formatDaysFilter(filters.purchaseHistoryDays)}`,
    'schedule: next 30 days'
  ].join(' | ');
}

function formatDaysFilter(value) {
  if (value === 'all') {
    return 'all loaded rows';
  }
  return `last ${value} days`;
}

function formatStatusMode(value) {
  if (value === 'open') {
    return 'open statuses';
  }
  if (value === 'closed') {
    return 'closed statuses';
  }
  return 'all loaded statuses';
}

function filterStatusRows(rows, mode = 'all') {
  const safeRows = safeArray(rows);
  if (mode === 'open') {
    return safeRows.filter((row) => !isClosedReportStatus(row.status));
  }
  if (mode === 'closed') {
    return safeRows.filter((row) => isClosedReportStatus(row.status));
  }
  return safeRows;
}

function isClosedReportStatus(value) {
  return CLOSED_REPORT_STATUSES.has(String(value || '').trim().toLowerCase().replace(/_/g, ' '));
}

function filterRowsWithinLastDays(rows, dateKey, dayValue) {
  const safeRows = safeArray(rows);
  if (dayValue === 'all') {
    return safeRows;
  }

  const days = Number(dayValue);
  if (!Number.isFinite(days) || days <= 0) {
    return safeRows;
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return safeRows.filter((row) => {
    const date = parseReportDate(row?.[dateKey]);
    return date ? date >= cutoff : false;
  });
}

function normalizeOperationalReport(report = {}) {
  const normalized = {
    ...getEmptyOperationalReport(),
    ...report
  };
  normalized.overview = {
    ...getEmptyOperationalReport().overview,
    ...(report.overview || {})
  };
  for (const key of [
    'jobsByStatus',
    'priorityReport',
    'overdueJobs',
    'readyForPickup',
    'waitingOnParts',
    'waitingOnCustomer',
    'jobAging',
    'recentWorkActivity',
    'lowStockParts',
    'purchaseOrders',
    'purchaseHistory',
    'upcomingScheduleEvents'
  ]) {
    normalized[key] = safeArray(report[key]);
  }
  return normalized;
}

function getEmptyOperationalReport() {
  return {
    overview: {
      openJobs: 0,
      readyForPickup: 0,
      waitingOnParts: 0,
      waitingOnCustomer: 0,
      overdueJobs: 0,
      highPriorityJobs: 0,
      lowStockParts: 0,
      openPurchaseOrders: 0,
      upcomingScheduleEvents: 0
    },
    jobsByStatus: [],
    priorityReport: [],
    overdueJobs: [],
    readyForPickup: [],
    waitingOnParts: [],
    waitingOnCustomer: [],
    jobAging: [],
    recentWorkActivity: [],
    lowStockParts: [],
    purchaseOrders: [],
    purchaseHistory: [],
    upcomingScheduleEvents: []
  };
}

function getEmptyReportMetrics() {
  return {
    revenue: { thisMonth: 0, lastMonth: 0, yearToDate: 0 },
    jobs: { openJobs: 0, completedJobs: 0, averageCompletionTimeDays: null },
    customers: { totalCustomers: 0, newCustomersThisMonth: 0, repeatCustomers: 0 },
    inventory: { lowStockCount: 0, totalParts: 0, inventoryValueEstimate: 0 }
  };
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function parseReportDate(value) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

class ReportSectionErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error(`Report section failed: ${this.props.title || 'Untitled report section'}`, error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <section className="report-section-error">
          <h3>{this.props.title || 'Report section'}</h3>
          <p>This report section could not load. Other reports are still available.</p>
        </section>
      );
    }

    return this.props.children;
  }
}

function ReportSection({ children, description, title }) {
  return (
    <ReportSectionErrorBoundary title={title}>
      <section className="report-card-section">
        <div>
          <h3>{title}</h3>
          {description && <p className="muted-text">{description}</p>}
        </div>
        <div className="report-card-grid">{children}</div>
      </section>
    </ReportSectionErrorBoundary>
  );
}

function ReportDetails({ children, description, exportConfig, onExport, title }) {
  return (
    <ReportSectionErrorBoundary title={title}>
      <details className="report-detail-section" open>
        <summary>
          <span>{title}</span>
          {description && <small>{description}</small>}
          {exportConfig && onExport && (
            <button
              type="button"
              className="button-tertiary report-export-button no-print"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onExport(exportConfig);
              }}
            >
              Export CSV
            </button>
          )}
        </summary>
        {children}
      </details>
    </ReportSectionErrorBoundary>
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

function ReportFilterBar({ filters, onChange }) {
  function updateFilter(key, value) {
    onChange((current) => ({
      ...current,
      [key]: value
    }));
  }

  return (
    <section className="report-filter-bar no-print" aria-label="Report filters">
      <label>
        Job status summary
        <select value={filters.jobStatusMode} onChange={(event) => updateFilter('jobStatusMode', event.target.value)}>
          <option value="all">All loaded statuses</option>
          <option value="open">Open statuses</option>
          <option value="closed">Closed statuses</option>
        </select>
      </label>
      <label>
        Work-log activity
        <select value={filters.recentActivityDays} onChange={(event) => updateFilter('recentActivityDays', event.target.value)}>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
          <option value="365">Last 12 months</option>
          <option value="all">All loaded activity</option>
        </select>
      </label>
      <label>
        Purchase history
        <select value={filters.purchaseHistoryDays} onChange={(event) => updateFilter('purchaseHistoryDays', event.target.value)}>
          <option value="90">Last 90 days</option>
          <option value="365">Last 12 months</option>
          <option value="all">All loaded history</option>
        </select>
      </label>
    </section>
  );
}

function ReportTable({ emptyText, headers, renderRow, rows }) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const [showAll, setShowAll] = useState(false);
  const canShowAll = safeRows.length <= REPORT_SHOW_ALL_ROW_LIMIT;
  const limit = showAll && canShowAll ? REPORT_SHOW_ALL_ROW_LIMIT : REPORT_PREVIEW_ROW_LIMIT;
  const { rows: visibleRows, total, isLimited } = limitReportRows(safeRows, limit);

  if (!total) {
    return <p className="empty-state">{emptyText}</p>;
  }

  return (
    <>
      <div className="report-row-limit-notice">
        <span>
          Showing {visibleRows.length} of {total} rows.
          {total > REPORT_EXPORT_ROW_LIMIT ? ` CSV export is capped at ${REPORT_EXPORT_ROW_LIMIT} rows.` : ''}
        </span>
        {isLimited && canShowAll && (
          <button type="button" className="button-tertiary no-print" onClick={() => setShowAll(true)}>Show all visible rows</button>
        )}
        {isLimited && !canShowAll && (
          <span>Preview capped at {REPORT_PREVIEW_ROW_LIMIT} rows to keep Reports responsive.</span>
        )}
      </div>
      <div className="report-table-wrap">
        <table className="report-table">
          <thead>
            <tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr>
          </thead>
          <tbody>{visibleRows.map(renderRow)}</tbody>
        </table>
      </div>
    </>
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

function formatDateTime(value, dateOptions) {
  return formatShopDateTime(value, dateOptions) || DASH;
}

function formatStatus(value = '') {
  return String(value || '')
    .replace(/_/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ') || '-';
}

function downloadTextFile(filename, contents, type) {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
