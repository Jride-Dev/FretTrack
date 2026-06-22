import { formatShopDate } from '../../shared/utils/dateFormat';
import {
  getBillingStatusLabel,
  getPremiumFeatureAvailability,
  normalizeEntitlementSnapshot
} from '../billing/entitlementService';
import { getPlanStatus } from '../billing/planStatus';

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
          <p className="muted-text">Beta access and premium trials are separate. Billing, payment collection, and Stripe are not connected.</p>
        </div>
        <span className={`plan-badge ${planStatus.badgeTone}`}>{planStatus.planLabel}</span>
      </div>

      <div className="billing-summary-grid">
        <SubscriptionCard label="Current Plan" value={planStatus.currentPlanLabel} detail={planStatus.planLabel} />
        <SubscriptionCard label="Billing Interval" value={formatInterval(planStatus.billingInterval)} />
        <SubscriptionCard label="Subscription Status" value={getBillingStatusLabel(planStatus.status || subscription.effectiveStatus || subscription.status)} detail={`Stored: ${getBillingStatusLabel(subscription.status)}`} />
        <SubscriptionCard label="Trial End" value={formatDate(planStatus.trialEndsAt)} />
        <SubscriptionCard label="Current Period End" value={formatDate(planStatus.currentPeriodEnd)} />
        <SubscriptionCard label="Countdown" value={planStatus.countdownLabel} detail={planStatus.inactiveActionLabel} />
        <SubscriptionCard label="Advanced Reporting" value={planStatus.hasAdvancedReporting ? 'Yes' : 'No'} detail="Pro feature" />
        <SubscriptionCard label="Locked Premium Features" value={String(lockedPremiumFeatures.length)} />
        <SubscriptionCard label="Feature Overrides" value={String(enabledOverrides.length)} />
      </div>

      <div className="billing-placeholder subscription-billing-actions">
        <h4>Billing Management</h4>
        <p className="muted-text">Billing management is being prepared for paid beta. Stripe Checkout, Customer Portal, and webhooks are not connected yet.</p>
        <div className="mode-actions">
          <button type="button" disabled>Manage billing</button>
          <button type="button" disabled>Upgrade plan</button>
        </div>
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
