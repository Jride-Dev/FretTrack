import { hasSupabaseConfig, supabase } from '../../shared/lib/supabaseClient.js';

export const DEFAULT_LOYALTY_RULE = {
  shopId: '',
  enabled: false,
  pointsPerPaidJob: 1,
  rewardThreshold: 5,
  rewardName: 'Loyalty reward',
  terms: 'Reward redemption is recorded in FretTrack. Apply any invoice discount separately.',
  updatedAt: ''
};

function fromDbRule(row = {}) {
  return {
    ...DEFAULT_LOYALTY_RULE,
    shopId: row.shop_id || '',
    enabled: row.enabled === true,
    programStartedAt: row.program_started_at || '',
    pointsPerPaidJob: Number(row.points_per_paid_job || 1),
    rewardThreshold: Number(row.reward_threshold || 5),
    rewardName: row.reward_name || DEFAULT_LOYALTY_RULE.rewardName,
    terms: row.terms || DEFAULT_LOYALTY_RULE.terms,
    updatedAt: row.updated_at || ''
  };
}

export async function getLoyaltyRule(shopId) {
  if (!hasSupabaseConfig || !supabase || !shopId) return { ...DEFAULT_LOYALTY_RULE, shopId };
  const { data, error } = await supabase.from('loyalty_program_rules').select('*').eq('shop_id', shopId).maybeSingle();
  if (error) throw error;
  return fromDbRule(data || { shop_id: shopId });
}

export async function saveLoyaltyRule(shopId, rule) {
  if (!hasSupabaseConfig || !supabase) throw new Error('The Loyalty Program requires the live Supabase-backed app.');
  const payload = {
    shop_id: shopId,
    enabled: rule.enabled === true,
    points_per_paid_job: Math.min(10, Math.max(1, Number(rule.pointsPerPaidJob || 1))),
    reward_threshold: Math.min(100, Math.max(2, Number(rule.rewardThreshold || 5))),
    reward_name: String(rule.rewardName || '').trim(),
    terms: String(rule.terms || '').trim()
  };
  if (!payload.reward_name) throw new Error('Add a name for the loyalty reward.');
  const { data, error } = await supabase.from('loyalty_program_rules')
    .upsert(payload, { onConflict: 'shop_id' }).select().single();
  if (error) throw error;
  const { error: rebuildError } = await supabase.rpc('rebuild_loyalty_program', { target_shop_id: shopId });
  if (rebuildError) throw rebuildError;
  return fromDbRule(data);
}

export async function getCustomerLoyalty(customerId) {
  if (!hasSupabaseConfig || !supabase || !customerId) return null;
  const [{ data: summaryRows, error: summaryError }, { data: awards, error: awardsError }, { data: redemptions, error: redemptionsError }] = await Promise.all([
    supabase.rpc('get_customer_loyalty_summary', { target_customer_id: customerId }),
    supabase.from('loyalty_job_awards').select('id,source_job_id,points,active,qualified_at,reversed_at,reversal_reason').eq('customer_id', customerId).order('qualified_at', { ascending: false }).limit(20),
    supabase.from('loyalty_redemptions').select('id,source_job_id,points_spent,reward_name_snapshot,note,created_at').eq('customer_id', customerId).order('created_at', { ascending: false }).limit(20)
  ]);
  if (summaryError) throw summaryError;
  if (awardsError) throw awardsError;
  if (redemptionsError) throw redemptionsError;
  const summary = summaryRows?.[0] || {};
  return {
    earnedPoints: Number(summary.earned_points || 0),
    redeemedPoints: Number(summary.redeemed_points || 0),
    availablePoints: Number(summary.available_points || 0),
    rewardThreshold: Number(summary.reward_threshold || 5),
    availableRewards: Number(summary.available_rewards || 0),
    pointsToNextReward: Number(summary.points_to_next_reward || 0),
    rewardName: summary.reward_name || 'Loyalty reward',
    programEnabled: summary.program_enabled === true,
    awards: awards || [],
    redemptions: redemptions || []
  };
}

export async function redeemCustomerLoyaltyReward(customerId, { note = '', sourceJobId = null, idempotencyKey = crypto.randomUUID() } = {}) {
  if (!hasSupabaseConfig || !supabase) throw new Error('The Loyalty Program requires the live Supabase-backed app.');
  const { data, error } = await supabase.rpc('redeem_customer_loyalty_reward', {
    target_customer_id: customerId,
    target_idempotency_key: idempotencyKey,
    target_source_job_id: sourceJobId,
    target_note: String(note || '').trim()
  });
  if (error) throw error;
  return data;
}
