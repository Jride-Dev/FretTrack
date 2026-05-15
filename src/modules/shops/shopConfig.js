const DEFAULT_SHOP_ID = 'default-shop';
const DEFAULT_SHOP_NAME = 'FretTrack Trial Shop';
const SHOP_SETTINGS_STORAGE_KEY = 'frettrack_shop_settings';
const SHOP_SELECTION_STORAGE_KEY = 'frettrack_selected_shop';

export const defaultShopSettings = {
  shopId: DEFAULT_SHOP_ID,
  shopName: DEFAULT_SHOP_NAME,
  phone: '',
  email: '',
  address: '',
  logoUrl: '',
  logoStoragePath: '',
  printFooterText: '',
  taxState: '',
  salesTaxRate: '',
  taxablePartsDefault: true,
  taxableServicesDefault: false
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
    taxState: savedSettingsMatchShop ? savedSettings.taxState || '' : '',
    salesTaxRate: savedSettingsMatchShop ? savedSettings.salesTaxRate || '' : '',
    taxablePartsDefault: savedSettingsMatchShop ? savedSettings.taxablePartsDefault !== false : true,
    taxableServicesDefault: savedSettingsMatchShop ? Boolean(savedSettings.taxableServicesDefault) : false
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

export { DEFAULT_SHOP_ID, DEFAULT_SHOP_NAME, SHOP_SETTINGS_STORAGE_KEY, SHOP_SELECTION_STORAGE_KEY };
