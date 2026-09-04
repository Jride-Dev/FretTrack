import PrintDamageReport from '../print/PrintDamageReport.jsx';
import PrintJobSheet from '../print/PrintJobSheet.jsx';

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
  return (
    <>
      <PrintJobSheet
        draftJob={draftJob}
        documentType={draftJob.documentType}
        formatInstrumentLabel={formatInstrumentLabel}
        lengthUnit={lengthUnit}
        normalizeInstrumentType={normalizeInstrumentType}
        outerStringLabels={outerStringLabels}
        parts={parts}
        services={services}
        shopSettings={shopSettings}
        totals={totals}
      />
      <PrintDamageReport
        draftJob={draftJob}
        formatInstrumentLabel={formatInstrumentLabel}
        formatMeasurementDelta={formatMeasurementDelta}
        lengthUnit={lengthUnit}
        outerStringLabels={outerStringLabels}
        normalizeInstrumentType={normalizeInstrumentType}
        parts={parts}
        services={services}
        shopSettings={shopSettings}
        workOrderImages={workOrderImages}
      />
    </>
  );
}
