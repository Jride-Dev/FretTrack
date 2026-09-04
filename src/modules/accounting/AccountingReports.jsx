import { useMemo, useState } from 'react';
import { formatShopDate } from '../../shared/utils/dateFormat';
import { money } from '../../shared/utils/money';
import { buildAccountingReport, getDefaultAccountingDateRange } from './accountingSelectors';
import { downloadAccountingCsv } from './accountingExport';

const defaultRange = getDefaultAccountingDateRange();

export default function AccountingReports({ jobs = [], shopId = '', shopProfile = null }) {
  const [dateRange, setDateRange] = useState(defaultRange);
  const [salesFilter, setSalesFilter] = useState('all');
  const report = useMemo(() => buildAccountingReport(jobs, {
    shopId,
    shopProfile,
    startDate: dateRange.start,
    endDate: dateRange.end
  }), [jobs, shopId, shopProfile, dateRange.start, dateRange.end]);
  const moneyOptions = { currency: report.currencyCode, locale: report.locale };
  const dateOptions = { dateFormat: report.dateFormat, locale: report.locale };
  const visibleSalesHistory = report.salesHistory.filter((row) => {
    if (salesFilter === 'open') return row.balanceDue > 0.005;
    if (salesFilter === 'paid') return row.balanceDue <= 0.005;
    return true;
  });

  function updateRange(event) {
    const { name, value } = event.target;
    setDateRange((current) => ({ ...current, [name]: value }));
  }

  function exportCsv() {
    downloadAccountingCsv(report);
  }

  function printSummary() {
    window.print();
  }

  return (
    <section className="panel accounting-report">
      <div className="accounting-header no-print">
        <div>
          <h2>Accounting / Reports</h2>
          <p className="muted-text">Operational summaries for tax prep and bookkeeping handoff. Currency: {report.currencyCode}</p>
        </div>
        <div className="accounting-actions">
          <label>
            Start
            <input type="date" name="start" value={dateRange.start} onChange={updateRange} />
          </label>
          <label>
            End
            <input type="date" name="end" value={dateRange.end} onChange={updateRange} />
          </label>
          <button type="button" onClick={exportCsv}>Export CSV</button>
          <button type="button" onClick={printSummary}>Print / PDF</button>
        </div>
      </div>

      <div className="accounting-print-heading print-only">
        <h2>Accounting Summary</h2>
        <p>{formatShopDate(dateRange.start, dateOptions)} to {formatShopDate(dateRange.end, dateOptions)}</p>
      </div>

      <section className="accounting-tax-profile">
        <div>
          <h3>Active Tax Profile</h3>
          <p className="muted-text">
            Shop default used for new calculations. Existing jobs retain their stored profile snapshot or explicit override.
          </p>
        </div>
        <dl className="accounting-tax-profile-grid">
          <div><dt>Mode</dt><dd>{report.taxProfile.calculationMode === 'manual' ? 'Manual' : 'Disabled'}</dd></div>
          <div><dt>Jurisdiction</dt><dd>{report.taxProfile.jurisdiction || 'Not configured'}</dd></div>
          <div><dt>Default rate</dt><dd>{report.taxProfile.defaultRatePercent}%</dd></div>
          <div><dt>Registration</dt><dd>{report.taxProfile.registrationNumber || 'Not configured'}</dd></div>
          <div><dt>Profile revision</dt><dd>{report.taxProfile.profileRevision || '—'}</dd></div>
          <div><dt>Job overrides in range</dt><dd>{report.taxProfile.jobOverrideCount}</dd></div>
        </dl>
        {report.taxProfile.hasMixedSnapshots && (
          <p className="accounting-tax-profile-warning">
            This range contains more than one tax profile or rate. Review the job-level tax snapshots before filing.
          </p>
        )}
      </section>

      <div className="accounting-summary-grid">
        <SummaryCard label="Job Totals" value={money(report.summary.jobTotals, moneyOptions)} />
        <SummaryCard label="Paid In" value={money(report.summary.paidTotal, moneyOptions)} />
        <SummaryCard label="Open Balances" value={money(report.summary.outstandingBalance, moneyOptions)} />
        <SummaryCard label={`${report.taxLabel} Collected`} value={money(report.summary.taxCollected, moneyOptions)} />
        <SummaryCard label="Parts Revenue" value={money(report.summary.partsRevenue, moneyOptions)} />
        <SummaryCard label="Labor Revenue" value={money(report.summary.laborRevenue, moneyOptions)} />
        <SummaryCard label="Discounts" value={money(report.summary.discounts, moneyOptions)} />
        <SummaryCard label="Refunds / Voids" value={money(report.summary.refundsAndVoids, moneyOptions)} />
      </div>

      <ReportTable
        title="Payments By Method"
        emptyText="No payments in this date range."
        headers={['Method', 'Count', 'Amount']}
        rows={report.paymentsByMethod}
        renderRow={(row) => (
          <tr key={row.method}>
            <td>{row.method}</td>
            <td>{row.count}</td>
            <td>{money(row.amount, moneyOptions)}</td>
          </tr>
        )}
      />

      <section className="accounting-table-section sales-history-section">
        <div className="accounting-table-heading">
          <div>
            <h3>Sales History</h3>
            <p className="muted-text">One row per non-voided work order in the selected range.</p>
          </div>
          <label className="no-print">
            Show
            <select value={salesFilter} onChange={(event) => setSalesFilter(event.target.value)}>
              <option value="all">All sales</option>
              <option value="open">Open balances</option>
              <option value="paid">Paid in full</option>
            </select>
          </label>
        </div>
        {visibleSalesHistory.length ? (
          <table>
            <thead>
              <tr>
                {['Date', 'Job #', 'Customer', 'Status', 'Total', 'Paid', 'Balance', report.taxLabel].map((header) => <th key={header}>{header}</th>)}
              </tr>
            </thead>
            <tbody>
              {visibleSalesHistory.map((row) => (
                <tr key={row.id}>
                  <td>{formatShopDate(row.date, dateOptions)}</td>
                  <td>{row.jobNumber || '—'}</td>
                  <td>{row.customerName || '—'}</td>
                  <td>{row.status || '—'}</td>
                  <td>{money(row.totalDue, moneyOptions)}</td>
                  <td>{money(row.paidTotal, moneyOptions)}</td>
                  <td>{money(row.balanceDue, moneyOptions)}</td>
                  <td>{money(row.taxAmount, moneyOptions)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="empty-state">No sales match this filter.</p>
        )}
      </section>

      <ReportTable
        title={`${report.taxLabel} Collected`}
        emptyText="No taxable jobs in this date range."
        headers={['Jurisdiction', 'Tax %', 'Taxable', 'Non-Taxable', 'Tax']}
        rows={report.taxCollected}
        renderRow={(row) => (
          <tr key={row.jurisdiction}>
            <td>{row.jurisdiction}</td>
            <td>{row.taxRatePercent}</td>
            <td>{money(row.taxableSubtotal, moneyOptions)}</td>
            <td>{money(row.nonTaxableSubtotal, moneyOptions)}</td>
            <td>{money(row.taxAmount, moneyOptions)}</td>
          </tr>
        )}
      />

      <ReportTable
        title="Open Balances"
        emptyText="No open balances for the current shop."
        headers={['Job #', 'Customer', 'Status', 'Total', 'Paid', 'Balance']}
        rows={report.openBalances}
        renderRow={(row) => (
          <tr key={row.jobId}>
            <td>{row.jobNumber}</td>
            <td>{row.customerName}</td>
            <td>{row.status}</td>
            <td>{money(row.totalDue, moneyOptions)}</td>
            <td>{money(row.paidTotal, moneyOptions)}</td>
            <td>{money(row.balanceDue, moneyOptions)}</td>
          </tr>
        )}
      />

      <ReportTable
        title="Monthly Totals"
        emptyText="No jobs in this date range."
        headers={['Month', 'Jobs', 'Job Totals', 'Paid', 'Parts', 'Labor', 'Discounts', 'Tax']}
        rows={report.monthlyTotals}
        renderRow={(row) => (
          <tr key={row.period}>
            <td>{formatPeriod(row.period, dateOptions)}</td>
            <td>{row.jobCount}</td>
            <td>{money(row.jobTotals, moneyOptions)}</td>
            <td>{money(row.paidTotal, moneyOptions)}</td>
            <td>{money(row.partsRevenue, moneyOptions)}</td>
            <td>{money(row.laborRevenue, moneyOptions)}</td>
            <td>{money(row.discounts, moneyOptions)}</td>
            <td>{money(row.taxCollected, moneyOptions)}</td>
          </tr>
        )}
      />
    </section>
  );
}

function formatPeriod(period, dateOptions) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(period)) {
    return formatShopDate(period, dateOptions);
  }
  return period;
}

function SummaryCard({ label, value }) {
  return (
    <div className="accounting-summary-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ReportTable({ title, emptyText, headers, rows, renderRow }) {
  return (
    <section className="accounting-table-section">
      <h3>{title}</h3>
      {rows.length ? (
        <table>
          <thead>
            <tr>
              {headers.map((header) => <th key={header}>{header}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map(renderRow)}
          </tbody>
        </table>
      ) : (
        <p className="empty-state">{emptyText}</p>
      )}
    </section>
  );
}
