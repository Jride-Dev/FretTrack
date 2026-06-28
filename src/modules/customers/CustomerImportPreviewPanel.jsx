import { useMemo, useState } from 'react';
import {
  CUSTOMER_IMPORT_TEMPLATE_PATH,
  CUSTOMER_IMPORT_MAX_ROWS,
  CUSTOMER_IMPORT_PREVIEW_ROW_LIMIT,
  buildCustomerCsvIssueCsv,
  buildCustomerCsvIssueRows,
  buildCustomerCsvPreviewRows,
  detectCustomerCsvMapping,
  isBlankCustomerCsvRow,
  parseCustomerCsvText,
  summarizeCustomerCsvPreview
} from './customerCsvPreview.js';

export default function CustomerImportPreviewPanel({
  canPreview = false,
  existingCustomers = [],
  onClose,
  onNotice
}) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileName, setFileName] = useState('');
  const [parseMessage, setParseMessage] = useState('');
  const [previewState, setPreviewState] = useState(null);
  const [isReading, setIsReading] = useState(false);

  const summary = useMemo(() => summarizeCustomerCsvPreview(previewState?.previewRows || []), [previewState]);
  const issueRows = useMemo(() => buildCustomerCsvIssueRows(previewState?.previewRows || []), [previewState]);
  const visibleRows = (previewState?.previewRows || []).slice(0, CUSTOMER_IMPORT_PREVIEW_ROW_LIMIT);
  const totalPreviewRows = previewState?.previewRows?.length || 0;
  const isLimited = totalPreviewRows > CUSTOMER_IMPORT_PREVIEW_ROW_LIMIT;

  function handleFileChange(event) {
    const file = event.target.files?.[0] || null;
    setSelectedFile(file);
    setFileName(file?.name || '');
    setPreviewState(null);
    setParseMessage('');
  }

  async function handlePreview() {
    if (!canPreview) {
      onNotice?.({ type: 'error', message: 'Only shop owners and admins can preview customer imports.' });
      return;
    }

    if (!selectedFile) {
      setParseMessage('Choose a CSV file first.');
      return;
    }

    setIsReading(true);
    setPreviewState(null);
    setParseMessage('');

    try {
      const csvText = await readFileAsText(selectedFile);
      const parsed = parseCustomerCsvText(csvText);
      const headers = parsed.headers || [];

      if (!headers.length) {
        setParseMessage('No CSV headers were found.');
        return;
      }

      const nonblankRows = (parsed.rows || []).filter((row) => !isBlankCustomerCsvRow(row, headers));
      if (nonblankRows.length > CUSTOMER_IMPORT_MAX_ROWS) {
        setParseMessage(`This CSV has ${nonblankRows.length} nonblank rows. Preview is limited to ${CUSTOMER_IMPORT_MAX_ROWS} rows or fewer.`);
        return;
      }

      const mapping = detectCustomerCsvMapping(headers);
      const previewRows = buildCustomerCsvPreviewRows({
        rows: parsed.rows,
        headers,
        mapping,
        existingCustomers
      });
      const firstParseError = parsed.errors?.find((error) => error?.message);

      setPreviewState({
        fileName: selectedFile.name,
        headers,
        mapping,
        previewRows
      });
      setParseMessage(firstParseError ? `CSV parse warning: ${firstParseError.message}` : '');
    } catch (error) {
      setParseMessage(error instanceof Error ? error.message : 'Unable to read CSV file.');
    } finally {
      setIsReading(false);
    }
  }

  function handleDownloadIssues() {
    if (!issueRows.length) {
      onNotice?.({ type: 'success', message: 'No skipped or error rows to download.' });
      return;
    }

    downloadTextFile(
      `frettrack-customer-import-preview-issues-${new Date().toISOString().slice(0, 10)}.csv`,
      buildCustomerCsvIssueCsv(previewState?.previewRows || []),
      'text/csv;charset=utf-8'
    );
  }

  function handleClear() {
    setSelectedFile(null);
    setFileName('');
    setPreviewState(null);
    setParseMessage('');
  }

  if (!canPreview) {
    return (
      <section className="panel customer-import-preview-panel">
        <div className="panel-heading">
          <div>
            <h2>Customer Import Preview</h2>
            <p className="muted-text">Only shop owners and admins can preview customer imports.</p>
          </div>
          {onClose && <button type="button" className="button-tertiary" onClick={onClose}>Close</button>}
        </div>
      </section>
    );
  }

  return (
    <section className="panel customer-import-preview-panel">
      <div className="panel-heading">
        <div>
          <h2>Customer Import Preview</h2>
          <p className="muted-text">CSV preview only. Database import will be enabled in a later phase after preview testing.</p>
        </div>
        <div className="mode-actions">
          <a className="button-tertiary" href={CUSTOMER_IMPORT_TEMPLATE_PATH} download>
            Download Template
          </a>
          {onClose && <button type="button" className="button-tertiary" onClick={onClose}>Close</button>}
        </div>
      </div>

      <div className="customer-module-toolbar">
        <label>
          Customer CSV
          <input type="file" accept=".csv,text/csv" onChange={handleFileChange} />
        </label>
        {fileName && <p className="muted-text">Selected: {fileName}</p>}
        {parseMessage && <p className="form-warning">{parseMessage}</p>}
        <div className="mode-actions">
          <button type="button" className="primary-action" onClick={handlePreview} disabled={isReading || !selectedFile}>
            {isReading ? 'Reading...' : 'Preview CSV'}
          </button>
          <button type="button" className="button-tertiary" onClick={handleDownloadIssues} disabled={!issueRows.length}>
            Download Skipped/Error CSV
          </button>
          <button type="button" className="button-tertiary" onClick={handleClear} disabled={isReading && !previewState}>
            Clear
          </button>
        </div>
      </div>

      {previewState && (
        <>
          <div className="customer-summary-grid">
            <SummaryItem label="Rows" value={summary.total} />
            <SummaryItem label="Ready" value={summary.valid} />
            <SummaryItem label="Warnings" value={summary.warning} />
            <SummaryItem label="Duplicates" value={summary.duplicate} />
            <SummaryItem label="Errors" value={summary.error} />
            <SummaryItem label="Skipped" value={summary.skipped} />
          </div>

          <p className="muted-text">
            {isLimited ? `Showing ${CUSTOMER_IMPORT_PREVIEW_ROW_LIMIT} of ${totalPreviewRows} rows.` : `Showing ${totalPreviewRows} row${totalPreviewRows === 1 ? '' : 's'}.`}
          </p>

          <div className="inventory-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Row</th>
                  <th>Status</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Address</th>
                  <th>Notes</th>
                  <th>Errors</th>
                  <th>Warnings</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => (
                  <tr key={`${row.rowNumber}-${row.status}`}>
                    <td>{row.rowNumber}</td>
                    <td><span className={`status-pill ${getStatusTone(row.status)}`}>{getStatusLabel(row.status)}</span></td>
                    <td>{row.normalized.name || '-'}</td>
                    <td>{row.normalized.email || '-'}</td>
                    <td>{row.normalized.phone || '-'}</td>
                    <td>{row.normalized.addressLine1 || '-'}</td>
                    <td>{row.normalized.notes || '-'}</td>
                    <td>{row.errors.length ? row.errors.join(' ') : '-'}</td>
                    <td>{row.warnings.length ? row.warnings.join(' ') : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

function SummaryItem({ label, value }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function getStatusLabel(status) {
  if (status === 'valid') return 'Ready';
  if (status === 'warning') return 'Warning';
  if (status === 'duplicate') return 'Duplicate';
  if (status === 'error') return 'Error';
  if (status === 'skipped') return 'Skipped';
  return status || 'Unknown';
}

function getStatusTone(status) {
  if (status === 'valid') return 'success';
  if (status === 'warning' || status === 'duplicate') return 'warning';
  if (status === 'error') return 'warning';
  return 'muted';
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Unable to read CSV file.'));
    reader.readAsText(file);
  });
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
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
