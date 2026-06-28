import { useMemo, useState } from 'react';
import Papa from 'papaparse';
import { addCustomer } from './customerService';
import {
  CUSTOMER_IMPORT_SOURCE,
  CUSTOMER_IMPORT_TEMPLATE_PATH,
  buildCustomerImportIssueRows,
  buildCustomerImportPreview,
  customerCsvImportFields,
  detectCustomerCsvMapping,
  generateCustomerImportBatchId,
  serializeImportRowsToCsv,
  summarizeCustomerImportPreview
} from './customerCsvImport';
import { getCurrentShopId } from '../shops/shopConfig';

export default function CustomerImportModal({
  canImport = false,
  existingCustomers = [],
  onClose,
  onImportComplete,
  onNotice
}) {
  const [fileName, setFileName] = useState('');
  const [headers, setHeaders] = useState([]);
  const [rows, setRows] = useState([]);
  const [mapping, setMapping] = useState({});
  const [parseError, setParseError] = useState('');
  const [importBatchId, setImportBatchId] = useState(() => generateCustomerImportBatchId());
  const [isImporting, setIsImporting] = useState(false);
  const [importSummary, setImportSummary] = useState(null);
  const [importFailures, setImportFailures] = useState([]);
  const shopId = getCurrentShopId();

  const previewRows = useMemo(() => buildCustomerImportPreview({
    rows,
    mapping,
    existingCustomers,
    shopId,
    importBatchId
  }), [existingCustomers, importBatchId, mapping, rows, shopId]);

  const summary = useMemo(() => summarizeCustomerImportPreview(previewRows), [previewRows]);
  const issueRows = useMemo(() => [
    ...buildCustomerImportIssueRows(previewRows),
    ...importFailures.map((failure) => ({
      row_number: failure.rowNumber,
      name: failure.customer?.displayName || '',
      email: failure.customer?.email || '',
      phone: failure.customer?.phone || '',
      address: failure.customer?.addressLine1 || '',
      notes: failure.customer?.notes || '',
      error: failure.error,
      warnings: failure.warnings?.join(' ') || '',
      original_values: JSON.stringify(failure.row || {})
    }))
  ], [importFailures, previewRows]);

  function handleFileChange(event) {
    const file = event.target.files?.[0];
    resetImportState();

    if (!file) {
      return;
    }

    setFileName(file.name);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: false,
      transformHeader: (header) => header.trim(),
      complete: (result) => {
        const parsedHeaders = (result.meta.fields || []).filter(Boolean);
        const parsedRows = Array.isArray(result.data) ? result.data : [];
        const firstError = result.errors?.find((error) => error?.message);

        if (!parsedHeaders.length) {
          setParseError('No CSV headers were found.');
          return;
        }

        if (firstError) {
          setParseError(`CSV parse warning: ${firstError.message}`);
        }

        setHeaders(parsedHeaders);
        setRows(parsedRows);
        setMapping(detectCustomerCsvMapping(parsedHeaders));
        setImportBatchId(generateCustomerImportBatchId());
      },
      error: (error) => {
        setParseError(error.message || 'CSV parse failed.');
      }
    });
  }

  function handleMappingChange(field, value) {
    setImportSummary(null);
    setImportFailures([]);
    setMapping((current) => ({
      ...current,
      [field]: value
    }));
  }

  async function handleImport() {
    if (!canImport) {
      onNotice?.({ type: 'error', message: 'Only owners and admins can import customers.' });
      return;
    }

    const importableRows = previewRows.filter((row) => row.importable);
    if (!importableRows.length) {
      onNotice?.({ type: 'warning', message: 'No valid customer rows are ready to import.' });
      return;
    }

    const skippedCount = summary.total - importableRows.length;
    const confirmed = window.confirm(
      `Import ${importableRows.length} customer row${importableRows.length === 1 ? '' : 's'}?`
      + (skippedCount ? ` ${skippedCount} duplicate or error row${skippedCount === 1 ? '' : 's'} will be skipped.` : '')
    );

    if (!confirmed) {
      return;
    }

    setIsImporting(true);
    setImportSummary(null);
    setImportFailures([]);
    const savedCustomers = [];
    const failures = [];

    for (const row of importableRows) {
      try {
        const savedCustomer = await addCustomer({
          ...row.customer,
          importSource: CUSTOMER_IMPORT_SOURCE,
          importBatchId
        }, { shopId, saveLocalBeforeRemote: false });
        savedCustomers.push(savedCustomer);
      } catch (error) {
        failures.push({
          rowNumber: row.rowNumber,
          customer: row.customer,
          row: row.row,
          warnings: row.warnings,
          error: error.message || 'Customer save failed.'
        });
      }
    }

    setIsImporting(false);
    setImportFailures(failures);
    setImportSummary({
      attempted: importableRows.length,
      saved: savedCustomers.length,
      failed: failures.length,
      skipped: skippedCount,
      batchId: importBatchId
    });

    if (savedCustomers.length) {
      await onImportComplete?.(savedCustomers);
    }

    onNotice?.({
      type: failures.length ? 'warning' : 'success',
      message: failures.length
        ? `Imported ${savedCustomers.length} customer${savedCustomers.length === 1 ? '' : 's'}; ${failures.length} row${failures.length === 1 ? '' : 's'} failed.`
        : `Imported ${savedCustomers.length} customer${savedCustomers.length === 1 ? '' : 's'}.`
    });
  }

  function handleDownloadIssues() {
    if (!issueRows.length) {
      onNotice?.({ type: 'success', message: 'No skipped or error rows to download.' });
      return;
    }

    downloadTextFile(
      `frettrack-customer-import-issues-${new Date().toISOString().slice(0, 10)}.csv`,
      serializeImportRowsToCsv(issueRows),
      'text/csv;charset=utf-8'
    );
  }

  function resetImportState() {
    setFileName('');
    setHeaders([]);
    setRows([]);
    setMapping({});
    setParseError('');
    setImportSummary(null);
    setImportFailures([]);
    setImportBatchId(generateCustomerImportBatchId());
  }

  return (
    <div className="feedback-backdrop no-print" role="presentation" onClick={onClose}>
      <div
        className="feedback-modal customer-import-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Import customers from CSV"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="feedback-modal-heading">
          <div>
            <h2>Import Customers</h2>
            <p>CSV import for existing customer lists. Duplicates and rows with errors are skipped by default.</p>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close customer import">Close</button>
        </div>

        {!canImport ? (
          <section className="panel customer-import-denied">
            <h3>Access Denied</h3>
            <p className="muted-text">Only shop owners and admins can import customers.</p>
          </section>
        ) : (
          <div className="customer-import-flow">
            <section className="customer-import-step">
              <h3>Step 1: Download Template</h3>
              <p className="muted-text">Use the template columns or map your existing CSV headers below.</p>
              <a className="button-like" href={CUSTOMER_IMPORT_TEMPLATE_PATH} download>Download Customer CSV Template</a>
            </section>

            <section className="customer-import-step">
              <h3>Step 2: Upload CSV</h3>
              <label>
                Customer CSV
                <input type="file" accept=".csv,text/csv" onChange={handleFileChange} />
              </label>
              {fileName && <p className="muted-text">Loaded: {fileName}</p>}
              {parseError && <p className="form-warning">{parseError}</p>}
            </section>

            {headers.length > 0 && (
              <section className="customer-import-step">
                <h3>Step 3: Map Columns</h3>
                <div className="customer-import-mapping-grid">
                  {customerCsvImportFields.map((field) => (
                    <label key={field.key}>
                      {field.label}
                      <select value={mapping[field.key] || ''} onChange={(event) => handleMappingChange(field.key, event.target.value)}>
                        <option value="">Not mapped</option>
                        {headers.map((header) => (
                          <option key={`${field.key}-${header}`} value={header}>{header}</option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
              </section>
            )}

            {previewRows.length > 0 && (
              <section className="customer-import-step">
                <div className="customer-import-preview-heading">
                  <div>
                    <h3>Step 4: Preview and Validate</h3>
                    <p className="muted-text">Valid and warning rows can import. Duplicate and error rows are skipped.</p>
                  </div>
                  <button type="button" className="button-tertiary" onClick={handleDownloadIssues}>
                    Download Skipped/Error Rows
                  </button>
                </div>

                <div className="customer-import-summary">
                  <SummaryChip label="Rows" value={summary.total} />
                  <SummaryChip label="Ready" value={summary.importable} />
                  <SummaryChip label="Warnings" value={summary.warning} />
                  <SummaryChip label="Duplicates" value={summary.duplicate} />
                  <SummaryChip label="Errors" value={summary.error} />
                  <SummaryChip label="Skipped" value={summary.skipped} />
                </div>

                <div className="table-wrap customer-import-table-wrap">
                  <table className="customer-history-table customer-import-table">
                    <thead>
                      <tr>
                        <th>Row</th>
                        <th>Status</th>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Phone</th>
                        <th>Address</th>
                        <th>Issues</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.slice(0, 100).map((row) => (
                        <tr key={`${row.rowNumber}-${row.customer.id}`}>
                          <td>{row.rowNumber}</td>
                          <td><span className={`status-badge customer-import-status ${row.status}`}>{getStatusLabel(row.status)}</span></td>
                          <td>{row.customer.displayName || '-'}</td>
                          <td>{row.customer.email || '-'}</td>
                          <td>{row.customer.phone || '-'}</td>
                          <td>{row.customer.addressLine1 || '-'}</td>
                          <td>{[...row.errors, ...row.warnings].join(' ') || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {previewRows.length > 100 && <p className="muted-text">Showing first 100 preview rows.</p>}
              </section>
            )}

            {previewRows.length > 0 && (
              <section className="customer-import-step">
                <h3>Step 5: Import</h3>
                <p className="muted-text">Import source will be saved as <strong>csv</strong>. Batch ID: <code>{importBatchId}</code></p>
                <div className="mode-actions">
                  <button type="button" className="primary-action" onClick={handleImport} disabled={isImporting || !summary.importable}>
                    {isImporting ? 'Importing...' : `Import ${summary.importable} Customer${summary.importable === 1 ? '' : 's'}`}
                  </button>
                  <button type="button" className="button-tertiary" onClick={resetImportState} disabled={isImporting}>Reset Import</button>
                </div>
              </section>
            )}

            {importSummary && (
              <section className="customer-import-step">
                <h3>Step 6: Summary</h3>
                <p>
                  Imported {importSummary.saved} of {importSummary.attempted} attempted customer rows.
                  {importSummary.skipped ? ` ${importSummary.skipped} duplicate/error row${importSummary.skipped === 1 ? '' : 's'} skipped.` : ''}
                  {importSummary.failed ? ` ${importSummary.failed} row${importSummary.failed === 1 ? '' : 's'} failed while saving.` : ''}
                </p>
                <p className="muted-text">Import batch: <code>{importSummary.batchId}</code></p>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryChip({ label, value }) {
  return (
    <span className="customer-import-chip">
      <strong>{value}</strong>
      {label}
    </span>
  );
}

function getStatusLabel(status) {
  if (status === 'valid') return 'Ready';
  if (status === 'warning') return 'Warning';
  if (status === 'duplicate') return 'Duplicate';
  if (status === 'error') return 'Error';
  return 'Skipped';
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
