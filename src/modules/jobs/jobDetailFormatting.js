import { formatLength } from '../../shared/utils/measurements.js';
import {
  normalizeInstrumentType,
  shouldResetBrandForInstrumentType,
  shouldResetModelForBrand
} from '../instruments/instrumentService.js';

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
