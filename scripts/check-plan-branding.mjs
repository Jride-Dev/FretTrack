import assert from 'node:assert/strict';
import {
  DEFAULT_EMBLEM_SRC,
  PRO_EMBLEM_SRC,
  getPlanStatus,
  getPlanVersionText
} from '../src/modules/billing/planStatus.js';

function dateInDays(days) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function makeSnapshot({
  cancelAtPeriodEnd = false,
  currentPeriodEnd = '',
  entitlements = {},
  interval = '',
  status = 'active',
  tier = 'shop',
  trialEndsAt = ''
}) {
  return {
    subscription: {
      billingInterval: interval,
      cancelAtPeriodEnd,
      currentPeriodEnd,
      effectiveStatus: status,
      effectiveTier: tier,
      status,
      tier,
      trialEndsAt
    },
    entitlements
  };
}

const cases = [
  {
    name: 'Trial Shop',
    snapshot: makeSnapshot({
      status: 'trialing',
      tier: 'shop',
      trialEndsAt: dateInDays(7),
      entitlements: {
        photo_editor: true,
        team_members: true
      }
    }),
    expected: {
      badgeTone: 'trial',
      countdownLabel: 'Trial ends in 7 days',
      effectivePlan: 'shop',
      emblem: 'standard',
      emblemSrc: DEFAULT_EMBLEM_SRC,
      hasAdvancedReporting: false,
      hasProBranding: false,
      headerLabel: 'FretTrack Shop',
      planLabel: 'Trial: Shop'
    }
  },
  {
    name: 'Trial Pro',
    snapshot: makeSnapshot({
      status: 'trialing',
      tier: 'pro',
      trialEndsAt: dateInDays(6),
      entitlements: {
        advanced_reporting: true,
        photo_editor: true,
        team_members: true
      }
    }),
    expected: {
      badgeTone: 'pro',
      countdownLabel: 'Trial ends in 6 days',
      effectivePlan: 'pro',
      emblem: 'pro',
      emblemSrc: PRO_EMBLEM_SRC,
      hasAdvancedReporting: true,
      hasProBranding: true,
      headerLabel: 'FretTrack Pro',
      planLabel: 'Trial: Pro'
    }
  },
  {
    name: 'Shop Monthly',
    snapshot: makeSnapshot({
      currentPeriodEnd: dateInDays(18),
      interval: 'monthly',
      status: 'active',
      tier: 'shop',
      entitlements: {
        photo_editor: true,
        team_members: true
      }
    }),
    expected: {
      countdownLabel: 'Renews in 18 days',
      effectivePlan: 'shop',
      emblem: 'standard',
      hasAdvancedReporting: false,
      hasProBranding: false,
      headerLabel: 'FretTrack Shop',
      planLabel: 'Shop Monthly'
    }
  },
  {
    name: 'Shop Yearly',
    snapshot: makeSnapshot({
      currentPeriodEnd: dateInDays(342),
      interval: 'yearly',
      status: 'active',
      tier: 'shop',
      entitlements: {
        photo_editor: true,
        team_members: true
      }
    }),
    expected: {
      countdownLabel: 'Renews in 342 days',
      effectivePlan: 'shop',
      emblem: 'standard',
      hasAdvancedReporting: false,
      hasProBranding: false,
      headerLabel: 'FretTrack Shop',
      planLabel: 'Shop Yearly'
    }
  },
  {
    name: 'Pro Monthly',
    snapshot: makeSnapshot({
      currentPeriodEnd: dateInDays(24),
      interval: 'monthly',
      status: 'active',
      tier: 'pro',
      entitlements: {
        advanced_reporting: true,
        photo_editor: true,
        team_members: true
      }
    }),
    expected: {
      countdownLabel: 'Renews in 24 days',
      effectivePlan: 'pro',
      emblem: 'pro',
      emblemSrc: PRO_EMBLEM_SRC,
      hasAdvancedReporting: true,
      hasProBranding: true,
      headerLabel: 'FretTrack Pro',
      planLabel: 'Pro Monthly'
    },
    expectedVersionText: 'v0.2.9 beta | Pro Monthly | Renews in 24 days'
  },
  {
    name: 'Pro Yearly',
    snapshot: makeSnapshot({
      currentPeriodEnd: dateInDays(342),
      interval: 'yearly',
      status: 'active',
      tier: 'pro',
      entitlements: {
        advanced_reporting: true,
        photo_editor: true,
        team_members: true
      }
    }),
    expected: {
      countdownLabel: 'Renews in 342 days',
      effectivePlan: 'pro',
      emblem: 'pro',
      emblemSrc: PRO_EMBLEM_SRC,
      hasAdvancedReporting: true,
      hasProBranding: true,
      headerLabel: 'FretTrack Pro',
      planLabel: 'Pro Yearly'
    }
  },
  {
    name: 'Canceled Pro, access still active',
    snapshot: makeSnapshot({
      cancelAtPeriodEnd: true,
      currentPeriodEnd: dateInDays(12),
      interval: 'monthly',
      status: 'active',
      tier: 'pro',
      entitlements: {
        advanced_reporting: true,
        photo_editor: true,
        team_members: true
      }
    }),
    expected: {
      countdownLabel: 'Access ends in 12 days',
      effectivePlan: 'pro',
      emblem: 'pro',
      emblemSrc: PRO_EMBLEM_SRC,
      hasAdvancedReporting: true,
      hasProBranding: true,
      headerLabel: 'FretTrack Pro',
      planLabel: 'Pro, canceling'
    }
  },
  {
    name: 'Expired',
    snapshot: makeSnapshot({
      currentPeriodEnd: dateInDays(-1),
      interval: 'monthly',
      status: 'expired',
      tier: 'pro',
      entitlements: {
        advanced_reporting: true,
        photo_editor: true,
        team_members: true
      }
    }),
    expected: {
      countdownLabel: 'Upgrade or renew to continue paid features',
      effectivePlan: 'expired',
      emblem: 'standard',
      emblemSrc: DEFAULT_EMBLEM_SRC,
      hasAdvancedReporting: false,
      hasProBranding: false,
      headerLabel: 'FretTrack',
      planLabel: 'Expired'
    }
  }
];

for (const testCase of cases) {
  const planStatus = getPlanStatus(testCase.snapshot);

  for (const [key, expectedValue] of Object.entries(testCase.expected)) {
    assert.equal(planStatus[key], expectedValue, `${testCase.name}: ${key}`);
  }

  if (planStatus.effectivePlan === 'pro') {
    assert.notEqual(planStatus.headerLabel, 'FretTrack Shop', `${testCase.name}: Pro must not use Shop header branding`);
    assert.notEqual(planStatus.emblemSrc, DEFAULT_EMBLEM_SRC, `${testCase.name}: Pro must not use the standard emblem`);
    assert.ok(!planStatus.planLabel.includes('Shop'), `${testCase.name}: Pro plan label must not include Shop`);
  }

  if (testCase.expectedVersionText) {
    assert.equal(getPlanVersionText('0.2.9 beta', planStatus), testCase.expectedVersionText);
  }
}

console.log(`Plan branding checks passed for ${cases.length} states.`);
