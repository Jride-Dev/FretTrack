import { useEffect, useMemo, useState } from 'react';
import { money } from '../../shared/utils/money';
import { canUseAdvancedReporting } from '../billing/entitlementService';
import { listParts } from '../inventory/inventoryService';
import { getCurrentShopId, getShopMoneyOptions } from '../shops/shopConfig';
import { buildAdvancedReportMetrics } from './advancedReportsService';

export default function AdvancedReportsPage({
  customers = [],
  entitlementSnapshot = null,
  jobs = [],
  onNotice,
  shopId = getCurrentShopId(),
  shopProfile = null
}) {
  const isEntitled = canUseAdvancedReporting(entitlementSnapshot);
  const [parts, setParts] = useState([]);
  const [isLoadingInventory, setIsLoadingInventory] = useState(false);
  const moneyOptions = getShopMoneyOptions(shopProfile || undefined);
  const metrics = useMemo(() => buildAdvancedReportMetrics({
    jobs,
    customers,
    parts,
    shopId,
    shopProfile
  }), [customers, jobs, parts, shopId, shopProfile]);

  useEffect(() => {
    if (!isEntitled || !shopId) {
      setParts([]);
      return undefined;
    }

    let isMounted = true;
    setIsLoadingInventory(true);
    listParts(shopId, { activeOnly: false })
      .then((loadedParts) => {
        if (isMounted) {
          setParts(loadedParts);
        }
      })
      .catch((error) => {
        console.error('Advanced reports inventory load failed.', error);
        onNotice?.({ type: 'error', message: error.message || 'Unable to load inventory report metrics.' });
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingInventory(false);
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
            <p className="muted-text">Advanced Reporting is available on Pro. Core shop workflows remain available on the free tier.</p>
          </div>
          <span className="billing-status">Pro</span>
        </div>
        <section className="premium-placeholder">
          <h3>Advanced Reporting</h3>
          <p>Revenue, customer, completion-time, and inventory analytics unlock here when Pro reporting is enabled for this shop.</p>
        </section>
      </section>
    );
  }

  return (
    <section className="panel advanced-reports-page">
      <div className="panel-heading">
        <div>
          <h2>Reports</h2>
          <p className="muted-text">Advanced Reporting Phase 1. Cards only: no charts, exports, PDFs, or billing actions.</p>
        </div>
        {isLoadingInventory && <span className="muted-text">Loading inventory...</span>}
      </div>

      <ReportSection title="Revenue">
        <MetricCard label="This Month" value={money(metrics.revenue.thisMonth, moneyOptions)} />
        <MetricCard label="Last Month" value={money(metrics.revenue.lastMonth, moneyOptions)} />
        <MetricCard label="Year to Date" value={money(metrics.revenue.yearToDate, moneyOptions)} />
      </ReportSection>

      <ReportSection title="Jobs">
        <MetricCard label="Open Jobs" value={metrics.jobs.openJobs} />
        <MetricCard label="Completed Jobs" value={metrics.jobs.completedJobs} />
        <MetricCard label="Avg Completion Time" value={formatDays(metrics.jobs.averageCompletionTimeDays)} />
      </ReportSection>

      <ReportSection title="Customers">
        <MetricCard label="Total Customers" value={metrics.customers.totalCustomers} />
        <MetricCard label="New This Month" value={metrics.customers.newCustomersThisMonth} />
        <MetricCard label="Repeat Customers" value={metrics.customers.repeatCustomers} />
      </ReportSection>

      <ReportSection title="Inventory">
        <MetricCard label="Low Stock Count" value={metrics.inventory.lowStockCount} />
        <MetricCard label="Total Parts" value={metrics.inventory.totalParts} />
        <MetricCard label="Inventory Value Estimate" value={money(metrics.inventory.inventoryValueEstimate, moneyOptions)} />
      </ReportSection>
    </section>
  );
}

function ReportSection({ children, title }) {
  return (
    <section className="report-card-section">
      <h3>{title}</h3>
      <div className="report-card-grid">{children}</div>
    </section>
  );
}

function MetricCard({ label, value }) {
  return (
    <div className="report-metric-card">
      <span>{label}</span>
      <strong>{value ?? '-'}</strong>
    </div>
  );
}

function formatDays(value) {
  if (!Number.isFinite(value)) {
    return '-';
  }
  return `${value.toFixed(1)} days`;
}
