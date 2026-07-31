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
  const shopTaxRate = getShopDefaultTaxRate(shopSettings);
  const rateSource = storedTaxSettings.rateSource === 'job' ? 'job' : 'shop';

  return {
    ...storedTaxSettings,
    rateSource,
    salesTaxRate: rateSource === 'shop' && hasValue(shopTaxRate)
      ? shopTaxRate
      : storedTaxSettings.salesTaxRate ?? '',
    currencyCode: shopSettings.currencyCode || shopSettings.currency_code || storedTaxSettings.currencyCode,
    locale: shopSettings.locale || storedTaxSettings.locale,
    dateFormat: shopSettings.dateFormat || shopSettings.date_format || storedTaxSettings.dateFormat,
    taxLabel: shopSettings.taxLabel || shopSettings.tax_label || storedTaxSettings.taxLabel
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
