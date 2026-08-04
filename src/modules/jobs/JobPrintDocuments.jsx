import CustomerDamageReport from './CustomerDamageReport';
import JobDamageReportView from './JobDamageReportView.jsx';
import JobPrintSheet from './JobPrintSheet';

export default function JobPrintDocuments({
  draftJob,
  formatInstrumentLabel,
  formatMeasurementDelta,
  lengthUnit,
  normalizeInstrumentType,
  outerStringLabels,
  parts,
  services,
  shopSettings,
  totals,
  workOrderImages
}) {
  function renderDamageView(viewName) {
    return <JobDamageReportView damageMap={draftJob.techDetails.damageMap || {}} viewName={viewName} />;
  }

  return (
    <>
      <JobPrintSheet
        draftJob={draftJob}
        formatInstrumentLabel={formatInstrumentLabel}
        lengthUnit={lengthUnit}
        normalizeInstrumentType={normalizeInstrumentType}
        outerStringLabels={outerStringLabels}
        parts={parts}
        services={services}
        shopSettings={shopSettings}
        totals={totals}
      />
      <CustomerDamageReport
        draftJob={draftJob}
        formatInstrumentLabel={formatInstrumentLabel}
        formatMeasurementDelta={formatMeasurementDelta}
        lengthUnit={lengthUnit}
        outerStringLabels={outerStringLabels}
        normalizeInstrumentType={normalizeInstrumentType}
        parts={parts}
        reportDamageView={renderDamageView}
        services={services}
        workOrderImages={workOrderImages}
      />
    </>
  );
}
