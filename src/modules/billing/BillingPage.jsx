import { formatShopDate } from '../../shared/utils/dateFormat';
import {
  formatStorage,
  getBillingStatusLabel,
  getEnabledFeatureLabels,
  getEntitlement
} from './entitlementService';
import { getPlanStatus } from './planStatus';

export default function BillingPage({ canManageShop = false, entitlementSnapshot, shopProfile = null }) {
  if (!canManageShop) {
    return (
      <section className="panel billing-page">
        <h2>Billing</h2>
        <p className="muted-text">Only shop owners and admins can view billing details.</p>
      </section>
    );
  }

  const snapshot = entitlementSnapshot || {};
  const subscription = snapshot.subscription || {};
  const usage = snapshot.usage || {};
  const plan = snapshot.plan || {};
  const enabledFeatures = getEnabledFeatureLabels(snapshot);
  const storageLimit = Number(getEntitlement(snapshot, 'max_storage_bytes', 0)) || 0;
  const userLimit = Number(getEntitlement(snapshot, 'max_users', 0)) || 0;
  const planStatus = getPlanStatus(snapshot);

  return (
    <section className="panel billing-page">
      <div className="panel-heading">
        <div>
          <h2>Billing</h2>
          <p className="muted-text">Paid tier controls are being prepared. Stripe is not connected yet.</p>
        </div>
        <span className={`plan-badge ${planStatus.badgeTone}`}>{planStatus.planLabel}</span>
      </div>

      <div className="billing-summary-grid">
        <BillingCard label="Current Plan" value={planStatus.currentPlanLabel} detail={planStatus.planLabel || plan.id || subscription.tier || 'trial'} />
        <BillingCard label="Billing Interval" value={formatInterval(planStatus.billingInterval)} />
        <BillingCard label="Status" value={getBillingStatusLabel(planStatus.status || subscription.effectiveStatus || subscription.status)} detail={`Stored: ${getBillingStatusLabel(subscription.status)}`} />
        <BillingCard label="Trial Ends" value={formatDate(planStatus.trialEndsAt || subscription.trialEndsAt)} />
        <BillingCard label="Current Period End" value={formatDate(planStatus.currentPeriodEnd)} />
        <BillingCard label="Countdown" value={planStatus.countdownLabel} detail={planStatus.inactiveActionLabel} />
        <BillingCard label="Grace Ends" value={formatDate(subscription.graceEndsAt)} />
        <BillingCard label="Billing Email" value={subscription.billingEmail || shopProfile?.email || '-'} />
        <BillingCard label="Users" value={`${usage.userCount || 0}${userLimit ? ` / ${userLimit}` : ''}`} />
        <BillingCard label="Storage" value={`${formatStorage(usage.storageBytes)}${storageLimit ? ` / ${formatStorage(storageLimit)}` : ''}`} />
        <BillingCard label="Jobs" value={String(usage.jobCount || 0)} />
      </div>

      <section className="billing-feature-list">
        <h3>Enabled Features</h3>
        {enabledFeatures.length ? (
          <div className="billing-chips">
            {enabledFeatures.map((feature) => <span key={feature}>{feature}</span>)}
          </div>
        ) : (
          <p className="muted-text">No enabled features were returned for this shop.</p>
        )}
      </section>

      <section className="billing-placeholder">
        <h3>Upgrade / Contact Support</h3>
        <p>Upgrade and billing portal actions will be added after the access rules, trial states, and entitlement checks are stable.</p>
        <a href="mailto:support@frettrack-app.com">Contact support@frettrack-app.com</a>
      </section>
    </section>
  );
}

function BillingCard({ label, value, detail = '' }) {
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
