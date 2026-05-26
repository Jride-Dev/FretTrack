import { hasSupabaseConfig, supabase } from '../../shared/lib/supabaseClient';

export async function isCurrentOperator() {
  if (!hasSupabaseConfig || !supabase) {
    return false;
  }

  const { data, error } = await supabase.rpc('is_current_operator');
  if (error) {
    console.error('Operator check failed.', error);
    return false;
  }

  return Boolean(data);
}

export async function getBetaOperatorDashboard() {
  if (!hasSupabaseConfig || !supabase) {
    return getEmptyDashboard();
  }

  const { data, error } = await supabase.rpc('get_beta_operator_dashboard');
  if (error) {
    throw error;
  }

  return normalizeDashboard(data);
}

export async function updateBetaShopSubscription(shopId, updates = {}) {
  if (!hasSupabaseConfig || !supabase || !shopId) {
    return null;
  }

  const { data, error } = await supabase.rpc('update_beta_shop_subscription', {
    target_shop_id: shopId,
    next_status: updates.nextStatus ?? null,
    extend_trial_days: updates.extendTrialDays ?? null,
    beta_bypass: updates.betaBypass ?? null
  });

  if (error) {
    throw error;
  }

  return data;
}

function normalizeDashboard(dashboard = {}) {
  return {
    summary: {
      totalBetaShops: Number(dashboard.summary?.totalBetaShops || 0),
      activeUsers: Number(dashboard.summary?.activeUsers || 0),
      trialingShops: Number(dashboard.summary?.trialingShops || 0),
      betaBypassShops: Number(dashboard.summary?.betaBypassShops || 0),
      graceOrReadOnlyShops: Number(dashboard.summary?.graceOrReadOnlyShops || 0),
      totalStorageBytes: Number(dashboard.summary?.totalStorageBytes || 0),
      totalJobs: Number(dashboard.summary?.totalJobs || 0),
      recentActivityCount: Number(dashboard.summary?.recentActivityCount || 0),
      failedUploadCount: Number(dashboard.summary?.failedUploadCount || 0)
    },
    shops: (dashboard.shops || []).map(normalizeShopRow),
    members: (dashboard.members || []).map(normalizeMemberRow),
    usage: (dashboard.usage || []).map(normalizeShopRow),
    activity: (dashboard.activity || []).map(normalizeActivityRow)
  };
}

function normalizeShopRow(shop = {}) {
  return {
    shopId: shop.shop_id || shop.shopId || '',
    shopName: shop.shop_name || shop.shopName || '',
    shopEmail: shop.shop_email || shop.shopEmail || '',
    planId: shop.plan_id || shop.planId || 'trial',
    planName: shop.plan_name || shop.planName || '',
    subscriptionStatus: shop.subscription_status || shop.subscriptionStatus || 'trialing',
    trialEndsAt: shop.trial_ends_at || shop.trialEndsAt || '',
    graceEndsAt: shop.grace_ends_at || shop.graceEndsAt || '',
    currentPeriodEndsAt: shop.current_period_ends_at || shop.currentPeriodEndsAt || '',
    billingEmail: shop.billing_email || shop.billingEmail || '',
    userCount: Number(shop.user_count ?? shop.userCount ?? 0),
    jobCount: Number(shop.job_count ?? shop.jobCount ?? 0),
    imageCount: Number(shop.image_count ?? shop.imageCount ?? 0),
    storageBytes: Number(shop.storage_bytes ?? shop.storageBytes ?? 0),
    emailCountMonth: Number(shop.email_count_month ?? shop.emailCountMonth ?? 0),
    smsCountMonth: Number(shop.sms_count_month ?? shop.smsCountMonth ?? 0),
    failedUploadCount: Number(shop.failed_upload_count ?? shop.failedUploadCount ?? 0),
    adminEmails: shop.admin_emails || shop.adminEmails || [],
    usageMeasuredAt: shop.usage_measured_at || shop.usageMeasuredAt || '',
    lastActivityAt: shop.last_activity_at || shop.lastActivityAt || '',
    createdAt: shop.created_at || shop.createdAt || '',
    updatedAt: shop.updated_at || shop.updatedAt || '',
    onboardedAt: shop.onboarded_at || shop.onboardedAt || ''
  };
}

function normalizeMemberRow(member = {}) {
  return {
    id: member.id || '',
    shopId: member.shop_id || member.shopId || '',
    shopName: member.shop_name || member.shopName || '',
    userId: member.user_id || member.userId || '',
    email: member.email || '',
    displayName: member.display_name || member.displayName || '',
    role: member.role || '',
    lastSignInAt: member.last_sign_in_at || member.lastSignInAt || '',
    status: member.status || '',
    createdAt: member.created_at || member.createdAt || '',
    updatedAt: member.updated_at || member.updatedAt || ''
  };
}

function normalizeActivityRow(activity = {}) {
  return {
    createdAt: activity.created_at || activity.createdAt || '',
    shopId: activity.shop_id || activity.shopId || '',
    shopName: activity.shop_name || activity.shopName || '',
    subjectId: activity.subject_id || activity.subjectId || '',
    eventType: activity.event_type || activity.eventType || '',
    eventLabel: activity.event_label || activity.eventLabel || '',
    eventNote: activity.event_note || activity.eventNote || '',
    eventData: activity.event_data || activity.eventData || {}
  };
}

function getEmptyDashboard() {
  return normalizeDashboard({
    summary: {},
    shops: [],
    members: [],
    usage: [],
    activity: []
  });
}
