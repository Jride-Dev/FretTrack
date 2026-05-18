import { prepareImageForStorage, readFileAsDataUrl } from '../../services/imageProcessing';
import { hasSupabaseConfig, supabase } from '../../shared/lib/supabaseClient';
import { getDefaultDateFormatForLocale, normalizeDateFormat } from '../../shared/utils/dateFormat';
import { getDefaultMeasurementPreferences, normalizeLengthUnit, normalizeMeasurementSystem } from '../../shared/utils/measurements';
import { getDefaultLocaleForCurrency, getSupportedCurrency } from '../../shared/utils/money';
import { getCurrentShopId, getShopSettings, saveShopSettings } from './shopConfig';

const SHOP_ASSETS_BUCKET = 'shop-assets';

export async function getCurrentShopProfile(shopId = getCurrentShopId()) {
  if (!hasSupabaseConfig || !supabase) {
    return getShopSettings();
  }

  const { data, error } = await supabase
    .from('shop_profiles')
    .select('*')
    .eq('shop_id', shopId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  const profile = await fromDbProfile(data);
  saveShopSettings(profile);
  return profile;
}

export async function saveShopProfile(settings) {
  const normalizedSettings = normalizeShopSettings(settings);

  if (!hasSupabaseConfig || !supabase) {
    return saveShopSettings(normalizedSettings);
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) {
    throw userError;
  }

  const { data, error } = await supabase
    .from('shop_profiles')
    .upsert(toDbProfile(normalizedSettings, userData.user?.id), { onConflict: 'shop_id' })
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  const profile = await fromDbProfile(data);
  saveShopSettings(profile);
  return profile;
}

export async function uploadShopLogo(file, shopId = getCurrentShopId()) {
  if (!file) {
    return null;
  }

  const preparedFile = await prepareImageForStorage(file, file.name || 'shop-logo');

  if (!hasSupabaseConfig || !supabase) {
    return {
      logoStoragePath: '',
      logoUrl: await readFileAsDataUrl(preparedFile)
    };
  }

  const filePath = `${shopId}/logo-${compactTimestamp(new Date())}.jpg`;
  const { error } = await supabase.storage
    .from(SHOP_ASSETS_BUCKET)
    .upload(filePath, preparedFile, {
      contentType: preparedFile.type,
      cacheControl: '31536000',
      upsert: true
    });

  if (error) {
    throw error;
  }

  return {
    logoStoragePath: filePath,
    logoUrl: await createShopLogoObjectUrl(filePath)
  };
}

export async function createShopLogoObjectUrl(storagePath) {
  if (!storagePath || !hasSupabaseConfig || !supabase) {
    return '';
  }

  const { data, error } = await supabase.storage
    .from(SHOP_ASSETS_BUCKET)
    .download(storagePath);

  if (error) {
    throw error;
  }

  return URL.createObjectURL(data);
}

function normalizeShopSettings(settings = {}) {
  const currentSettings = getShopSettings();
  const inferredCurrency = inferCurrencySettings(settings, currentSettings);
  const inferredMeasurements = getDefaultMeasurementPreferences({
    ...currentSettings,
    ...settings,
    currencyCode: inferredCurrency.currencyCode,
    locale: settings.locale || inferredCurrency.locale
  });
  return {
    ...currentSettings,
    ...settings,
    shopId: settings.shopId || currentSettings.shopId,
    shopName: String(settings.shopName || '').trim(),
    phone: String(settings.phone || '').trim(),
    email: String(settings.email || '').trim(),
    address: String(settings.address || '').trim(),
    logoStoragePath: settings.logoStoragePath || '',
    logoUrl: settings.logoUrl || '',
    printFooterText: String(settings.printFooterText || '').trim(),
    currencyCode: inferredCurrency.currencyCode,
    locale: String(settings.locale || inferredCurrency.locale || getDefaultLocaleForCurrency(inferredCurrency.currencyCode)).trim(),
    taxLabel: String(settings.taxLabel || inferredCurrency.taxLabel || getSupportedCurrency(inferredCurrency.currencyCode).taxLabel).trim(),
    taxRegistrationNumber: String(settings.taxRegistrationNumber || '').trim(),
    dateFormat: normalizeDateFormat(settings.dateFormat, settings.locale || inferredCurrency.locale),
    measurementSystem: normalizeMeasurementSystem(settings.measurementSystem, inferredMeasurements.measurementSystem),
    lengthUnit: normalizeLengthUnit(settings.lengthUnit, inferredMeasurements.lengthUnit),
    taxState: String(settings.taxState || '').trim().toUpperCase(),
    salesTaxRate: settings.salesTaxRate === '' || settings.salesTaxRate == null
      ? ''
      : String(Number(settings.salesTaxRate)),
    taxablePartsDefault: settings.taxablePartsDefault !== false,
    taxableServicesDefault: Boolean(settings.taxableServicesDefault)
  };
}

async function fromDbProfile(dbProfile) {
  const profile = dbProfile || {};
  const profileMeasurementDefaults = getDefaultMeasurementPreferences({
    currencyCode: profile.currency_code || 'USD',
    locale: profile.locale || 'en-US'
  });
  const logoStoragePath = profile.logo_storage_path || '';
  let logoUrl = '';
  if (logoStoragePath) {
    try {
      logoUrl = await createShopLogoObjectUrl(logoStoragePath);
    } catch (error) {
      console.error('Shop logo download failed.', error);
    }
  }

  return {
    shopId: profile.shop_id,
    shopName: profile.shop_name || '',
    phone: profile.phone || '',
    email: profile.email || '',
    address: profile.address || '',
    logoStoragePath,
    logoUrl,
    printFooterText: profile.print_footer_text || '',
    currencyCode: profile.currency_code || 'USD',
    locale: profile.locale || 'en-US',
    taxLabel: profile.tax_label || 'Sales Tax',
    taxRegistrationNumber: profile.tax_registration_number || '',
    dateFormat: normalizeDateFormat(profile.date_format, profile.locale || 'en-US'),
    measurementSystem: normalizeMeasurementSystem(profile.measurement_system, profileMeasurementDefaults.measurementSystem),
    lengthUnit: normalizeLengthUnit(profile.length_unit, profileMeasurementDefaults.lengthUnit),
    taxState: profile.tax_state || '',
    salesTaxRate: profile.sales_tax_rate == null ? '' : String(Number(profile.sales_tax_rate)),
    taxablePartsDefault: profile.taxable_parts_default !== false,
    taxableServicesDefault: Boolean(profile.taxable_services_default),
    onboardedAt: profile.onboarded_at || '',
    createdAt: profile.created_at,
    updatedAt: profile.updated_at
  };
}

function toDbProfile(settings, userId) {
  return {
    shop_id: settings.shopId,
    shop_name: settings.shopName,
    phone: settings.phone,
    email: settings.email,
    address: settings.address,
    logo_storage_path: settings.logoStoragePath || '',
    print_footer_text: settings.printFooterText,
    currency_code: settings.currencyCode || 'USD',
    locale: settings.locale || 'en-US',
    tax_label: settings.taxLabel || 'Sales Tax',
    tax_registration_number: settings.taxRegistrationNumber || '',
    date_format: settings.dateFormat || getDefaultDateFormatForLocale(settings.locale || 'en-US'),
    measurement_system: settings.measurementSystem || getDefaultMeasurementPreferences(settings).measurementSystem,
    length_unit: settings.lengthUnit || getDefaultMeasurementPreferences(settings).lengthUnit,
    tax_state: settings.taxState,
    sales_tax_rate: Number(settings.salesTaxRate) || 0,
    taxable_parts_default: settings.taxablePartsDefault !== false,
    taxable_services_default: Boolean(settings.taxableServicesDefault),
    onboarded_at: new Date().toISOString(),
    created_by: userId || null
  };
}

function inferCurrencySettings(settings = {}, currentSettings = {}) {
  const explicitCurrency = settings.currencyCode || settings.currency_code;
  if (explicitCurrency) {
    const currency = getSupportedCurrency(explicitCurrency);
    return {
      currencyCode: currency.code,
      locale: settings.locale || currentSettings.locale || currency.locale,
      taxLabel: settings.taxLabel || currentSettings.taxLabel || currency.taxLabel
    };
  }

  const text = [
    settings.shopName,
    settings.shop_name,
    settings.address,
    settings.taxState,
    currentSettings.shopName,
    currentSettings.address
  ].join(' ').toLowerCase();
  const looksUnitedKingdom = /\b(norwich|united kingdom|uk|england|gb|great britain)\b/.test(text);
  const currency = getSupportedCurrency(looksUnitedKingdom ? 'GBP' : currentSettings.currencyCode || 'USD');
  return {
    currencyCode: currency.code,
    locale: settings.locale || currentSettings.locale || currency.locale,
    taxLabel: settings.taxLabel || currentSettings.taxLabel || currency.taxLabel
  };
}

function compactTimestamp(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  const second = String(date.getSeconds()).padStart(2, '0');
  const millisecond = String(date.getMilliseconds()).padStart(3, '0');
  return `${year}${month}${day}${hour}${minute}${second}${millisecond}`;
}
