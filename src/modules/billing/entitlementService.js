import { hasSupabaseConfig, supabase } from '../../shared/lib/supabaseClient';

export const BILLING_STATUSES = {
  TRIALING: 'trialing',
  ACTIVE: 'active',
  GRACE: 'grace',
  READ_ONLY: 'read_only',
  CANCELED: 'canceled',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired',
  BETA_BYPASS: 'beta_bypass'
};

export const SUBSCRIPTION_TIERS = {
  FREE: 'free',
  SOLO: 'solo',
  SHOP: 'shop',
  PRO: 'pro',
  ENTERPRISE: 'enterprise'
};

export const CURRENT_SUBSCRIPTION_TIER_ORDER = [
  SUBSCRIPTION_TIERS.SHOP,
  SUBSCRIPTION_TIERS.PRO
];

export const PREMIUM_FEATURES = {
  PHOTO_EDITOR: 'photo_editor',
  ADVANCED_REPORTING: 'advanced_reporting',
  TEAM_MEMBERS: 'team_members',
  BUSINESS_ANALYTICS: 'business_analytics',
  INVENTORY_ANALYTICS: 'inventory_analytics',
  REVENUE_DASHBOARDS: 'revenue_dashboards',
  BACKUP_TOOLS: 'backup_tools',
  ADDITIONAL_STORAGE: 'additional_storage',
  CUSTOMER_PORTAL: 'customer_portal',
  SMS_MESSAGES: 'sms_messages',
  PUBLIC_JOB_STATUS_LINKS: 'public_job_status_links',
  PUBLIC_INVOICE_LINKS: 'public_invoice_links',
  API_ACCESS: 'api_access',
  CUSTOM_BRANDING: 'custom_branding',
  ADVANCED_INVENTORY_WORKFLOWS: 'advanced_inventory_workflows',
  MULTI_LOCATION: 'multi_location',
  CROSS_LOCATION_INVENTORY: 'cross_location_inventory',
  CENTRALIZED_REPORTING: 'centralized_reporting',
  ENTERPRISE_ADMINISTRATION: 'enterprise_administration'
};

const defaultEntitlements = {
  core_jobs: true,
  customers: true,
  photos: true,
  reports: true,
  csv_export: true,
  email_messages: true,
  sms_messages: false,
  scheduling: true,
  damage_maps: true,
  work_logs: true,
  printing: true,
  mobile_pwa: true,
  inventory: true,
  advanced_accounting: false,
  advanced_branding: false,
  photo_editor: false,
  advanced_reporting: false,
  team_members: false,
  business_analytics: false,
  inventory_analytics: false,
  revenue_dashboards: false,
  backup_tools: false,
  additional_storage: false,
  customer_portal: false,
  public_job_status_links: false,
  public_invoice_links: false,
  api_access: false,
  custom_branding: false,
  advanced_inventory_workflows: false,
  multi_location: false,
  cross_location_inventory: false,
  centralized_reporting: false,
  enterprise_administration: false,
  max_users: 2,
  max_storage_bytes: 5 * 1024 * 1024 * 1024,
  monthly_email_limit: 1000,
  monthly_sms_limit: 0
};

const tierEntitlements = {
  [SUBSCRIPTION_TIERS.FREE]: {
    ...defaultEntitlements
  },
  [SUBSCRIPTION_TIERS.SOLO]: {
    ...defaultEntitlements
  },
  [SUBSCRIPTION_TIERS.SHOP]: {
    photo_editor: true,
    team_members: true
  },
  [SUBSCRIPTION_TIERS.PRO]: {
    photo_editor: true,
    advanced_reporting: true,
    team_members: true,
    max_users: 10,
    max_storage_bytes: 100 * 1024 * 1024 * 1024
  },
  [SUBSCRIPTION_TIERS.ENTERPRISE]: {
    photo_editor: true,
    advanced_reporting: true,
    team_members: true,
    business_analytics: true,
    inventory_analytics: true,
    revenue_dashboards: true,
    backup_tools: true,
    additional_storage: true,
    customer_portal: true,
    sms_messages: true,
    public_job_status_links: true,
    public_invoice_links: true,
    api_access: true,
    custom_branding: true,
    advanced_branding: true,
    advanced_inventory_workflows: true,
    multi_location: true,
    cross_location_inventory: true,
    centralized_reporting: true,
    enterprise_administration: true,
    max_users: 100,
    max_storage_bytes: 1024 * 1024 * 1024 * 1024,
    monthly_sms_limit: 5000
  }
};

export const premiumFeatureGroups = [
  {
    tier: SUBSCRIPTION_TIERS.SHOP,
    label: 'Shop',
    features: [
      [PREMIUM_FEATURES.PHOTO_EDITOR, 'Photo Editor'],
      [PREMIUM_FEATURES.TEAM_MEMBERS, 'Team Members']
    ]
  },
  {
    tier: SUBSCRIPTION_TIERS.PRO,
    label: 'Pro',
    features: [
      [PREMIUM_FEATURES.ADVANCED_REPORTING, 'Advanced Reporting']
    ]
  }
];

export function getDefaultEntitlementSnapshot(shopId = '') {
  return {
    shopId,
    plan: {
      id: hasSupabaseConfig ? 'trial' : 'local',
      name: hasSupabaseConfig ? 'Beta / Trial' : 'Local Development',
      status: 'active'
    },
    subscription: {
      tier: SUBSCRIPTION_TIERS.FREE,
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
  const rawSubscription = snapshot.subscription || {};
  const tier = normalizeSubscriptionTier(rawSubscription.tier || snapshot.plan?.id || fallback.subscription.tier);
  const tierDefaults = getTierEntitlements(tier);
  const featureOverrides = snapshot.featureOverrides || rawSubscription.featureOverrides || {};
  const entitlements = {
    ...fallback.entitlements,
    ...tierDefaults,
    ...(snapshot.entitlements || {}),
    ...featureOverrides
  };
  const subscription = {
    ...fallback.subscription,
    ...rawSubscription,
    tier
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
    featureOverrides,
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
      canExportCsv: Boolean(entitlements.csv_export),
      canUsePhotoEditor: Boolean(entitlements.photo_editor),
      canUseAdvancedReporting: Boolean(entitlements.advanced_reporting),
      canManageTeamMembers: Boolean(entitlements.team_members),
      canUseCustomerPortal: Boolean(entitlements.customer_portal),
      canUseApi: Boolean(entitlements.api_access),
      canUseCustomBranding: Boolean(entitlements.custom_branding || entitlements.advanced_branding),
      canUseMultiLocation: Boolean(entitlements.multi_location)
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

export function getTierEntitlements(tier) {
  const normalizedTier = normalizeSubscriptionTier(tier);
  return {
    ...defaultEntitlements,
    ...(tierEntitlements[normalizedTier] || {})
  };
}

export function normalizeSubscriptionTier(tier) {
  const value = String(tier || SUBSCRIPTION_TIERS.FREE).toLowerCase();
  return Object.values(SUBSCRIPTION_TIERS).includes(value) ? value : SUBSCRIPTION_TIERS.FREE;
}

export function getSubscriptionTierLabel(tier) {
  const labels = {
    [SUBSCRIPTION_TIERS.FREE]: 'Legacy trial',
    [SUBSCRIPTION_TIERS.SOLO]: 'Legacy trial',
    [SUBSCRIPTION_TIERS.SHOP]: 'Shop',
    [SUBSCRIPTION_TIERS.PRO]: 'Pro',
    [SUBSCRIPTION_TIERS.ENTERPRISE]: 'Enterprise'
  };
  return labels[normalizeSubscriptionTier(tier)] || 'Trial';
}

export function getShopFeatureValue(snapshot, featureKey) {
  return Boolean(getEntitlement(snapshot, featureKey, false));
}

export function canUseAdvancedReporting(snapshot) {
  return getShopFeatureValue(snapshot, PREMIUM_FEATURES.ADVANCED_REPORTING);
}

export function canUsePhotoEditor(snapshot) {
  return getShopFeatureValue(snapshot, PREMIUM_FEATURES.PHOTO_EDITOR);
}

export function canManageTeamMembers(snapshot) {
  return getShopFeatureValue(snapshot, PREMIUM_FEATURES.TEAM_MEMBERS);
}

export function canUseCustomerPortal(snapshot) {
  return getShopFeatureValue(snapshot, PREMIUM_FEATURES.CUSTOMER_PORTAL);
}

export function canUseSMS(snapshot) {
  return getShopFeatureValue(snapshot, PREMIUM_FEATURES.SMS_MESSAGES);
}

export function canUseAPI(snapshot) {
  return getShopFeatureValue(snapshot, PREMIUM_FEATURES.API_ACCESS);
}

export function canUseCustomBranding(snapshot) {
  return getShopFeatureValue(snapshot, PREMIUM_FEATURES.CUSTOM_BRANDING)
    || getShopFeatureValue(snapshot, 'advanced_branding');
}

export function canUseMultiLocation(snapshot) {
  return getShopFeatureValue(snapshot, PREMIUM_FEATURES.MULTI_LOCATION);
}

export function getPremiumFeatureAvailability(snapshot) {
  return premiumFeatureGroups.flatMap((group) => (
    group.features.map(([key, label]) => ({
      key,
      label,
      tier: group.tier,
      tierLabel: group.label,
      enabled: getShopFeatureValue(snapshot, key)
    }))
  ));
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
    ['photo_editor', 'Photo editor'],
    ['advanced_reporting', 'Advanced reporting'],
    ['team_members', 'Team members'],
    ['business_analytics', 'Business analytics'],
    ['inventory_analytics', 'Inventory analytics'],
    ['customer_portal', 'Customer portal'],
    ['advanced_branding', 'Advanced branding'],
    ['custom_branding', 'Custom branding'],
    ['multi_location', 'Multi-location'],
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
    [BILLING_STATUSES.CANCELLED]: 'Cancelled',
    [BILLING_STATUSES.EXPIRED]: 'Expired',
    [BILLING_STATUSES.BETA_BYPASS]: 'Beta bypass'
  };
  return labels[status] || status || 'Unknown';
}
