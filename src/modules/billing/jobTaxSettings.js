function hasValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== '';
}

export function getShopDefaultTaxRate(shopSettings = {}) {
  const value = shopSettings.defaultTaxRate
    ?? shopSettings.default_tax_rate
    ?? shopSettings.salesTaxRate
    ?? shopSettings.sales_tax_rate;
  return hasValue(value) ? String(value) : '';
}

export function resolveJobTaxSettings(job = {}, shopSettings = {}) {
  const storedTaxSettings = job.techDetails?.tax || job.tech_details?.tax || {};
  const hasStoredTaxableParts = Object.prototype.hasOwnProperty.call(storedTaxSettings, 'taxableParts');
  const hasStoredTaxableServices = Object.prototype.hasOwnProperty.call(storedTaxSettings, 'taxableServices');
  const shopTaxRate = getShopDefaultTaxRate(shopSettings);
  const rateSource = storedTaxSettings.rateSource === 'job' ? 'job' : 'shop';
  const calculationMode = storedTaxSettings.calculationMode
    || (rateSource === 'shop' ? shopSettings.taxCalculationMode : '')
    || (Number(storedTaxSettings.salesTaxRate) > 0 ? 'manual' : 'disabled');
  const storedTaxRate = hasValue(storedTaxSettings.salesTaxRate) ? String(storedTaxSettings.salesTaxRate) : '';

  return {
    ...storedTaxSettings,
    calculationMode,
    profileId: storedTaxSettings.profileId || shopSettings.defaultTaxProfileId || '',
    profileRevision: Number(storedTaxSettings.profileRevision || shopSettings.taxProfileRevision || 0),
    rateSource,
    state: storedTaxSettings.state || shopSettings.taxState || '',
    salesTaxRate: calculationMode === 'disabled'
      ? '0'
      : storedTaxRate || shopTaxRate,
    taxRegistrationNumber: storedTaxSettings.taxRegistrationNumber || shopSettings.taxRegistrationNumber || '',
    taxableParts: calculationMode === 'disabled'
      ? false
      : hasStoredTaxableParts ? storedTaxSettings.taxableParts !== false : shopSettings.taxablePartsDefault !== false,
    taxableServices: calculationMode === 'disabled'
      ? false
      : hasStoredTaxableServices ? Boolean(storedTaxSettings.taxableServices) : Boolean(shopSettings.taxableServicesDefault),
    currencyCode: storedTaxSettings.currencyCode || shopSettings.currencyCode || shopSettings.currency_code,
    locale: storedTaxSettings.locale || shopSettings.locale,
    dateFormat: storedTaxSettings.dateFormat || shopSettings.dateFormat || shopSettings.date_format,
    taxLabel: storedTaxSettings.taxLabel || shopSettings.taxLabel || shopSettings.tax_label,
    measurementSystem: storedTaxSettings.measurementSystem || shopSettings.measurementSystem,
    lengthUnit: storedTaxSettings.lengthUnit || shopSettings.lengthUnit
  };
}

export function withResolvedJobTaxSettings(job = {}, shopSettings = {}) {
  return {
    ...job,
    techDetails: {
      ...(job.techDetails || {}),
      tax: resolveJobTaxSettings(job, shopSettings)
    }
  };
}
