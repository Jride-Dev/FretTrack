import { formatShopDate } from '../../../../shared/utils/dateFormat.js';
import { formatInstrumentLabel } from '../../../instruments/instrumentService.js';
import { getShopDateOptions } from '../../../shops/shopConfig.js';
import { getJobPriorityLabel, getJobPriorityOption } from '../../jobPriority.js';
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
        <span>Instrument</span><strong>{[formatInstrumentLabel(draftJob), draftJob.guitarBrand, draftJob.model].filter(Boolean).join(' ') || '-'}</strong>
        <span>Serial</span><strong>{draftJob.serial || '-'}</strong>
        <span>Intake Date</span><strong>{formatShopDate(draftJob.dateReceived, dateOptions) || '-'}</strong>
        <span>Promise Date</span><strong>{formatShopDate(draftJob.promiseDate || draftJob.dueDate || draftJob.promisedDate || draftJob.techDetails?.dueDate, dateOptions) || '-'}</strong>
        <span>Priority</span>
        <strong>
          <span className={`priority-badge ${getJobPriorityOption(draftJob.priority || draftJob.techDetails?.priority).className}`}>
            {getJobPriorityLabel(draftJob.priority || draftJob.techDetails?.priority)}
          </span>
        </strong>
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
