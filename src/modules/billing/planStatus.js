export const DEFAULT_EMBLEM_SRC = '/frettrack-emblem.png';
export const PRO_EMBLEM_SRC = '/branding/frettrack-pro-emblem.png';

const BILLING_STATUSES = {
  ACTIVE: 'active',
  BETA_BYPASS: 'beta_bypass',
  CANCELED: 'canceled',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired',
  GRACE: 'grace',
  INACTIVE: 'inactive',
  PAST_DUE: 'past_due',
  READ_ONLY: 'read_only',
  TRIALING: 'trialing',
  UNKNOWN: 'unknown'
};

const SUBSCRIPTION_TIERS = {
  ENTERPRISE: 'enterprise',
  FREE: 'free',
  PRO: 'pro',
  SHOP: 'shop',
  SOLO: 'solo'
};

const FEATURE_KEYS = {
  ADVANCED_REPORTING: 'advanced_reporting',
  PHOTO_EDITOR: 'photo_editor',
  TEAM_MEMBERS: 'team_members'
};

const BILLING_STATUS_LABELS = {
  [BILLING_STATUSES.ACTIVE]: 'Active',
  [BILLING_STATUSES.BETA_BYPASS]: 'Beta bypass',
  [BILLING_STATUSES.CANCELED]: 'Canceled',
  [BILLING_STATUSES.CANCELLED]: 'Cancelled',
  [BILLING_STATUSES.EXPIRED]: 'Expired',
  [BILLING_STATUSES.GRACE]: 'Grace period',
  [BILLING_STATUSES.INACTIVE]: 'Inactive',
  [BILLING_STATUSES.PAST_DUE]: 'Past due',
  [BILLING_STATUSES.READ_ONLY]: 'Read-only',
  [BILLING_STATUSES.TRIALING]: 'Trialing',
  [BILLING_STATUSES.UNKNOWN]: 'Unknown'
};

const CURRENT_PLAN_LABELS = {
  expired: 'Expired',
  free: 'Free',
  pro: 'Pro',
  shop: 'Shop',
  unknown: 'Unknown'
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function getPlanStatus(entitlementSnapshot = {}) {
  const snapshot = entitlementSnapshot || {};
  const subscription = snapshot.subscription || {};
  const plan = snapshot.plan || {};
  const rawTier = subscription.effectiveTier
    || subscription.tier
    || plan.id
    || snapshot.subscriptionTier
    || SUBSCRIPTION_TIERS.FREE;
  const normalizedTier = normalizeSubscriptionTier(rawTier);
  const rawStatus = normalizeStatus(
    subscription.effectiveStatus
      || subscription.status
      || plan.status
      || snapshot.subscriptionStatus
      || BILLING_STATUSES.TRIALING
  );
  const trialEndsAt = getFirstValue(subscription, [
    'trialEndsAt',
    'trialEnd',
    'trial_expires_at',
    'trial_end',
    'trial_ends_at'
  ]) || snapshot.trialEndsAt || null;
  const currentPeriodStart = getFirstValue(subscription, [
    'currentPeriodStart',
    'currentPeriodStartsAt',
    'current_period_start',
    'current_period_starts_at'
  ]) || null;
  const currentPeriodEnd = getFirstValue(subscription, [
    'currentPeriodEnd',
    'currentPeriodEndsAt',
    'current_period_end',
    'current_period_ends_at'
  ]) || null;
  const cancelAtPeriodEnd = toBoolean(subscription.cancelAtPeriodEnd ?? subscription.cancel_at_period_end);
  const billingInterval = normalizeBillingInterval(
    subscription.billingInterval
      || subscription.billing_interval
      || subscription.interval
      || plan.billingInterval
      || plan.billing_interval,
    rawStatus
  );
  const trialDateState = getDateState(trialEndsAt);
  const periodDateState = getDateState(currentPeriodEnd);
  const isCanceledStatus = rawStatus === BILLING_STATUSES.CANCELED || rawStatus === BILLING_STATUSES.CANCELLED;
  const canceledAccessActive = isCanceledStatus && Boolean(currentPeriodEnd) && !periodDateState.expired;
  const trialExpired = rawStatus === BILLING_STATUSES.TRIALING && trialDateState.expired;
  const inactiveStatus = [
    BILLING_STATUSES.EXPIRED,
    BILLING_STATUSES.INACTIVE,
    BILLING_STATUSES.READ_ONLY
  ].includes(rawStatus);
  const isExpired = trialExpired || inactiveStatus || (isCanceledStatus && !canceledAccessActive);
  const basePlan = getBasePlan({
    hasAdvancedReportingFeature: getFeatureValue(snapshot, FEATURE_KEYS.ADVANCED_REPORTING),
    hasShopFeatureAccess: getFeatureValue(snapshot, FEATURE_KEYS.PHOTO_EDITOR) || getFeatureValue(snapshot, FEATURE_KEYS.TEAM_MEMBERS),
    normalizedTier
  });
  const isTrial = rawStatus === BILLING_STATUSES.TRIALING && !isExpired;
  const effectivePlan = isExpired ? 'expired' : basePlan;
  const hasProBranding = effectivePlan === 'pro';
  const hasAdvancedReporting = effectivePlan === 'pro';
  const hasPhotoEditor = !isExpired && (
    effectivePlan === 'shop'
    || effectivePlan === 'pro'
    || getFeatureValue(snapshot, FEATURE_KEYS.PHOTO_EDITOR)
  );
  const hasTeamMembers = !isExpired && (
    effectivePlan === 'shop'
    || effectivePlan === 'pro'
    || getFeatureValue(snapshot, FEATURE_KEYS.TEAM_MEMBERS)
  );
  const isCanceling = !isExpired && (cancelAtPeriodEnd || canceledAccessActive);
  const countdown = getCountdownLabel({
    cancelAtPeriodEnd,
    currentPeriodEnd,
    periodDateState,
    rawStatus,
    trialDateState,
    isTrial,
    isExpired
  });
  const planLabel = getPlanLabel({
    billingInterval,
    effectivePlan,
    isCanceling,
    isExpired,
    isTrial
  });
  const currentPlanLabel = CURRENT_PLAN_LABELS[effectivePlan] || 'Unknown';
  const badgeTone = getBadgeTone({
    effectivePlan,
    isTrial,
    status: rawStatus
  });
  const status = trialExpired ? BILLING_STATUSES.EXPIRED : rawStatus;

  return {
    tier: isExpired ? 'expired' : isTrial ? 'trial' : effectivePlan,
    effectivePlan,
    underlyingTier: normalizedTier,
    publicPlanName: planLabel,
    currentPlanLabel,
    planAccessName: currentPlanLabel,
    planLabel,
    billingInterval,
    billingIntervalLabel: formatInterval(billingInterval),
    status,
    statusLabel: getBillingStatusLabel(status),
    hasAdvancedReporting,
    hasProBranding,
    hasPhotoEditor,
    hasTeamMembers,
    trialEndsAt: trialEndsAt || null,
    currentPeriodStart: currentPeriodStart || null,
    currentPeriodEnd: currentPeriodEnd || null,
    cancelAtPeriodEnd,
    canceledAccessActive,
    daysRemaining: countdown.daysRemaining,
    countdownLabel: countdown.label,
    nextBillingLabel: countdown.nextBillingLabel,
    inactiveActionLabel: isExpired ? 'Upgrade or renew to continue paid features' : '',
    badgeTone,
    emblem: hasProBranding ? 'pro' : 'standard',
    emblemSrc: hasProBranding ? PRO_EMBLEM_SRC : DEFAULT_EMBLEM_SRC,
    emblemClassName: isExpired ? 'is-expired' : hasProBranding ? 'is-pro' : '',
    headerLabel: getHeaderLabel({ effectivePlan }),
    versionLabel: planLabel,
    shortCountdownLabel: countdown.shortLabel
  };
}

export function getPlanVersionText(appVersion, planStatus) {
  const parts = [`v${appVersion}`];
  if (planStatus?.planLabel) {
    parts.push(planStatus.planLabel);
  }
  if (planStatus?.shortCountdownLabel) {
    parts.push(planStatus.shortCountdownLabel);
  }
  return parts.join(' | ');
}

function getBasePlan({ hasAdvancedReportingFeature, hasShopFeatureAccess, normalizedTier }) {
  if (normalizedTier === SUBSCRIPTION_TIERS.PRO || hasAdvancedReportingFeature) {
    return 'pro';
  }

  if (normalizedTier === SUBSCRIPTION_TIERS.SHOP || hasShopFeatureAccess) {
    return 'shop';
  }

  if (normalizedTier === SUBSCRIPTION_TIERS.FREE || normalizedTier === SUBSCRIPTION_TIERS.SOLO) {
    return 'free';
  }

  return 'unknown';
}

function getHeaderLabel({ effectivePlan }) {
  if (effectivePlan === 'pro') {
    return 'FretTrack Pro';
  }

  if (effectivePlan === 'shop') {
    return 'FretTrack Shop';
  }

  return 'FretTrack';
}

function getPlanLabel({ billingInterval, effectivePlan, isCanceling, isExpired, isTrial }) {
  if (isExpired || effectivePlan === 'expired') {
    return 'Expired';
  }

  if (isTrial) {
    if (effectivePlan === 'pro') {
      return 'Trial: Pro';
    }
    if (effectivePlan === 'shop') {
      return 'Trial: Shop';
    }
    if (effectivePlan === 'free') {
      return 'Free';
    }
    return 'Trial';
  }

  if (isCanceling) {
    if (effectivePlan === 'pro') {
      return 'Pro, canceling';
    }
    if (effectivePlan === 'shop') {
      return 'Shop, canceling';
    }
  }

  if (effectivePlan === 'pro' || effectivePlan === 'shop') {
    const intervalLabel = formatInterval(billingInterval);
    const planName = CURRENT_PLAN_LABELS[effectivePlan];
    return intervalLabel ? `${planName} ${intervalLabel}` : planName;
  }

  return CURRENT_PLAN_LABELS[effectivePlan] || 'Unknown';
}

function getCountdownLabel({
  cancelAtPeriodEnd,
  currentPeriodEnd,
  periodDateState,
  rawStatus,
  trialDateState,
  isTrial,
  isExpired
}) {
  if (isExpired) {
    return {
      daysRemaining: null,
      label: 'Upgrade or renew to continue paid features',
      nextBillingLabel: null,
      shortLabel: 'Upgrade or renew to continue paid features'
    };
  }

  if (rawStatus === BILLING_STATUSES.PAST_DUE) {
    return {
      daysRemaining: null,
      label: 'Past due',
      nextBillingLabel: 'Past due',
      shortLabel: 'Past due'
    };
  }

  if (isTrial) {
    return buildDateCountdown({
      dateState: trialDateState,
      prefix: 'Trial ends',
      expiredLabel: 'Trial expired',
      shortMode: 'days-left'
    });
  }

  if (rawStatus === BILLING_STATUSES.CANCELED || rawStatus === BILLING_STATUSES.CANCELLED) {
    return {
      daysRemaining: periodDateState.daysRemaining,
      label: currentPeriodEnd && !periodDateState.expired
        ? formatAccessEnds(periodDateState.daysRemaining)
        : 'Canceled',
      nextBillingLabel: null,
      shortLabel: currentPeriodEnd && !periodDateState.expired
        ? formatAccessEnds(periodDateState.daysRemaining)
        : 'Canceled'
    };
  }

  if (cancelAtPeriodEnd) {
    return {
      daysRemaining: periodDateState.daysRemaining,
      label: formatAccessEnds(periodDateState.daysRemaining),
      nextBillingLabel: null,
      shortLabel: formatAccessEnds(periodDateState.daysRemaining)
    };
  }

  if (currentPeriodEnd) {
    return buildDateCountdown({
      dateState: periodDateState,
      prefix: 'Renews',
      expiredLabel: 'Past due',
      shortMode: 'full'
    });
  }

  if (rawStatus === BILLING_STATUSES.ACTIVE || rawStatus === BILLING_STATUSES.BETA_BYPASS) {
    return {
      daysRemaining: null,
      label: getBillingStatusLabel(rawStatus),
      nextBillingLabel: null,
      shortLabel: ''
    };
  }

  return {
    daysRemaining: null,
    label: getBillingStatusLabel(rawStatus) || 'Unknown',
    nextBillingLabel: null,
    shortLabel: ''
  };
}

function buildDateCountdown({ dateState, expiredLabel, prefix, shortMode }) {
  if (!dateState.hasDate) {
    return {
      daysRemaining: null,
      label: `${prefix} date pending`,
      nextBillingLabel: null,
      shortLabel: ''
    };
  }

  if (dateState.expired) {
    return {
      daysRemaining: null,
      label: expiredLabel,
      nextBillingLabel: expiredLabel,
      shortLabel: expiredLabel
    };
  }

  const suffix = dateState.daysRemaining === 0
    ? 'today'
    : dateState.daysRemaining === 1
      ? 'in 1 day'
      : `in ${dateState.daysRemaining} days`;
  const label = `${prefix} ${suffix}`;
  const daysLeft = dateState.daysRemaining === 0
    ? `${prefix} today`
    : `${dateState.daysRemaining} day${dateState.daysRemaining === 1 ? '' : 's'} left`;
  return {
    daysRemaining: dateState.daysRemaining,
    label,
    nextBillingLabel: label,
    shortLabel: shortMode === 'days-left' ? daysLeft : label
  };
}

function formatAccessEnds(daysRemaining) {
  if (!Number.isFinite(daysRemaining)) {
    return 'Access end date pending';
  }
  if (daysRemaining <= 0) {
    return 'Access ends today';
  }
  return daysRemaining === 1 ? 'Access ends in 1 day' : `Access ends in ${daysRemaining} days`;
}

function getDateState(value) {
  if (!value) {
    return {
      daysRemaining: null,
      expired: false,
      hasDate: false
    };
  }

  const date = new Date(value);
  const time = date.getTime();
  if (!Number.isFinite(time)) {
    return {
      daysRemaining: null,
      expired: false,
      hasDate: false
    };
  }

  const now = new Date();
  if (time < now.getTime()) {
    return {
      daysRemaining: null,
      expired: true,
      hasDate: true
    };
  }

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const targetDay = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  return {
    daysRemaining: Math.max(0, Math.round((targetDay - today) / DAY_MS)),
    expired: false,
    hasDate: true
  };
}

function getBadgeTone({ effectivePlan, isTrial, status }) {
  if (effectivePlan === 'expired' || status === BILLING_STATUSES.EXPIRED || status === BILLING_STATUSES.CANCELED || status === BILLING_STATUSES.CANCELLED) {
    return 'danger';
  }
  if (status === BILLING_STATUSES.PAST_DUE || status === BILLING_STATUSES.READ_ONLY || status === BILLING_STATUSES.INACTIVE) {
    return 'warning';
  }
  if (isTrial) {
    return effectivePlan === 'pro' ? 'pro' : 'trial';
  }
  if (effectivePlan === 'pro') {
    return 'pro';
  }
  if (effectivePlan === 'shop') {
    return 'shop';
  }
  return 'neutral';
}

function normalizeBillingInterval(value, status) {
  if (status === BILLING_STATUSES.TRIALING) {
    return 'trial';
  }
  const text = String(value || '').toLowerCase();
  if (text.includes('year') || text.includes('annual')) {
    return 'yearly';
  }
  if (text.includes('month')) {
    return 'monthly';
  }
  if (text === 'trial') {
    return 'trial';
  }
  return null;
}

function normalizeStatus(value) {
  const status = String(value || BILLING_STATUSES.UNKNOWN).toLowerCase();
  if (status === BILLING_STATUSES.CANCELLED) {
    return BILLING_STATUSES.CANCELED;
  }
  return status;
}

function normalizeSubscriptionTier(tier) {
  const value = String(tier || SUBSCRIPTION_TIERS.FREE).toLowerCase();
  return Object.values(SUBSCRIPTION_TIERS).includes(value) ? value : SUBSCRIPTION_TIERS.FREE;
}

function getFeatureValue(snapshot, featureKey) {
  const accessKey = {
    [FEATURE_KEYS.ADVANCED_REPORTING]: 'canUseAdvancedReporting',
    [FEATURE_KEYS.PHOTO_EDITOR]: 'canUsePhotoEditor',
    [FEATURE_KEYS.TEAM_MEMBERS]: 'canManageTeamMembers'
  }[featureKey];

  return Boolean(
    snapshot?.entitlements?.[featureKey]
    ?? snapshot?.featureOverrides?.[featureKey]
    ?? (accessKey ? snapshot?.access?.[accessKey] : false)
    ?? false
  );
}

function getBillingStatusLabel(status) {
  return BILLING_STATUS_LABELS[status] || status || 'Unknown';
}

function formatInterval(value) {
  const labels = {
    monthly: 'Monthly',
    trial: 'Trial',
    yearly: 'Yearly'
  };
  return labels[value] || '';
}

function toBoolean(value) {
  return value === true || value === 'true' || value === 1 || value === '1';
}

function getFirstValue(source, keys) {
  for (const key of keys) {
    if (source && source[key]) {
      return source[key];
    }
  }
  return '';
}
