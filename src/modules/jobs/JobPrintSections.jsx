import PrintActions from './PrintActions';
import JobPrintDocuments from './JobPrintDocuments.jsx';

export default function buildJobPrintSections({
  canSendEmail,
  canWrite,
  draftJob,
  formatInstrumentLabel,
  formatMeasurementDelta,
  lengthUnit,
  normalizeInstrumentType,
  onCloseDetail,
  onEmailWorkOrder,
  onExportJobJson,
  onFinishJob,
  onPrintCustomerReport,
  onPrintJobSheet,
  outerStringLabels,
  parts,
  services,
  shopSettings,
  totals,
  workOrderImages
}) {
  return {
    printActions: (
      <PrintActions
        canSendEmail={canSendEmail}
        canWrite={canWrite}
        documentType={draftJob.documentType}
        closeDetail={onCloseDetail}
        emailWorkOrder={onEmailWorkOrder}
        exportJobJson={onExportJobJson}
        finishJob={onFinishJob}
        printCustomerReport={onPrintCustomerReport}
        printJobSheet={onPrintJobSheet}
      />
    ),
    printSections: (
      <JobPrintDocuments
        draftJob={draftJob}
        formatInstrumentLabel={formatInstrumentLabel}
        formatMeasurementDelta={formatMeasurementDelta}
        lengthUnit={lengthUnit}
        normalizeInstrumentType={normalizeInstrumentType}
        outerStringLabels={outerStringLabels}
        parts={parts}
        services={services}
        shopSettings={shopSettings}
        totals={totals}
        workOrderImages={workOrderImages}
      />
    )
  };
}
