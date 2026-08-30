import { getCountryLocalizationDefaults } from '../modules/shops/shopLocalization.js';
import { getCurrentShopName } from '../modules/shops/shopConfig';
import { hasSupabaseConfig } from '../shared/lib/supabaseClient';

export function getCurrentShopProfileFallback() {
  const shopName = getCurrentShopName();
  return {
    ...getCountryLocalizationDefaults('US'),
    shopId: '',
    shopName,
    phone: '',
    email: '',
    address: '',
    logoUrl: '',
    logoStoragePath: '',
    printFooterText: '',
    taxRegistrationNumber: '',
    dateFormat: 'MM/DD/YYYY',
    taxState: '',
    salesTaxRate: '',
    defaultTaxRate: '',
    taxablePartsDefault: true,
    taxableServicesDefault: false
  };
}

export function resolveMembership(availableMemberships = [], preferredShopId = '') {
  const effectiveMemberships = availableMemberships.filter((item) => item.effectiveMemberAccess !== false);
  if (!effectiveMemberships.length) {
    return null;
  }

  if (preferredShopId) {
    const preferredMembership = effectiveMemberships.find((item) => item.shopId === preferredShopId);
    if (preferredMembership) {
      return preferredMembership;
    }
  }

  if (effectiveMemberships.length === 1) {
    return effectiveMemberships[0];
  }

  return null;
}

export function slugifyShopId(shopName) {
  return String(shopName || '')
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64);
}

export function getErrorMessage(error, fallback) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message || fallback);
  }

  return fallback;
}

export function shouldQueueOfflineDraft(error) {
  if (!hasSupabaseConfig) {
    return false;
  }

  if (!window.navigator.onLine) {
    return true;
  }

  const message = String(error?.message || error || '').toLowerCase();
  return (
    message.includes('failed to fetch')
    || message.includes('network')
    || message.includes('fetch')
    || message.includes('offline')
    || message.includes('connection')
    || message.includes('local copy was saved only')
  );
}
