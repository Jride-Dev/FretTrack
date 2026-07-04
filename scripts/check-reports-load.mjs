import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  REPORT_EXPORT_ROW_LIMIT,
  REPORT_PREVIEW_ROW_LIMIT,
  REPORT_SHOW_ALL_ROW_LIMIT,
  buildReportCsv,
  escapeCsvValue,
  limitReportRows,
  safeReportFilename
} from '../src/modules/reports/reportExport.js';

const root = process.cwd();

function read(relativePath) {
  return readFileSync(join(root, relativePath), 'utf8');
}

const reportsPage = read('src/modules/reports/AdvancedReportsPage.jsx');
const styles = read('src/styles.css');

assert.ok(
  reportsPage.includes('formatDateTime('),
  'AdvancedReportsPage should still exercise report date/time formatting.'
);

assert.ok(
  /function\s+formatDateTime\s*\(/.test(reportsPage) || /import\s+\{[^}]*formatDateTime/.test(reportsPage),
  'AdvancedReportsPage references formatDateTime but does not define or import it.'
);

assert.ok(
  reportsPage.includes('return formatShopDateTime(value, dateOptions) || DASH;'),
  'Reports date/time helper should show an em dash for missing or invalid values.'
);

assert.ok(reportsPage.includes('window.print()'), 'Reports must include a browser print action.');
assert.ok(reportsPage.includes('Export CSV'), 'Reports must expose per-section CSV export actions.');
assert.ok(reportsPage.includes('ReportSectionErrorBoundary'), 'Reports must contain section-level error boundaries.');
assert.ok(reportsPage.includes('ReportFilterBar'), 'Reports must contain report filter controls.');
assert.ok(reportsPage.includes('jobStatusMode'), 'Reports must include a status summary filter.');
assert.ok(reportsPage.includes('buildReportExportSections'), 'Reports must define export sections.');
assert.ok(
  reportsPage.includes('Track estimates, jobs, inventory activity, and shop performance from one dashboard.'),
  'Reports page must use the product-facing dashboard subtitle.'
);
[
  'Advanced Reporting: Yes',
  'Real shop data only',
  'no charts, exports, PDFs',
  'Stripe, or billing actions',
  'in this phase',
  'Phase 1 metrics'
].forEach((leakedPhrase) => {
  assert.equal(
    reportsPage.includes(leakedPhrase),
    false,
    `Reports page must not expose internal/release-note copy: ${leakedPhrase}`
  );
});
assert.ok(styles.includes('@media print'), 'Print stylesheet must exist.');
assert.ok(styles.includes('.advanced-reports-page'), 'Reports print/screen CSS must target the reports page.');

assert.equal(REPORT_PREVIEW_ROW_LIMIT, 25, 'Report preview limit should stay 25 rows.');
assert.equal(REPORT_SHOW_ALL_ROW_LIMIT, 250, 'Show-all visible row limit should stay 250 rows.');
assert.equal(REPORT_EXPORT_ROW_LIMIT, 1000, 'Report export limit should stay 1000 rows.');

const largeRows = Array.from({ length: 1500 }, (_, index) => ({
  name: `Customer, ${index}`,
  note: `Quoted "note"\nline ${index}`
}));
const preview = limitReportRows(largeRows);
assert.equal(preview.rows.length, REPORT_PREVIEW_ROW_LIMIT, 'Large report previews must be capped.');
assert.equal(preview.total, largeRows.length, 'Large report previews must preserve total row count.');
assert.equal(preview.isLimited, true, 'Large report previews should report limited state.');

const csvResult = buildReportCsv({
  columns: [
    { header: 'Name', key: 'name' },
    { header: 'Note', key: 'note' }
  ],
  rows: largeRows
});
assert.equal(csvResult.exportedRows, REPORT_EXPORT_ROW_LIMIT, 'Large CSV exports must cap exported rows.');
assert.equal(csvResult.totalRows, largeRows.length, 'Large CSV exports must preserve total row count.');
assert.equal(csvResult.wasCapped, true, 'Large CSV exports should report capped state.');
assert.match(csvResult.csv, /"Customer, 0"/, 'CSV export must quote comma-containing values.');
assert.match(csvResult.csv, /"Quoted ""note""\nline 0"/, 'CSV export must escape quotes and newlines.');
assert.equal(escapeCsvValue('plain'), 'plain', 'Plain CSV values should stay plain.');
assert.equal(escapeCsvValue('a,b'), '"a,b"', 'CSV values with commas should be quoted.');
assert.equal(escapeCsvValue('a"b'), '"a""b"', 'CSV values with quotes should be escaped.');

assert.equal(
  safeReportFilename('Purchase / Landed Cost History', new Date('2026-06-27T12:00:00Z')),
  'frettrack-purchase-landed-cost-history-2026-06-27.csv',
  'Report export filenames must be stable and safe.'
);

console.log('Reports load checks passed.');
