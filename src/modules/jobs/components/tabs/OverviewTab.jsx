import JobStatusSelect from '../../JobStatusSelect.jsx';

export default function OverviewTab({ draftJob, isDirty, updateField, printActions }) {
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
        <span>Intake Date</span><strong>{draftJob.dateReceived || '-'}</strong>
        <span>Promised / Due</span><strong>{draftJob.dueDate || draftJob.promisedDate || draftJob.techDetails?.dueDate || '-'}</strong>
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
