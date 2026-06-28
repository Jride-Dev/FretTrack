export const REPORT_PREVIEW_ROW_LIMIT = 25;
export const REPORT_SHOW_ALL_ROW_LIMIT = 250;
export const REPORT_EXPORT_ROW_LIMIT = 1000;

export function limitReportRows(rows = [], limit = REPORT_PREVIEW_ROW_LIMIT) {
  const safeRows = Array.isArray(rows) ? rows : [];
  return {
    rows: safeRows.slice(0, limit),
    total: safeRows.length,
    isLimited: safeRows.length > limit
  };
}

export function buildReportCsv({ columns = [], rows = [], limit = REPORT_EXPORT_ROW_LIMIT } = {}) {
  const safeColumns = Array.isArray(columns) ? columns : [];
  const safeRows = Array.isArray(rows) ? rows : [];
  const cappedRows = safeRows.slice(0, limit);
  const headerLine = safeColumns.map((column) => escapeCsvValue(column.header || column.key || '')).join(',');
  const rowLines = cappedRows.map((row) => safeColumns
    .map((column) => escapeCsvValue(readColumnValue(row, column)))
    .join(','));

  return {
    csv: `${[headerLine, ...rowLines].join('\n')}\n`,
    exportedRows: cappedRows.length,
    totalRows: safeRows.length,
    wasCapped: safeRows.length > limit
  };
}

export function safeReportFilename(reportName = 'report', date = new Date()) {
  const slug = String(reportName || 'report')
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'report';
  const stamp = formatFilenameDate(date);
  return `frettrack-${slug}-${stamp}.csv`;
}

export function escapeCsvValue(value) {
  const text = String(value ?? '');
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function readColumnValue(row, column = {}) {
  if (typeof column.value === 'function') {
    return column.value(row);
  }
  return row?.[column.key] ?? '';
}

function formatFilenameDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'unknown-date';
  }

  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
