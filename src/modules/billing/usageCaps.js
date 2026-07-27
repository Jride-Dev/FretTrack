import { hasSupabaseConfig, supabase } from '../../shared/lib/supabaseClient';

export const SHOP_USAGE_LIMITS = Object.freeze({
  monthlyEmailLimit: 1000,
  monthlyPhotoUploadLimit: 2000,
  maxPhotoStorageBytes: 5 * 1024 * 1024 * 1024
});

export const PRO_USAGE_LIMITS = Object.freeze({
  monthlyEmailLimit: 5000,
  monthlyPhotoUploadLimit: 10000,
  maxPhotoStorageBytes: 25 * 1024 * 1024 * 1024
});

export const USAGE_WARNING_LEVELS = Object.freeze({
  NORMAL: 'normal',
  WARNING: 'warning',
  CRITICAL: 'critical',
  LIMIT_REACHED: 'limit-reached'
});

export const PHOTO_UPLOAD_LIMIT_MESSAGE = 'Photo upload limit reached for this month. Existing photos remain available.';
export const PHOTO_STORAGE_LIMIT_MESSAGE = 'Photo storage limit reached. Delete unneeded photos or upgrade the shop plan before uploading more.';
export const EMAIL_LIMIT_MESSAGE = 'Monthly email limit reached. Existing records and generated documents remain available, but new emails cannot be sent until the quota resets or the plan changes.';

export function getMonthlyEmailLimit(entitlements = {}) {
  return normalizeLimit(entitlements.monthly_email_limit, SHOP_USAGE_LIMITS.monthlyEmailLimit);
}

export function getMonthlyPhotoUploadLimit(entitlements = {}) {
  return normalizeLimit(entitlements.monthly_photo_upload_limit, SHOP_USAGE_LIMITS.monthlyPhotoUploadLimit);
}

export function getPhotoStorageLimit(entitlements = {}) {
  return normalizeLimit(
    entitlements.max_photo_storage_bytes ?? entitlements.max_storage_bytes,
    SHOP_USAGE_LIMITS.maxPhotoStorageBytes
  );
}

export function getUsagePercentage(used, limit) {
  const normalizedLimit = normalizeLimit(limit, 0);
  if (normalizedLimit === 0) {
    return Number(used || 0) > 0 ? 100 : 0;
  }
  return Math.min(100, Math.max(0, (Number(used || 0) / normalizedLimit) * 100));
}

export function getUsageWarningLevel(used, limit) {
  const percentage = getUsagePercentage(used, limit);
  if (percentage >= 100) {
    return USAGE_WARNING_LEVELS.LIMIT_REACHED;
  }
  if (percentage >= 95) {
    return USAGE_WARNING_LEVELS.CRITICAL;
  }
  if (percentage >= 80) {
    return USAGE_WARNING_LEVELS.WARNING;
  }
  return USAGE_WARNING_LEVELS.NORMAL;
}

export function formatStorageBytes(bytes) {
  const value = Math.max(0, Number(bytes) || 0);
  const units = [
    ['TiB', 1024 ** 4],
    ['GiB', 1024 ** 3],
    ['MiB', 1024 ** 2],
    ['KiB', 1024]
  ];
  const unit = units.find(([, size]) => value >= size);
  if (!unit) {
    return `${Math.round(value)} B`;
  }
  const [label, size] = unit;
  const amount = value / size;
  return `${amount >= 10 || Number.isInteger(amount) ? amount.toFixed(Number.isInteger(amount) ? 0 : 1) : amount.toFixed(2)} ${label}`;
}

export function resolveUsageResetDate(usage = {}) {
  return usage.resetDate || usage.periodEnd || '';
}

export function canReserveEmailRecipients(usage = {}, recipientCount = 1) {
  return Number(usage.emailRecipientsUsed || 0) + Number(recipientCount || 0)
    <= Number(usage.monthlyEmailLimit || 0);
}

export function canReservePhotoUpload(usage = {}, expectedBytes = 0, sourceUploadCount = 1) {
  return Number(usage.sourcePhotosUploaded || 0) + Number(sourceUploadCount || 0)
      <= Number(usage.monthlyPhotoUploadLimit || 0)
    && Number(usage.photoStorageBytes || 0) + Number(expectedBytes || 0)
      <= Number(usage.maxPhotoStorageBytes || 0);
}

export async function getShopUsageSnapshot(shopId) {
  if (!shopId || !hasSupabaseConfig || !supabase) {
    return null;
  }
  const { data, error } = await supabase.rpc('get_shop_usage_snapshot', {
    target_shop_id: shopId
  });
  if (error) {
    throw error;
  }
  return normalizeUsageSnapshot(data);
}

export async function reservePhotoUsage({
  shopId,
  requestId,
  usageKind = 'source_photo',
  expectedStorageBytes,
  bucket,
  path
}) {
  requireExplicitPhotoContext({ shopId, requestId, expectedStorageBytes, bucket, path });
  const { data, error } = await supabase.rpc('reserve_shop_usage', {
    target_shop_id: shopId,
    target_request_id: requestId,
    target_usage_kind: usageKind,
    requested_units: usageKind === 'source_photo' ? 1 : 0,
    expected_storage_bytes: Math.max(0, Number(expectedStorageBytes) || 0),
    target_bucket: bucket,
    target_path: path
  });
  if (error) {
    throw error;
  }
  if (!data?.allowed) {
    throw createUsageLimitError(data);
  }
  return data;
}

export async function settlePhotoUsage({ shopId, requestId }) {
  const { data, error } = await supabase.rpc('settle_shop_usage_reservation', {
    target_shop_id: shopId,
    target_request_id: requestId
  });
  if (error) {
    throw error;
  }
  return data;
}

export async function releasePhotoUsageReservation({ shopId, requestId }) {
  if (!shopId || !requestId || !hasSupabaseConfig || !supabase) {
    return null;
  }
  const { data, error } = await supabase.rpc('release_shop_usage_reservation', {
    target_shop_id: shopId,
    target_request_id: requestId
  });
  if (error) {
    throw error;
  }
  return data;
}

export async function releaseDeletedPhotoStorage({ shopId, bucket, path }) {
  if (!shopId || !bucket || !path || !hasSupabaseConfig || !supabase) {
    return null;
  }
  const { data, error } = await supabase.rpc('release_photo_storage_object', {
    target_shop_id: shopId,
    target_bucket: bucket,
    target_path: path
  });
  if (error) {
    throw error;
  }
  return data;
}

export function normalizeUsageSnapshot(usage = {}) {
  return {
    periodStart: usage.periodStart || usage.period_start || '',
    periodEnd: usage.periodEnd || usage.period_end || '',
    resetDate: usage.resetDate || usage.reset_date || usage.periodEnd || usage.period_end || '',
    emailRecipientsUsed: Number(usage.emailRecipientsUsed ?? usage.email_recipients_used ?? 0),
    monthlyEmailLimit: Number(usage.monthlyEmailLimit ?? usage.monthly_email_limit ?? SHOP_USAGE_LIMITS.monthlyEmailLimit),
    sourcePhotosUploaded: Number(usage.sourcePhotosUploaded ?? usage.source_photos_uploaded ?? 0),
    monthlyPhotoUploadLimit: Number(usage.monthlyPhotoUploadLimit ?? usage.monthly_photo_upload_limit ?? SHOP_USAGE_LIMITS.monthlyPhotoUploadLimit),
    photoStorageBytes: Number(usage.photoStorageBytes ?? usage.photo_storage_bytes ?? 0),
    maxPhotoStorageBytes: Number(usage.maxPhotoStorageBytes ?? usage.max_photo_storage_bytes ?? SHOP_USAGE_LIMITS.maxPhotoStorageBytes)
  };
}

function normalizeLimit(value, fallback) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

function requireExplicitPhotoContext({ shopId, requestId, expectedStorageBytes, bucket, path }) {
  if (!hasSupabaseConfig || !supabase) {
    throw new Error('Photo usage enforcement requires Supabase.');
  }
  if (!shopId || !requestId || !bucket || !path || Number(expectedStorageBytes) < 1) {
    throw new Error('Explicit shop, request, storage path, and byte size are required for photo upload.');
  }
}

function createUsageLimitError(result = {}) {
  const messages = {
    PHOTO_MONTHLY_UPLOAD_LIMIT_REACHED: PHOTO_UPLOAD_LIMIT_MESSAGE,
    PHOTO_STORAGE_LIMIT_REACHED: PHOTO_STORAGE_LIMIT_MESSAGE,
    EMAIL_MONTHLY_LIMIT_REACHED: EMAIL_LIMIT_MESSAGE
  };
  const error = new Error(messages[result.code] || 'This shop usage limit has been reached.');
  error.code = result.code || 'USAGE_LIMIT_REACHED';
  error.usage = result;
  return error;
}
