const DEFAULT_SHOP_ID = 'default-shop';
const DEFAULT_SHOP_NAME = 'FretTrack Trial Shop';
const SHOP_SETTINGS_STORAGE_KEY = 'frettrack_shop_settings';

export const defaultShopSettings = {
  shopId: DEFAULT_SHOP_ID,
  shopName: DEFAULT_SHOP_NAME,
  phone: '',
  email: '',
  address: '',
  logoUrl: '',
  printFooterText: ''
};

export function getShopSettings() {
  let savedSettings = {};
  try {
    savedSettings = JSON.parse(localStorage.getItem(SHOP_SETTINGS_STORAGE_KEY)) || {};
  } catch {
    savedSettings = {};
  }

  return {
    ...defaultShopSettings,
    shopId: import.meta.env.VITE_FRETTRACK_SHOP_ID || savedSettings.shopId || DEFAULT_SHOP_ID,
    shopName: savedSettings.shopName || import.meta.env.VITE_FRETTRACK_SHOP_NAME || DEFAULT_SHOP_NAME,
    phone: savedSettings.phone || '',
    email: savedSettings.email || '',
    address: savedSettings.address || '',
    logoUrl: savedSettings.logoUrl || '',
    printFooterText: savedSettings.printFooterText || ''
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

export { DEFAULT_SHOP_ID, DEFAULT_SHOP_NAME, SHOP_SETTINGS_STORAGE_KEY };
