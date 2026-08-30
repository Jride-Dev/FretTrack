import { useMemo } from 'react';
import { calculateJobTotals } from '../billing/accounting.js';
import { resolveJobTaxSettings } from '../billing/jobTaxSettings.js';
import { getShopDateOptions, getShopMeasurementOptions, getShopMoneyOptions, getShopSettings } from '../shops/shopConfig.js';
import { getInstrumentStringCount, getOuterStringLabels } from '../instruments/instrumentService.js';

export default function useJobDetailDerivedState(draftJob, shopProfile) {
  const parts = draftJob.parts || [];
  const services = draftJob.services || draftJob.labor || [];
  const images = draftJob.images || [];
  const workOrderImageIds = draftJob.techDetails.workOrderImageIds || [];
  const workOrderImages = images.filter((image) => workOrderImageIds.includes(image.id));
  const shopSettings = shopProfile || getShopSettings();
  const taxSettings = useMemo(
    () => resolveJobTaxSettings(draftJob, shopSettings),
    [draftJob, shopSettings]
  );
  const payments = draftJob.techDetails.payments || [];
  const instrumentStringCount = getInstrumentStringCount(draftJob);
  const outerStringLabels = getOuterStringLabels(draftJob.instrumentType, instrumentStringCount);
  const measurementOptions = getShopMeasurementOptions(shopSettings);
  const totals = useMemo(
    () => calculateJobTotals(draftJob, taxSettings),
    [draftJob, taxSettings]
  );
  const dateOptions = getShopDateOptions({
    dateFormat: taxSettings.dateFormat || shopSettings.dateFormat,
    locale: taxSettings.locale || shopSettings.locale
  });
  const moneyOptions = getShopMoneyOptions({
    currencyCode: taxSettings.currencyCode || shopSettings.currencyCode,
    locale: taxSettings.locale || shopSettings.locale
  });

  return {
    dateOptions,
    images,
    instrumentStringCount,
    measurementOptions,
    moneyOptions,
    outerStringLabels,
    parts,
    payments,
    services,
    shopSettings,
    taxSettings,
    totals,
    workOrderImageIds,
    workOrderImages
  };
}
