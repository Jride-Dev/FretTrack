import { formatShopDate } from '../../shared/utils/dateFormat';
import {
  getPremiumFeatureAvailability,
  getSubscriptionTierLabel,
  normalizeEntitlementSnapshot
} from '../billing/entitlementService';

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
  const featureAvailability = getPremiumFeatureAvailability(snapshot);
  const premiumTierLabels = [...new Set(featureAvailability.map((feature) => feature.tierLabel))];
  const lockedPremiumFeatures = featureAvailability.filter((feature) => !feature.enabled);
  const enabledOverrides = Object.entries(shopProfile?.featureOverrides || snapshot.featureOverrides || {})
    .filter(([, value]) => value === true);

  return (
    <section className="subscription-settings">
      <div className="section-header compact">
        <div>
          <h3>Subscription & Feature Access</h3>
          <p className="muted-text">Beta access and premium trials are separate. Billing, payment collection, and Stripe are not connected.</p>
        </div>
      </div>

      <div className="billing-summary-grid">
        <SubscriptionCard label="Current Tier" value={getSubscriptionTierLabel(subscription.tier || snapshot.plan?.id)} />
        <SubscriptionCard label="Trial Status" value={subscription.effectiveStatus || subscription.status || 'active'} />
        <SubscriptionCard label="Trial Ends" value={formatDate(subscription.trialEndsAt)} />
        <SubscriptionCard label="Days Remaining" value={formatDaysRemaining(subscription.trialEndsAt)} />
        <SubscriptionCard label="Effective Tier" value={getSubscriptionTierLabel(subscription.effectiveTier || subscription.tier || snapshot.plan?.id)} />
        <SubscriptionCard label="Locked Premium Features" value={String(lockedPremiumFeatures.length)} />
        <SubscriptionCard label="Feature Overrides" value={String(enabledOverrides.length)} />
      </div>

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

function SubscriptionCard({ label, value }) {
  return (
    <div className="billing-card">
      <span>{label}</span>
      <strong>{value || '-'}</strong>
    </div>
  );
}

function formatDate(value) {
  if (!value) {
    return '-';
  }

  return formatShopDate(value, undefined) || '-';
}

function formatDaysRemaining(value) {
  if (!value) {
    return '-';
  }

  const end = new Date(value).getTime();
  if (!Number.isFinite(end)) {
    return '-';
  }

  const days = Math.ceil((end - Date.now()) / 86400000);
  if (days <= 0) {
    return 'Expired';
  }

  return `${days} day${days === 1 ? '' : 's'}`;
}
