export const FRETTRACK_LEGAL_SELLER = 'Jeffrey Russell d/b/a Torrance Guitar Repair';
export const FRETTRACK_STANDARD_TRIAL_DAYS = 14;

export const FRETTRACK_PLANS = Object.freeze({
  shop: Object.freeze({
    id: 'shop',
    name: 'Shop',
    monthlyCents: 2_999,
    yearlyCents: 29_999,
    annualSavingsCents: 5_989
  }),
  pro: Object.freeze({
    id: 'pro',
    name: 'Pro',
    monthlyCents: 3_999,
    yearlyCents: 39_999,
    annualSavingsCents: 7_989
  })
});

export const FRETTRACK_SUBSCRIPTION_POLICY = Object.freeze({
  businessUseOnly: true,
  trialAutoConverts: false,
  cancellationEffectiveAtPeriodEnd: true,
  firstAnnualPurchaseRefundDays: 14,
  monthlyAndRenewalPaymentsRefundable: false,
  annualRenewalNoticeDays: 30
});

export function formatUsd(cents) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(Number(cents || 0) / 100);
}

export function getPlanPrice(planId, interval = 'monthly') {
  const plan = FRETTRACK_PLANS[String(planId || '').toLowerCase()];
  if (!plan) return null;
  return interval === 'yearly' ? plan.yearlyCents : plan.monthlyCents;
}
