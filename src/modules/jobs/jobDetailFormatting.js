import { formatLength } from '../../shared/utils/measurements.js';
import { combineCustomerName } from '../customers/index.js';
import {
  getInstrumentStringCount,
  normalizeInstrumentType,
  normalizeStringCount,
  resizeStringGauges,
  shouldResetBrandForInstrumentType,
  shouldResetModelForBrand,
  stringCountForInstrument
} from '../instruments/instrumentService.js';
import { generateJobNumber } from './jobNumber.js';

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
      ),
      ...(currentJob.techDetails?.customerUnlinked && String(value || '').trim()
        ? {
            techDetails: {
              ...currentJob.techDetails,
              customerUnlinked: false
            }
          }
        : {})
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

export function buildUnlinkCustomerPatch(currentJob) {
  return {
    customerId: null,
    customerFirstName: '',
    customerLastName: '',
    customerName: '',
    phone: '',
    email: '',
    emailOptIn: false,
    smsOptIn: false,
    preferredContactMethod: 'none',
    addressLine1: '',
    city: '',
    region: '',
    postalCode: '',
    techDetails: {
      ...currentJob.techDetails,
      customerUnlinked: true,
      contact: {
        ...(currentJob.techDetails?.contact || {}),
        phone: '',
        email: '',
        emailOptIn: false,
        smsOptIn: false,
        preferredContactMethod: 'none',
        addressLine1: '',
        city: '',
        region: '',
        postalCode: ''
      }
    }
  };
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
        ...(fieldName === 'salesTaxRate' ? { rateSource: 'job', calculationMode: 'manual' } : {})
      }
    }
  };
}

export function buildShopTaxRatePatch(currentJob, shopSettings = {}) {
  const calculationMode = shopSettings.taxCalculationMode === 'manual' ? 'manual' : 'disabled';
  return {
    techDetails: {
      ...currentJob.techDetails,
      tax: {
        ...(currentJob.techDetails.tax || {}),
        calculationMode,
        profileId: shopSettings.defaultTaxProfileId || '',
        profileRevision: Number(shopSettings.taxProfileRevision || 0),
        state: shopSettings.taxState || '',
        salesTaxRate: calculationMode === 'manual'
          ? shopSettings.defaultTaxRate ?? shopSettings.salesTaxRate ?? ''
          : '0',
        taxLabel: shopSettings.taxLabel || 'Sales Tax',
        taxRegistrationNumber: shopSettings.taxRegistrationNumber || '',
        currencyCode: shopSettings.currencyCode || 'USD',
        taxableParts: calculationMode === 'manual' && shopSettings.taxablePartsDefault !== false,
        taxableServices: calculationMode === 'manual' && Boolean(shopSettings.taxableServicesDefault),
        rateSource: 'shop',
      }
    }
  };
}

export function buildDiscountFieldPatch(currentJob, fieldName, value) {
  return {
    [fieldName]: value,
    techDetails: {
      ...currentJob.techDetails,
      [fieldName]: value
    }
  };
}

export function buildTechFieldPatch(currentJob, fieldName, value) {
  return {
    ...currentJob,
    techDetails: {
      ...currentJob.techDetails,
      [fieldName]: value
    }
  };
}

export function buildWorkOrderImageIdsPatch(currentJob, workOrderImageIds, imageId, checked) {
  const nextImageIds = checked
    ? [...new Set([...workOrderImageIds, imageId])]
    : workOrderImageIds.filter((id) => id !== imageId);

  return {
    techDetails: {
      ...currentJob.techDetails,
      workOrderImageIds: nextImageIds
    }
  };
}

export function buildContactPreferencePatch(fieldName, value) {
  return { [fieldName]: value };
}

export function buildMessageTemplatePatch(currentJob, templateKey) {
  return {
    techDetails: {
      ...currentJob.techDetails,
      lastMessageTemplate: templateKey
    }
  };
}

export function buildDamageMapJob(currentJob, damageMap) {
  return {
    ...currentJob,
    techDetails: {
      ...currentJob.techDetails,
      damageMap
    }
  };
}

export function buildMergeJobMessageJob(currentJob, message) {
  if (!message) {
    return currentJob;
  }
  return {
    ...currentJob,
    messages: [
      message,
      ...(currentJob.messages || []).filter((item) => item.id !== message.id)
    ]
  };
}

export function buildAssignmentJob(currentJob, assignment) {
  return {
    ...currentJob,
    assignedMemberId: assignment.assignedMemberId || '',
    assignedMemberDisplayName: assignment.assignedMemberDisplayName || '',
    assignmentUpdatedAt: assignment.assignmentUpdatedAt || null
  };
}

export function buildPickedUpJob(currentJob, timestamp) {
  return {
    ...currentJob,
    status: 'Picked Up',
    pickedUpAt: timestamp
  };
}

export function findNewDamageViewImage(uploadedImages = [], existingImageIds = new Set(), category = '', fileName = '') {
  return uploadedImages.find((image) => !existingImageIds.has(image.id) && image.category === category && image.originalFileName === fileName)
    || uploadedImages.find((image) => !existingImageIds.has(image.id) && image.category === category)
    || null;
}

export function buildAddPaymentJob(currentJob, payment, paymentId) {
  return {
    ...currentJob,
    techDetails: {
      ...currentJob.techDetails,
      payments: [
        ...(currentJob.techDetails.payments || []),
        {
          id: paymentId,
          ...payment
        }
      ]
    }
  };
}

export function buildUpdatePaymentJob(currentJob, paymentId, fieldName, value) {
  return {
    ...currentJob,
    techDetails: {
      ...currentJob.techDetails,
      payments: (currentJob.techDetails.payments || []).map((row) => (
        row.id === paymentId ? { ...row, [fieldName]: value } : row
      ))
    }
  };
}

export function buildRemovePaymentJob(currentJob, paymentId) {
  return {
    ...currentJob,
    techDetails: {
      ...currentJob.techDetails,
      payments: (currentJob.techDetails.payments || []).filter((row) => row.id !== paymentId)
    }
  };
}

export function buildNeckInspectionPatch(currentJob, stage, fieldOrPatch, value) {
  const fieldPatch = typeof fieldOrPatch === 'object'
    ? fieldOrPatch
    : { [fieldOrPatch]: value };

  return {
    ...currentJob,
    techDetails: {
      ...currentJob.techDetails,
      neckInspection: {
        ...(currentJob.techDetails.neckInspection || {}),
        [stage]: {
          ...(currentJob.techDetails.neckInspection?.[stage] || {}),
          ...fieldPatch
        }
      }
    }
  };
}

export function buildStringGaugePatch(currentJob, index, value) {
  const stringGauges = [...(currentJob.techDetails.stringGauges || [])];
  stringGauges[index] = value;
  return {
    ...currentJob,
    techDetails: {
      ...currentJob.techDetails,
      stringGauges
    }
  };
}

export function buildStringGaugesPatch(currentJob, gauges) {
  return {
    ...currentJob,
    techDetails: {
      ...currentJob.techDetails,
      stringGauges: resizeStringGauges(gauges, getInstrumentStringCount(currentJob))
    }
  };
}

export function buildAddManualPartPatch(currentJob, parts, part, partId) {
  return {
    parts: [
      ...parts,
      {
        id: partId,
        shopId: currentJob.shopId,
        jobId: currentJob.id,
        partId: '',
        sku: '',
        name: part.name,
        quantity: part.quantity || '1',
        cost: part.cost,
        retail: part.retail
      }
    ]
  };
}

export function buildUpdateManualPartPatch(currentJob, parts, partId, fieldName, value) {
  const nextParts = parts.map((row) => (row.id === partId ? { ...row, [fieldName]: value } : row));
  return {
    parts: nextParts,
    techDetails: {
      ...currentJob.techDetails,
      includedPartIds: nextParts.filter((row) => row.includedInService).map((row) => row.id)
    }
  };
}

export function buildRemoveManualPartPatch(currentJob, parts, partId) {
  const nextParts = parts.filter((row) => row.id !== partId);
  return {
    parts: nextParts,
    techDetails: {
      ...currentJob.techDetails,
      includedPartIds: nextParts.filter((row) => row.includedInService).map((row) => row.id)
    }
  };
}

export function buildAddServicePatch(currentJob, services, service, serviceId) {
  return {
    services: [
      ...services,
      {
        id: serviceId,
        jobId: currentJob.id,
        description: service.description,
        quantity: service.quantity || '1',
        cost: service.cost,
        retail: service.retail
      }
    ]
  };
}

export function buildUpdateServicePatch(services, serviceId, fieldName, value) {
  return {
    services: services.map((row) => (row.id === serviceId ? { ...row, [fieldName]: value } : row))
  };
}

export function buildRemoveServicePatch(services, serviceId) {
  return {
    services: services.filter((row) => row.id !== serviceId)
  };
}

export function buildAddInventoryPartJob(currentJob, jobPart) {
  return {
    ...currentJob,
    parts: [...(currentJob.parts || []), jobPart]
  };
}

export function buildUpdateInventoryPartQuantityJob(currentJob, parts, partId, updatedJobPart) {
  return {
    ...currentJob,
    parts: parts.map((row) => (row.id === partId ? { ...row, ...updatedJobPart } : row))
  };
}

export function buildRemoveInventoryPartJob(currentJob, parts, partId) {
  return {
    ...currentJob,
    parts: parts.filter((row) => row.id !== partId)
  };
}

export function buildAppendImagePreviewsJob(currentJob, previews) {
  return {
    ...currentJob,
    images: [...(currentJob.images || []), ...previews]
  };
}

export function buildRemoveImageJob(currentJob, imageId) {
  return {
    ...currentJob,
    images: (currentJob.images || []).filter((item) => item.id !== imageId)
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
