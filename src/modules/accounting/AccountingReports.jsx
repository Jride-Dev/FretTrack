import { useMemo, useState } from 'react';
import { money } from '../../shared/utils/money';
import { buildAccountingReport, getDefaultAccountingDateRange } from './accountingSelectors';
import { downloadAccountingCsv } from './accountingExport';

const defaultRange = getDefaultAccountingDateRange();

export default function AccountingReports({ jobs = [], shopId = '' }) {
  const [dateRange, setDateRange] = useState(defaultRange);
  const report = useMemo(() => buildAccountingReport(jobs, {
    shopId,
    startDate: dateRange.start,
    endDate: dateRange.end
  }), [jobs, shopId, dateRange.start, dateRange.end]);

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
          <p className="muted-text">Operational summaries for tax prep and bookkeeping handoff.</p>
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
        <p>{dateRange.start} to {dateRange.end}</p>
      </div>

      <div className="accounting-summary-grid">
        <SummaryCard label="Job Totals" value={money(report.summary.jobTotals)} />
        <SummaryCard label="Paid In" value={money(report.summary.paidTotal)} />
        <SummaryCard label="Open Balances" value={money(report.summary.outstandingBalance)} />
        <SummaryCard label="Tax Collected" value={money(report.summary.taxCollected)} />
        <SummaryCard label="Parts Revenue" value={money(report.summary.partsRevenue)} />
        <SummaryCard label="Labor Revenue" value={money(report.summary.laborRevenue)} />
        <SummaryCard label="Discounts" value={money(report.summary.discounts)} />
        <SummaryCard label="Refunds / Voids" value={money(report.summary.refundsAndVoids)} />
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
            <td>{money(row.amount)}</td>
          </tr>
        )}
      />

      <ReportTable
        title="Tax Collected"
        emptyText="No taxable jobs in this date range."
        headers={['Jurisdiction', 'Tax %', 'Taxable', 'Non-Taxable', 'Tax']}
        rows={report.taxCollected}
        renderRow={(row) => (
          <tr key={row.jurisdiction}>
            <td>{row.jurisdiction}</td>
            <td>{row.taxRatePercent}</td>
            <td>{money(row.taxableSubtotal)}</td>
            <td>{money(row.nonTaxableSubtotal)}</td>
            <td>{money(row.taxAmount)}</td>
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
            <td>{money(row.totalDue)}</td>
            <td>{money(row.paidTotal)}</td>
            <td>{money(row.balanceDue)}</td>
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
            <td>{row.period}</td>
            <td>{row.jobCount}</td>
            <td>{money(row.jobTotals)}</td>
            <td>{money(row.paidTotal)}</td>
            <td>{money(row.partsRevenue)}</td>
            <td>{money(row.laborRevenue)}</td>
            <td>{money(row.discounts)}</td>
            <td>{money(row.taxCollected)}</td>
          </tr>
        )}
      />
    </section>
  );
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
