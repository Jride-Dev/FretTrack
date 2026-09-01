import { optimizeImageForStorage, readFileAsDataUrl } from '../../services/imageProcessing';
import { hasSupabaseConfig, supabase } from '../../shared/lib/supabaseClient';
import { getDefaultDateFormatForLocale, normalizeDateFormat } from '../../shared/utils/dateFormat';
import { getDefaultMeasurementPreferences, normalizeLengthUnit, normalizeMeasurementSystem } from '../../shared/utils/measurements';
import {
  normalizeShopLocalizationSettings,
  resolveShopLocalization
} from './shopLocalization.js';
import {
  getCurrentShopId,
  getShopSettings,
  normalizePresetArray,
  normalizeShippingLabelSettings,
  saveShopSettings
} from './shopConfig';

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

  const optimizedLogo = await optimizeImageForStorage(file, {
    preset: 'shopLogo',
    originalFileName: file.name || 'shop-logo'
  });
  const preparedFile = optimizedLogo.file;

  if (!hasSupabaseConfig || !supabase) {
    return {
      logoStoragePath: '',
      logoUrl: await readFileAsDataUrl(preparedFile),
      logoOptimizationNotice: optimizedLogo.notice
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
    logoUrl: await createShopLogoObjectUrl(filePath),
    logoOptimizationNotice: optimizedLogo.notice
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

export function normalizeShopSettings(settings = {}) {
  const localSettings = getShopSettings();
  const currentSettings = !settings.shopId || settings.shopId === localSettings.shopId ? localSettings : {};
  const mergedSettings = { ...currentSettings, ...settings };
  const normalizedLocalization = normalizeShopLocalizationSettings(mergedSettings);
  const localization = resolveShopLocalization(normalizedLocalization);
  const defaultTaxRate = normalizedLocalization.defaultTaxRate;
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
    countryCode: localization.countryCode,
    currencyCode: localization.currencyCode,
    locale: localization.locale,
    taxLabel: localization.taxLabel,
    taxRegistrationNumber: String(settings.taxRegistrationNumber || '').trim(),
    taxCalculationMode: settings.taxCalculationMode === 'manual' ? 'manual' : 'disabled',
    defaultTaxProfileId: settings.defaultTaxProfileId || currentSettings.defaultTaxProfileId || '',
    taxProfileRevision: Number(settings.taxProfileRevision || currentSettings.taxProfileRevision || 1),
    dateFormat: normalizeDateFormat(settings.dateFormat, localization.locale),
    measurementSystem: localization.measurementSystem,
    lengthUnit: localization.lengthUnit,
    taxState: String(settings.taxState || '').trim().toUpperCase(),
    salesTaxRate: defaultTaxRate,
    defaultTaxRate,
    taxablePartsDefault: settings.taxablePartsDefault !== false,
    taxableServicesDefault: Boolean(settings.taxableServicesDefault),
    subscriptionTier: String(settings.subscriptionTier || settings.subscription_tier || currentSettings.subscriptionTier || 'free').toLowerCase(),
    subscriptionStatus: String(settings.subscriptionStatus || settings.subscription_status || currentSettings.subscriptionStatus || 'active').toLowerCase(),
    trialEndsAt: settings.trialEndsAt || settings.trial_ends_at || currentSettings.trialEndsAt || '',
    featureOverrides: normalizeFeatureOverrides(settings.featureOverrides || settings.feature_overrides || currentSettings.featureOverrides),
    inventoryLocationPresets: normalizePresetArray(
      settings.inventoryLocationPresets || settings.inventory_location_presets || currentSettings.inventoryLocationPresets
    ),
    inventoryCategoryPresets: normalizePresetArray(
      settings.inventoryCategoryPresets || settings.inventory_category_presets || currentSettings.inventoryCategoryPresets
    ),
    shippingLabelSettings: normalizeShippingLabelSettings(
      settings.shippingLabelSettings || settings.shipping_label_settings || currentSettings.shippingLabelSettings
    )
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
    countryCode: profile.country_code || '',
    currencyCode: profile.currency_code || 'USD',
    locale: profile.locale || 'en-US',
    taxLabel: profile.tax_label || 'Sales Tax',
    taxRegistrationNumber: profile.tax_registration_number || '',
    taxCalculationMode: profile.tax_calculation_mode || 'disabled',
    defaultTaxProfileId: profile.default_tax_profile_id || '',
    taxProfileRevision: Number(profile.tax_profile_revision || 1),
    dateFormat: normalizeDateFormat(profile.date_format, profile.locale || 'en-US'),
    measurementSystem: normalizeMeasurementSystem(profile.measurement_system, profileMeasurementDefaults.measurementSystem),
    lengthUnit: normalizeLengthUnit(profile.length_unit, profileMeasurementDefaults.lengthUnit),
    taxState: profile.tax_state || '',
    salesTaxRate: profile.sales_tax_rate == null ? '' : String(Number(profile.sales_tax_rate)),
    defaultTaxRate: profile.sales_tax_rate == null ? '' : String(Number(profile.sales_tax_rate)),
    taxablePartsDefault: profile.taxable_parts_default !== false,
    taxableServicesDefault: Boolean(profile.taxable_services_default),
    subscriptionTier: profile.subscription_tier || 'free',
    subscriptionStatus: profile.subscription_status || 'active',
    trialEndsAt: profile.trial_ends_at || '',
    featureOverrides: normalizeFeatureOverrides(profile.feature_overrides),
    inventoryLocationPresets: normalizePresetArray(profile.inventory_location_presets),
    inventoryCategoryPresets: normalizePresetArray(profile.inventory_category_presets),
    shippingLabelSettings: normalizeShippingLabelSettings(profile.shipping_label_settings),
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
    country_code: settings.countryCode || 'US',
    currency_code: settings.currencyCode || 'USD',
    locale: settings.locale || 'en-US',
    tax_label: settings.taxLabel || 'Sales Tax',
    tax_registration_number: settings.taxRegistrationNumber || '',
    tax_calculation_mode: settings.taxCalculationMode === 'manual' ? 'manual' : 'disabled',
    date_format: settings.dateFormat || getDefaultDateFormatForLocale(settings.locale || 'en-US'),
    measurement_system: settings.measurementSystem || getDefaultMeasurementPreferences(settings).measurementSystem,
    length_unit: settings.lengthUnit || getDefaultMeasurementPreferences(settings).lengthUnit,
    tax_state: settings.taxState,
    sales_tax_rate: Number(settings.defaultTaxRate ?? settings.salesTaxRate) || 0,
    taxable_parts_default: settings.taxablePartsDefault !== false,
    taxable_services_default: Boolean(settings.taxableServicesDefault),
    inventory_location_presets: normalizePresetArray(settings.inventoryLocationPresets),
    inventory_category_presets: normalizePresetArray(settings.inventoryCategoryPresets),
    shipping_label_settings: normalizeShippingLabelSettings(settings.shippingLabelSettings),
    onboarded_at: new Date().toISOString(),
    created_by: userId || null
  };
}

function normalizeFeatureOverrides(value) {
  if (!value || Array.isArray(value) || typeof value !== 'object') {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).filter(([, featureValue]) => typeof featureValue === 'boolean')
  );
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
