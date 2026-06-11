import { hasSupabaseConfig, supabase } from '../../shared/lib/supabaseClient';
import { normalizeBetaAccessRequest } from '../beta/betaAccessService';

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

  const [dashboardResult, accessResult] = await Promise.all([
    supabase.rpc('get_beta_operator_dashboard'),
    supabase.rpc('get_beta_access_requests')
  ]);

  if (dashboardResult.error) {
    throw dashboardResult.error;
  }
  if (accessResult.error) {
    throw accessResult.error;
  }

  return normalizeDashboard({
    ...dashboardResult.data,
    betaAccessRequests: accessResult.data || []
  });
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

export async function setShopPremiumTrial(shopId, trialDays, trialTier = 'pro') {
  if (!hasSupabaseConfig || !supabase || !shopId) {
    return null;
  }

  const { data, error } = await supabase.rpc('set_shop_premium_trial', {
    target_shop_id: shopId,
    trial_days: trialDays,
    trial_tier: trialTier
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function extendShopPremiumTrial(shopId, extendDays) {
  if (!hasSupabaseConfig || !supabase || !shopId) {
    return null;
  }

  const { data, error } = await supabase.rpc('extend_shop_premium_trial', {
    target_shop_id: shopId,
    extend_days: extendDays
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function endShopPremiumTrial(shopId) {
  if (!hasSupabaseConfig || !supabase || !shopId) {
    return null;
  }

  const { data, error } = await supabase.rpc('end_shop_premium_trial', {
    target_shop_id: shopId
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function updateBetaAccessRequest(accessRequest, status, notes = null) {
  const requestId = typeof accessRequest === 'object' ? accessRequest?.id : accessRequest;
  if (!hasSupabaseConfig || !supabase || !requestId) {
    return null;
  }

  const previousStatus = typeof accessRequest === 'object' ? accessRequest?.status : '';
  const { data, error } = await supabase.rpc('update_beta_access_request', {
    target_request_id: requestId,
    next_status: status,
    next_notes: notes
  });

  if (error) {
    throw error;
  }

  const updatedRequest = normalizeBetaAccessRequest(data);
  if (status === 'approved' && previousStatus !== 'approved') {
    await notifyBetaApprovalRequest(updatedRequest);
  }

  return updatedRequest;
}

export async function notifyBetaApprovalRequest(accessRequest) {
  if (!hasSupabaseConfig || !supabase || !accessRequest?.id || accessRequest.approvedNotifiedAt) {
    return null;
  }

  try {
    const { data, error } = await supabase.functions.invoke('notify-beta-approval', {
      body: { requestId: accessRequest.id }
    });

    if (error || data?.ok === false) {
      console.warn('Beta approval notification did not complete.', error || data?.error || 'Unknown notification error.');
    }

    return data || null;
  } catch (error) {
    console.warn('Beta approval notification failed.', error);
    return null;
  }
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
      failedUploadCount: Number(dashboard.summary?.failedUploadCount || 0),
      pendingBetaAccessRequests: Number(
        dashboard.summary?.pendingBetaAccessRequests
          ?? (dashboard.betaAccessRequests || []).filter((request) => request.status === 'pending').length
          ?? 0
      )
    },
    shops: (dashboard.shops || []).map(normalizeShopRow),
    members: (dashboard.members || []).map(normalizeMemberRow),
    usage: (dashboard.usage || []).map(normalizeShopRow),
    activity: (dashboard.activity || []).map(normalizeActivityRow),
    betaAccessRequests: (dashboard.betaAccessRequests || []).map(normalizeBetaAccessRequest)
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
    effectiveTier: shop.effective_tier || shop.effectiveTier || shop.plan_id || shop.planId || 'free',
    effectiveStatus: shop.effective_status || shop.effectiveStatus || shop.subscription_status || shop.subscriptionStatus || 'trialing',
    trialEndsAt: shop.trial_ends_at || shop.trialEndsAt || '',
    daysRemaining: Number(shop.days_remaining ?? shop.daysRemaining ?? 0),
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
    activity: [],
    betaAccessRequests: []
  });
}
