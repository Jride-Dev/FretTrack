import { hasSupabaseConfig, supabase } from '../../shared/lib/supabaseClient';

export const BILLING_STATUSES = {
  TRIALING: 'trialing',
  ACTIVE: 'active',
  GRACE: 'grace',
  READ_ONLY: 'read_only',
  CANCELED: 'canceled',
  BETA_BYPASS: 'beta_bypass'
};

const defaultEntitlements = {
  core_jobs: true,
  customers: true,
  photos: true,
  reports: true,
  csv_export: true,
  email_messages: true,
  sms_messages: false,
  inventory: false,
  advanced_accounting: false,
  advanced_branding: false,
  api_access: false,
  max_users: 2,
  max_storage_bytes: 5 * 1024 * 1024 * 1024,
  monthly_email_limit: 1000,
  monthly_sms_limit: 0
};

export function getDefaultEntitlementSnapshot(shopId = '') {
  return {
    shopId,
    plan: {
      id: hasSupabaseConfig ? 'trial' : 'local',
      name: hasSupabaseConfig ? 'Beta / Trial' : 'Local Development',
      status: 'active'
    },
    subscription: {
      status: hasSupabaseConfig ? BILLING_STATUSES.TRIALING : BILLING_STATUSES.BETA_BYPASS,
      effectiveStatus: hasSupabaseConfig ? BILLING_STATUSES.TRIALING : BILLING_STATUSES.BETA_BYPASS,
      trialEndsAt: '',
      currentPeriodEndsAt: '',
      graceEndsAt: '',
      billingEmail: ''
    },
    entitlements: defaultEntitlements,
    usage: {
      userCount: 0,
      storageBytes: 0,
      jobCount: 0,
      emailCountMonth: 0,
      smsCountMonth: 0
    },
    access: {
      canWrite: true,
      readOnly: false,
      canUploadPhotos: true,
      canSendEmail: true,
      canSendSms: false,
      canUseReports: true,
      canExportCsv: true
    }
  };
}

export async function getShopEntitlementSnapshot(shopId) {
  if (!hasSupabaseConfig || !supabase || !shopId) {
    return getDefaultEntitlementSnapshot(shopId);
  }

  const { data, error } = await supabase.rpc('get_shop_entitlement_snapshot', {
    target_shop_id: shopId
  });

  if (error) {
    console.error('Entitlement snapshot load failed.', error);
    throw error;
  }

  return normalizeEntitlementSnapshot(data, shopId);
}

export function normalizeEntitlementSnapshot(snapshot = {}, shopId = '') {
  const fallback = getDefaultEntitlementSnapshot(shopId);
  const entitlements = {
    ...fallback.entitlements,
    ...(snapshot.entitlements || {})
  };
  const subscription = {
    ...fallback.subscription,
    ...(snapshot.subscription || {})
  };
  const effectiveStatus = subscription.effectiveStatus || subscription.status || fallback.subscription.effectiveStatus;
  const canWrite = isWritableBillingStatus(effectiveStatus);

  return {
    ...fallback,
    ...snapshot,
    shopId: snapshot.shopId || shopId || fallback.shopId,
    plan: {
      ...fallback.plan,
      ...(snapshot.plan || {})
    },
    subscription: {
      ...subscription,
      effectiveStatus
    },
    entitlements,
    usage: {
      ...fallback.usage,
      ...(snapshot.usage || {})
    },
    access: {
      ...fallback.access,
      ...(snapshot.access || {}),
      canWrite,
      readOnly: !canWrite,
      canUploadPhotos: canWrite && Boolean(entitlements.photos),
      canSendEmail: canWrite && Boolean(entitlements.email_messages),
      canSendSms: canWrite && Boolean(entitlements.sms_messages),
      canUseReports: Boolean(entitlements.reports),
      canExportCsv: Boolean(entitlements.csv_export)
    }
  };
}

export function isWritableBillingStatus(status) {
  return [
    BILLING_STATUSES.TRIALING,
    BILLING_STATUSES.ACTIVE,
    BILLING_STATUSES.GRACE,
    BILLING_STATUSES.BETA_BYPASS
  ].includes(status);
}

export function isGraceStatus(snapshot) {
  return getEffectiveStatus(snapshot) === BILLING_STATUSES.GRACE;
}

export function isReadOnlyStatus(snapshot) {
  return !isWritableBillingStatus(getEffectiveStatus(snapshot));
}

export function getEffectiveStatus(snapshot) {
  return snapshot?.subscription?.effectiveStatus || snapshot?.subscription?.status || BILLING_STATUSES.TRIALING;
}

export function getEntitlement(snapshot, key, fallback = false) {
  return snapshot?.entitlements?.[key] ?? fallback;
}

export function getEnabledFeatureLabels(snapshot) {
  const features = [
    ['core_jobs', 'Core jobs'],
    ['customers', 'Customers'],
    ['photos', 'Photos'],
    ['reports', 'Reports'],
    ['csv_export', 'CSV export'],
    ['email_messages', 'Email messages'],
    ['sms_messages', 'SMS messages'],
    ['inventory', 'Inventory'],
    ['advanced_accounting', 'Advanced accounting'],
    ['advanced_branding', 'Advanced branding'],
    ['api_access', 'API access']
  ];
  return features.filter(([key]) => Boolean(getEntitlement(snapshot, key))).map(([, label]) => label);
}

export function formatStorage(bytes) {
  const value = Number(bytes) || 0;
  if (value >= 1024 * 1024 * 1024) {
    return `${(value / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }
  if (value >= 1024 * 1024) {
    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (value >= 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }
  return `${value} B`;
}

export function getBillingStatusLabel(status) {
  const labels = {
    [BILLING_STATUSES.TRIALING]: 'Trialing',
    [BILLING_STATUSES.ACTIVE]: 'Active',
    [BILLING_STATUSES.GRACE]: 'Grace period',
    [BILLING_STATUSES.READ_ONLY]: 'Read-only',
    [BILLING_STATUSES.CANCELED]: 'Canceled',
    [BILLING_STATUSES.BETA_BYPASS]: 'Beta bypass'
  };
  return labels[status] || status || 'Unknown';
}
