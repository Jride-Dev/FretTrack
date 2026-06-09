import { getDefaultDateFormatForLocale, normalizeDateFormat } from '../../shared/utils/dateFormat';
import { getDefaultMeasurementPreferences, normalizeLengthUnit, normalizeMeasurementSystem } from '../../shared/utils/measurements';

const DEFAULT_SHOP_ID = 'default-shop';
const DEFAULT_SHOP_NAME = 'FretTrack Trial Shop';
const SHOP_SETTINGS_STORAGE_KEY = 'frettrack_shop_settings';
const SHOP_SELECTION_STORAGE_KEY = 'frettrack_selected_shop';
const DEFAULT_CURRENCY_CODE = 'USD';
const DEFAULT_LOCALE = 'en-US';
const DEFAULT_TAX_LABEL = 'Sales Tax';
const DEFAULT_MEASUREMENT_SYSTEM = 'imperial';
const DEFAULT_LENGTH_UNIT = 'in';

export const defaultShopSettings = {
  shopId: DEFAULT_SHOP_ID,
  shopName: DEFAULT_SHOP_NAME,
  phone: '',
  email: '',
  address: '',
  logoUrl: '',
  logoStoragePath: '',
  printFooterText: '',
  currencyCode: DEFAULT_CURRENCY_CODE,
  locale: DEFAULT_LOCALE,
  taxLabel: DEFAULT_TAX_LABEL,
  taxRegistrationNumber: '',
  dateFormat: getDefaultDateFormatForLocale(DEFAULT_LOCALE),
  measurementSystem: DEFAULT_MEASUREMENT_SYSTEM,
  lengthUnit: DEFAULT_LENGTH_UNIT,
  taxState: '',
  salesTaxRate: '',
  taxablePartsDefault: true,
  taxableServicesDefault: false,
  subscriptionTier: 'free',
  subscriptionStatus: 'active',
  trialEndsAt: '',
  featureOverrides: {}
};

export function getShopSettings() {
  let savedSettings = {};
  try {
    savedSettings = JSON.parse(localStorage.getItem(SHOP_SETTINGS_STORAGE_KEY)) || {};
  } catch {
    savedSettings = {};
  }

  const selectedShop = getSelectedShop();
  const shopId = selectedShop.shopId || import.meta.env.VITE_FRETTRACK_SHOP_ID || savedSettings.shopId || DEFAULT_SHOP_ID;
  const savedSettingsMatchShop = savedSettings.shopId === shopId;

  return {
    ...defaultShopSettings,
    shopId,
    shopName: savedSettingsMatchShop && savedSettings.shopName
      ? savedSettings.shopName
      : selectedShop.shopName || import.meta.env.VITE_FRETTRACK_SHOP_NAME || DEFAULT_SHOP_NAME,
    phone: savedSettingsMatchShop ? savedSettings.phone || '' : '',
    email: savedSettingsMatchShop ? savedSettings.email || '' : '',
    address: savedSettingsMatchShop ? savedSettings.address || '' : '',
    logoUrl: savedSettingsMatchShop ? savedSettings.logoUrl || '' : '',
    logoStoragePath: savedSettingsMatchShop ? savedSettings.logoStoragePath || '' : '',
    printFooterText: savedSettingsMatchShop ? savedSettings.printFooterText || '' : '',
    currencyCode: savedSettingsMatchShop ? normalizeCurrencyCode(savedSettings.currencyCode) : DEFAULT_CURRENCY_CODE,
    locale: savedSettingsMatchShop ? savedSettings.locale || DEFAULT_LOCALE : DEFAULT_LOCALE,
    taxLabel: savedSettingsMatchShop ? savedSettings.taxLabel || DEFAULT_TAX_LABEL : DEFAULT_TAX_LABEL,
    taxRegistrationNumber: savedSettingsMatchShop ? savedSettings.taxRegistrationNumber || '' : '',
    dateFormat: savedSettingsMatchShop
      ? normalizeDateFormat(savedSettings.dateFormat, savedSettings.locale || DEFAULT_LOCALE)
      : getDefaultDateFormatForLocale(DEFAULT_LOCALE),
    measurementSystem: savedSettingsMatchShop
      ? normalizeMeasurementSystem(savedSettings.measurementSystem, getDefaultMeasurementPreferences(savedSettings).measurementSystem)
      : DEFAULT_MEASUREMENT_SYSTEM,
    lengthUnit: savedSettingsMatchShop
      ? normalizeLengthUnit(savedSettings.lengthUnit, getDefaultMeasurementPreferences(savedSettings).lengthUnit)
      : DEFAULT_LENGTH_UNIT,
    taxState: savedSettingsMatchShop ? savedSettings.taxState || '' : '',
    salesTaxRate: savedSettingsMatchShop ? savedSettings.salesTaxRate || '' : '',
    taxablePartsDefault: savedSettingsMatchShop ? savedSettings.taxablePartsDefault !== false : true,
    taxableServicesDefault: savedSettingsMatchShop ? Boolean(savedSettings.taxableServicesDefault) : false,
    subscriptionTier: savedSettingsMatchShop ? savedSettings.subscriptionTier || 'free' : 'free',
    subscriptionStatus: savedSettingsMatchShop ? savedSettings.subscriptionStatus || 'active' : 'active',
    trialEndsAt: savedSettingsMatchShop ? savedSettings.trialEndsAt || '' : '',
    featureOverrides: savedSettingsMatchShop ? savedSettings.featureOverrides || {} : {}
  };
}

export function saveShopSettings(settings) {
  const nextSettings = {
    ...getShopSettings(),
    ...settings
  };

  localStorage.setItem(SHOP_SETTINGS_STORAGE_KEY, JSON.stringify(nextSettings));
  return nextSettings;
}

export function getCurrentShopId() {
  return getShopSettings().shopId;
}

export function getCurrentShopName() {
  return getShopSettings().shopName;
}

export function getPrintFooterText() {
  return getShopSettings().printFooterText;
}

export function getShopMoneyOptions(settings = getShopSettings()) {
  const mergedSettings = {
    ...getShopSettings(),
    ...(settings || {})
  };
  return {
    currency: normalizeCurrencyCode(mergedSettings.currencyCode),
    locale: mergedSettings.locale || DEFAULT_LOCALE
  };
}

export function getShopTaxLabel(settings = getShopSettings()) {
  return settings.taxLabel || getShopSettings().taxLabel || DEFAULT_TAX_LABEL;
}

export function getShopDateOptions(settings = getShopSettings()) {
  const mergedSettings = {
    ...getShopSettings(),
    ...(settings || {})
  };
  return {
    dateFormat: normalizeDateFormat(mergedSettings.dateFormat, mergedSettings.locale || DEFAULT_LOCALE),
    locale: mergedSettings.locale || DEFAULT_LOCALE
  };
}

export function getShopMeasurementOptions(settings = getShopSettings()) {
  const mergedSettings = {
    ...getShopSettings(),
    ...(settings || {})
  };
  const defaults = getDefaultMeasurementPreferences(mergedSettings);
  return {
    measurementSystem: normalizeMeasurementSystem(mergedSettings.measurementSystem, defaults.measurementSystem),
    lengthUnit: normalizeLengthUnit(mergedSettings.lengthUnit, defaults.lengthUnit)
  };
}

export function getSelectedShop() {
  try {
    return JSON.parse(localStorage.getItem(SHOP_SELECTION_STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

export function setSelectedShop(shop) {
  const selectedShop = {
    shopId: shop?.shopId || shop?.shop_id || '',
    shopName: shop?.shopName || shop?.shop_name || ''
  };

  if (!selectedShop.shopId) {
    localStorage.removeItem(SHOP_SELECTION_STORAGE_KEY);
    return selectedShop;
  }

  localStorage.setItem(SHOP_SELECTION_STORAGE_KEY, JSON.stringify(selectedShop));
  return selectedShop;
}

export function clearSelectedShop() {
  localStorage.removeItem(SHOP_SELECTION_STORAGE_KEY);
}

function normalizeCurrencyCode(currencyCode) {
  const code = String(currencyCode || DEFAULT_CURRENCY_CODE).toUpperCase();
  return code === 'GBP' ? 'GBP' : 'USD';
}

export { DEFAULT_SHOP_ID, DEFAULT_SHOP_NAME, SHOP_SETTINGS_STORAGE_KEY, SHOP_SELECTION_STORAGE_KEY };
