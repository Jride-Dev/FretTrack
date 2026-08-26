import { formatShopDate } from '../../shared/utils/dateFormat';
import {
  getBillingStatusLabel,
  getPremiumFeatureAvailability,
  normalizeEntitlementSnapshot
} from '../billing/entitlementService';
import { getPlanStatus } from '../billing/planStatus';
import {
  formatStorageBytes,
  getUsagePercentage,
  getUsageWarningLevel,
  resolveUsageResetDate
} from '../billing/usageCaps';

export default function SubscriptionSettingsSection({ entitlementSnapshot = null, shopProfile = null }) {
  const snapshot = normalizeEntitlementSnapshot(entitlementSnapshot || {
    shopId: shopProfile?.shopId || '',
    subscription: {
      tier: shopProfile?.subscriptionTier || 'free',
      status: shopProfile?.subscriptionStatus || 'active',
      effectiveStatus: shopProfile?.subscriptionStatus || 'active',
      trialEndsAt: shopProfile?.trialEndsAt || ''
    },
    featureOverrides: shopProfile?.featureOverrides || {},
    entitlements: shopProfile?.featureOverrides || {}
  }, shopProfile?.shopId || '');
  const subscription = snapshot.subscription || {};
  const planStatus = getPlanStatus(snapshot);
  const featureAvailability = getPremiumFeatureAvailability(snapshot);
  const premiumTierLabels = [...new Set(featureAvailability.map((feature) => feature.tierLabel))];
  const lockedPremiumFeatures = featureAvailability.filter((feature) => !feature.enabled);
  const enabledOverrides = Object.entries(shopProfile?.featureOverrides || snapshot.featureOverrides || {})
    .filter(([, value]) => value === true);

  return (
    <section className="subscription-settings">
      <div className="section-header compact">
        <div>
          <h3>Plan / Subscription</h3>
          <p className="muted-text">Review your current plan, trial status, and available premium features.</p>
        </div>
        <span className={`plan-badge ${planStatus.badgeTone}`}>{planStatus.planLabel}</span>
      </div>

      <div className="billing-summary-grid">
        <SubscriptionCard label="Current Plan" value={planStatus.currentPlanLabel} detail={planStatus.planLabel} />
        <SubscriptionCard label="Billing Interval" value={formatInterval(planStatus.billingInterval)} />
        <SubscriptionCard label="Subscription Status" value={getBillingStatusLabel(planStatus.status || subscription.effectiveStatus || subscription.status)} />
        <SubscriptionCard label="Trial End" value={formatDate(planStatus.trialEndsAt)} />
        <SubscriptionCard label="Current Period End" value={formatDate(planStatus.currentPeriodEnd)} />
        <SubscriptionCard label="Countdown" value={planStatus.countdownLabel} detail={planStatus.inactiveActionLabel} />
        <SubscriptionCard label="Advanced Reporting" value={planStatus.hasAdvancedReporting ? 'Available' : 'Locked'} detail="Pro feature" />
        <SubscriptionCard label="Locked Premium Features" value={String(lockedPremiumFeatures.length)} />
        <SubscriptionCard label="Support Unlocks" value={String(enabledOverrides.length)} />
      </div>

      <div className="billing-placeholder subscription-billing-actions">
        <h4>Billing Management</h4>
        <p className="muted-text">Open Billing from the main navigation to choose Shop or Pro, start Stripe Checkout, update payment details, view invoices, or cancel at the end of the current paid period.</p>
      </div>

      <UsageSection usage={snapshot.usage || {}} />

      <div className="subscription-feature-groups">
        {premiumTierLabels.map((tierLabel) => (
          <div className="subscription-feature-group" key={tierLabel}>
            <h4>{tierLabel}</h4>
            <ul>
              {featureAvailability
                .filter((feature) => feature.tierLabel === tierLabel)
                .map((feature) => (
                  <li key={feature.key}>
                    <span>{feature.label}</span>
                    <strong className={feature.enabled ? 'feature-enabled' : 'feature-disabled'}>
                      {feature.enabled ? 'Available' : 'Locked'}
                    </strong>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

function UsageSection({ usage }) {
  const resetDate = resolveUsageResetDate(usage);
  const items = [
    {
      label: 'Emails this month',
      used: Number(usage.emailRecipientsUsed || 0),
      limit: Number(usage.monthlyEmailLimit || 0),
      format: (value) => String(value),
      detail: resetDate ? `Resets ${formatDate(resetDate)} (UTC)` : 'Resets monthly (UTC)'
    },
    {
      label: 'Photo uploads this month',
      used: Number(usage.sourcePhotosUploaded || 0),
      limit: Number(usage.monthlyPhotoUploadLimit || 0),
      format: (value) => String(value),
      detail: resetDate ? `Resets ${formatDate(resetDate)} (UTC)` : 'Resets monthly (UTC)'
    },
    {
      label: 'Photo storage',
      used: Number(usage.photoStorageBytes || 0),
      limit: Number(usage.maxPhotoStorageBytes || 0),
      format: formatStorageBytes,
      detail: 'Current stored originals and generated derivatives'
    }
  ];

  return (
    <section className="usage-settings" aria-labelledby="shop-usage-heading">
      <div>
        <h4 id="shop-usage-heading">Usage</h4>
        <p className="muted-text">Limits block only new email or photo activity; existing records and photos remain available.</p>
      </div>
      <div className="usage-meter-grid">
        {items.map((item) => {
          const remaining = Math.max(0, item.limit - item.used);
          const percentage = getUsagePercentage(item.used, item.limit);
          const warningLevel = getUsageWarningLevel(item.used, item.limit);
          return (
            <article className={`usage-meter usage-meter-${warningLevel}`} key={item.label}>
              <div className="usage-meter-heading">
                <strong>{item.label}</strong>
                <span>{warningLevelLabel(warningLevel)}</span>
              </div>
              <p>{item.format(item.used)} used of {item.format(item.limit)} · {item.format(remaining)} remaining</p>
              <div
                className="usage-progress"
                role="progressbar"
                aria-label={`${item.label}: ${Math.round(percentage)} percent used`}
                aria-valuemin="0"
                aria-valuemax="100"
                aria-valuenow={Math.round(percentage)}
              >
                <span style={{ width: `${percentage}%` }} />
              </div>
              <small>{item.detail}</small>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function warningLevelLabel(level) {
  const labels = {
    normal: 'Available',
    warning: '80% warning',
    critical: '95% critical warning',
    'limit-reached': 'Limit reached'
  };
  return labels[level] || 'Available';
}

function SubscriptionCard({ detail = '', label, value }) {
  return (
    <div className="billing-card">
      <span>{label}</span>
      <strong>{value || '-'}</strong>
      {detail && <small>{detail}</small>}
    </div>
  );
}

function formatDate(value) {
  if (!value) {
    return '-';
  }

  return formatShopDate(value, undefined) || '-';
}

function formatInterval(value) {
  const labels = {
    monthly: 'Monthly',
    trial: 'Trial',
    yearly: 'Yearly'
  };
  return labels[value] || '-';
}
