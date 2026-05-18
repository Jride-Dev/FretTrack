import { formatShopDate } from '../../../../shared/utils/dateFormat.js';
import { getShopDateOptions } from '../../../shops/shopConfig.js';
import JobStatusSelect from '../../JobStatusSelect.jsx';

export default function OverviewTab({ draftJob, isDirty, updateField, printActions }) {
  const dateOptions = getShopDateOptions(draftJob.techDetails?.tax);

  return (
    <section className="job-tab-panel">
      <div className="overview-grid">
        <div>
          <h3>Overview</h3>
          <p>Job {draftJob.jobNumber || 'Not assigned'}</p>
        </div>
        <JobStatusSelect value={draftJob.status} onChange={updateField} />
      </div>
      <div className="print-grid">
        <span>Customer</span><strong>{draftJob.customerName || '-'}</strong>
        <span>Contact</span><strong>{[draftJob.phone, draftJob.email].filter(Boolean).join(' | ') || '-'}</strong>
        <span>Instrument</span><strong>{[draftJob.instrumentType, draftJob.guitarBrand, draftJob.model].filter(Boolean).join(' ') || '-'}</strong>
        <span>Serial</span><strong>{draftJob.serial || '-'}</strong>
        <span>Intake Date</span><strong>{formatShopDate(draftJob.dateReceived, dateOptions) || '-'}</strong>
        <span>Promised / Due</span><strong>{formatShopDate(draftJob.dueDate || draftJob.promisedDate || draftJob.techDetails?.dueDate, dateOptions) || '-'}</strong>
        <span>Priority</span><strong>{draftJob.priority || draftJob.techDetails?.priority || '-'}</strong>
        <span>Unsaved Changes</span><strong>{isDirty ? 'Yes' : 'No'}</strong>
      </div>
      <label className="wide">
        Quick Notes
        <textarea name="reasonForVisit" value={draftJob.reasonForVisit || ''} onChange={updateField} rows="4" />
      </label>
      {printActions}
    </section>
  );
}
