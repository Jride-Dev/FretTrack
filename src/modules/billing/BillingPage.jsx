import { useEffect, useState } from 'react';
import { formatShopDate } from '../../shared/utils/dateFormat';
import {
  formatStorage,
  getBillingStatusLabel,
  getEnabledFeatureLabels,
  getEntitlement
} from './entitlementService';
import { getPlanStatus } from './planStatus';
import {
  createBillingPortalSession,
  createCheckoutSession,
  getCheckoutAvailability
} from './stripeBillingService';
import {
  FRETTRACK_LEGAL_SELLER,
  FRETTRACK_PLANS,
  FRETTRACK_STANDARD_TRIAL_DAYS,
  FRETTRACK_SUBSCRIPTION_POLICY,
  formatUsd
} from './commercialTerms';

export default function BillingPage({ canManageShop = false, entitlementSnapshot, shopProfile = null }) {
  const [billingAction, setBillingAction] = useState('');
  const [billingError, setBillingError] = useState('');
  const [checkoutAvailability, setCheckoutAvailability] = useState({
    loading: true,
    enabled: false,
    message: 'Checking Stripe subscription availability…',
    pilotRestricted: false
  });

  const snapshot = entitlementSnapshot || {};
  const subscription = snapshot.subscription || {};
  const usage = snapshot.usage || {};
  const plan = snapshot.plan || {};
  const enabledFeatures = getEnabledFeatureLabels(snapshot);
  const storageLimit = Number(getEntitlement(snapshot, 'max_storage_bytes', 0)) || 0;
  const userLimit = Number(getEntitlement(snapshot, 'max_users', 0)) || 0;
  const planStatus = getPlanStatus(snapshot);
  const shopId = snapshot.shopId || shopProfile?.shop_id || shopProfile?.shopId || '';
  const hasStripeCustomer = Boolean(subscription.stripeCustomerId || subscription.stripe_customer_id);
  const stripeSubscriptionId = subscription.stripeSubscriptionId || subscription.stripe_subscription_id || '';
  const providerStatus = String(subscription.providerStatus || subscription.provider_status || subscription.status || '').toLowerCase();
  const hasManagedStripeSubscription = Boolean(stripeSubscriptionId) && !['canceled', 'cancelled', 'incomplete_expired'].includes(providerStatus);

  useEffect(() => {
    let active = true;
    if (!canManageShop || !shopId) {
      setCheckoutAvailability({ loading: false, enabled: false, message: 'Choose a shop before managing its subscription.', pilotRestricted: false });
      return () => { active = false; };
    }

    setCheckoutAvailability({ loading: true, enabled: false, message: 'Checking Stripe subscription availability…', pilotRestricted: false });
    getCheckoutAvailability({ shopId })
      .then((availability) => {
        if (active) setCheckoutAvailability({ loading: false, ...availability });
      })
      .catch(() => {
        if (active) {
          setCheckoutAvailability({
            loading: false,
            enabled: false,
            message: 'New subscriptions are temporarily unavailable. Existing subscribers can still manage billing.',
            pilotRestricted: false
          });
        }
      });

    return () => { active = false; };
  }, [canManageShop, shopId]);

  if (!canManageShop) {
    return (
      <section className="panel billing-page">
        <h2>Billing</h2>
        <p className="muted-text">Only shop owners and admins can view billing details.</p>
      </section>
    );
  }

  async function redirectToCheckout(plan, interval = 'monthly') {
    setBillingError('');
    setBillingAction(`${plan}-${interval}`);
    try {
      const url = await createCheckoutSession({ shopId, plan, interval });
      window.location.assign(url);
    } catch (error) {
      setBillingError(getErrorMessage(error));
      setBillingAction('');
    }
  }

  async function redirectToPortal() {
    setBillingError('');
    setBillingAction('portal');
    try {
      const url = await createBillingPortalSession({ shopId });
      window.location.assign(url);
    } catch (error) {
      setBillingError(getErrorMessage(error));
      setBillingAction('');
    }
  }

  return (
    <section className="panel billing-page">
      <div className="panel-heading">
        <div>
          <h2>Billing</h2>
          <p className="muted-text">Review your shop plan, account status, usage, and enabled features.</p>
        </div>
        <span className={`plan-badge ${planStatus.badgeTone}`}>{planStatus.planLabel}</span>
      </div>

      <div className="billing-summary-grid">
        <BillingCard label="Current Plan" value={planStatus.currentPlanLabel} detail={planStatus.planLabel || plan.id || subscription.tier || 'trial'} />
        <BillingCard label="Billing Interval" value={formatInterval(planStatus.billingInterval)} />
        <BillingCard label="Status" value={getBillingStatusLabel(planStatus.status || subscription.effectiveStatus || subscription.status)} />
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
          <p className="muted-text">No premium features are active for this shop.</p>
        )}
      </section>

      <section className="billing-self-serve">
        <h3>Manage Plan</h3>
        <p>Choose a Stripe-powered FretTrack plan or open the secure billing portal for payment, renewal, cancellation, and invoice settings.</p>
        <div className="billing-summary-grid" aria-label="FretTrack subscription prices">
          <BillingCard
            label="Shop"
            value={`${formatUsd(FRETTRACK_PLANS.shop.monthlyCents)} / month`}
            detail={`${formatUsd(FRETTRACK_PLANS.shop.yearlyCents)} yearly · save ${formatUsd(FRETTRACK_PLANS.shop.annualSavingsCents)}`}
          />
          <BillingCard
            label="Pro"
            value={`${formatUsd(FRETTRACK_PLANS.pro.monthlyCents)} / month`}
            detail={`${formatUsd(FRETTRACK_PLANS.pro.yearlyCents)} yearly · save ${formatUsd(FRETTRACK_PLANS.pro.annualSavingsCents)}`}
          />
        </div>
        <p className="muted-text">
          The standard {FRETTRACK_STANDARD_TRIAL_DAYS}-day Pro trial requires no card and does not automatically convert. Starting a paid plan begins its billing period immediately.
        </p>
        <p className="muted-text">
          Cancel anytime through the Billing Portal; paid access continues through the current billing period. The first annual subscription purchase may be refunded within {FRETTRACK_SUBSCRIPTION_POLICY.firstAnnualPurchaseRefundDays} days. Monthly payments and renewals are non-refundable except for billing errors or when required by law.
        </p>
        {billingError && <p className="error-text" role="alert">{billingError}</p>}
        {hasManagedStripeSubscription && (
          <p className="muted-text">This shop already has a Stripe subscription. Use the Billing Portal to change plans, update payment details, or cancel.</p>
        )}
        {!hasManagedStripeSubscription && (
          <p className={`billing-launch-status ${checkoutAvailability.enabled ? 'enabled' : ''}`} role="status">
            {checkoutAvailability.message}
          </p>
        )}
        <div className="billing-plan-actions">
          {!hasManagedStripeSubscription && <>
            <button type="button" className="primary" disabled={!shopId || Boolean(billingAction) || !checkoutAvailability.enabled} onClick={() => redirectToCheckout('shop', 'monthly')}>
              {billingAction === 'shop-monthly' ? 'Opening…' : `Start Shop · ${formatUsd(FRETTRACK_PLANS.shop.monthlyCents)}/month`}
            </button>
            <button type="button" disabled={!shopId || Boolean(billingAction) || !checkoutAvailability.enabled} onClick={() => redirectToCheckout('pro', 'monthly')}>
              {billingAction === 'pro-monthly' ? 'Opening…' : `Start Pro · ${formatUsd(FRETTRACK_PLANS.pro.monthlyCents)}/month`}
            </button>
            <button type="button" disabled={!shopId || Boolean(billingAction) || !checkoutAvailability.enabled} onClick={() => redirectToCheckout('shop', 'yearly')}>
              {billingAction === 'shop-yearly' ? 'Opening…' : `Start Shop · ${formatUsd(FRETTRACK_PLANS.shop.yearlyCents)}/year`}
            </button>
            <button type="button" disabled={!shopId || Boolean(billingAction) || !checkoutAvailability.enabled} onClick={() => redirectToCheckout('pro', 'yearly')}>
              {billingAction === 'pro-yearly' ? 'Opening…' : `Start Pro · ${formatUsd(FRETTRACK_PLANS.pro.yearlyCents)}/year`}
            </button>
          </>}
          <button type="button" disabled={!hasStripeCustomer || Boolean(billingAction)} onClick={redirectToPortal}>
            {billingAction === 'portal' ? 'Opening…' : 'Manage Billing Portal'}
          </button>
        </div>
        {!hasStripeCustomer && (
          <p className="muted-text">The Billing Portal appears after the shop has a connected Stripe customer.</p>
        )}
        <p className="muted-text">FretTrack is sold for business use by {FRETTRACK_LEGAL_SELLER}. Prices are USD; applicable taxes, if any, are determined from the billing information collected at Checkout.</p>
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

function getErrorMessage(error) {
  return error instanceof Error ? error.message : 'Unable to open Stripe billing.';
}
