import { formatLength } from '../../shared/utils/measurements.js';
import { combineCustomerName } from '../customers/index.js';
import {
  normalizeInstrumentType,
  normalizeStringCount,
  resizeStringGauges,
  shouldResetBrandForInstrumentType,
  shouldResetModelForBrand,
  stringCountForInstrument
} from '../instruments/instrumentService.js';
import { generateJobNumber } from './jobNumber.js';

export function markerColorForReport(severity) {
  if (severity === 'Critical') return '#b3261e';
  if (severity === 'Structural') return '#a15c00';
  return '#255f85';
}

export function getInstrumentSelectionPatch(currentJob, instrumentType) {
  const normalizedInstrumentType = normalizeInstrumentType(instrumentType);
  const shouldResetBrand = shouldResetBrandForInstrumentType(normalizedInstrumentType, currentJob.guitarBrand);
  const guitarBrand = shouldResetBrand ? '' : currentJob.guitarBrand;
  const model = shouldResetBrand || shouldResetModelForBrand(normalizedInstrumentType, guitarBrand, currentJob.model)
    ? ''
    : currentJob.model;

  return {
    instrumentType: normalizedInstrumentType,
    guitarBrand,
    model
  };
}

export function buildJobFieldPatch(currentJob, fieldName, value, jobs = []) {
  if (fieldName === 'customerFirstName' || fieldName === 'customerLastName') {
    return {
      [fieldName]: value,
      customerName: combineCustomerName(
        fieldName === 'customerFirstName' ? value : currentJob.customerFirstName,
        fieldName === 'customerLastName' ? value : currentJob.customerLastName
      )
    };
  }
  if (fieldName === 'dateReceived') {
    return {
      dateReceived: value,
      jobNumber: generateJobNumber(value, jobs, currentJob.id, currentJob.shopId)
    };
  }
  if (fieldName === 'guitarBrand') {
    return {
      guitarBrand: value,
      model: shouldResetModelForBrand(currentJob.instrumentType, value, currentJob.model) ? '' : currentJob.model
    };
  }
  if (fieldName === 'instrumentType') {
    return buildInstrumentTypePatch(currentJob, value);
  }
  return { [fieldName]: value };
}

export function buildInstrumentTypePatch(currentJob, instrumentType) {
  const instrumentPatch = getInstrumentSelectionPatch(currentJob, instrumentType);
  const stringCount = stringCountForInstrument(instrumentPatch.instrumentType);
  return {
    ...instrumentPatch,
    techDetails: {
      ...currentJob.techDetails,
      instrumentType: instrumentPatch.instrumentType,
      stringCount,
      stringGauges: resizeStringGauges(currentJob.techDetails.stringGauges, stringCount)
    }
  };
}

export function buildStringCountPatch(currentJob, value) {
  const stringCount = value === 'custom'
    ? normalizeStringCount(currentJob.techDetails.stringCount || currentJob.techDetails.stringGauges?.length, currentJob.instrumentType)
    : normalizeStringCount(value, currentJob.instrumentType);
  return {
    stringCount,
    techDetails: {
      ...currentJob.techDetails,
      stringCount,
      stringGauges: resizeStringGauges(currentJob.techDetails.stringGauges, stringCount)
    }
  };
}

export function buildTaxFieldPatch(currentJob, fieldName, fieldValue, inputType = 'text', checked = false) {
  return {
    techDetails: {
      ...currentJob.techDetails,
      tax: {
        ...(currentJob.techDetails.tax || {}),
        [fieldName]: inputType === 'checkbox' ? checked : fieldValue,
        ...(fieldName === 'salesTaxRate' ? { rateSource: 'job' } : {})
      }
    }
  };
}

export function buildShopTaxRatePatch(currentJob, salesTaxRate) {
  return {
    techDetails: {
      ...currentJob.techDetails,
      tax: {
        ...(currentJob.techDetails.tax || {}),
        salesTaxRate,
        rateSource: 'shop'
      }
    }
  };
}

export function buildMeasurementDisplay(job, lengthUnit) {
  const neckInspection = job.techDetails?.neckInspection || {};
  return {
    lengthUnit,
    initial: formatMeasurementStageForExport(neckInspection.initial, lengthUnit),
    final: formatMeasurementStageForExport(neckInspection.final, lengthUnit)
  };
}

export function formatMeasurementStageForExport(stage = {}, fallbackUnit = 'in') {
  return {
    relief: formatLength(stage.relief, fallbackUnit),
    nutHighE: formatLength(stage.nutHighE, fallbackUnit),
    nutLowE: formatLength(stage.nutLowE, fallbackUnit),
    actionHighE12th: formatLength(stage.actionHighE12th, fallbackUnit),
    actionLowE12th: formatLength(stage.actionLowE12th, fallbackUnit)
  };
}
