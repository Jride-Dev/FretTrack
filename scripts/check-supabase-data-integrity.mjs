import { execFileSync } from 'node:child_process';

const local = process.argv.includes('--local');
const linked = process.argv.includes('--linked') || !local;

const targetFlag = linked ? '--linked' : '--local';

const integritySql = `
with job_orphans as (
  select 'beta_feedback' as table_name, count(*)::bigint as orphan_count from public.beta_feedback t left join public.jobs j on j.id = t.job_id where t.job_id is not null and j.id is null
  union all select 'custody_events', count(*)::bigint from public.custody_events t left join public.jobs j on j.id = t.job_id where t.job_id is not null and j.id is null
  union all select 'customer_messages', count(*)::bigint from public.customer_messages t left join public.jobs j on j.id = t.job_id where t.job_id is not null and j.id is null
  union all select 'job_events', count(*)::bigint from public.job_events t left join public.jobs j on j.id = t.job_id where t.job_id is not null and j.id is null
  union all select 'job_images', count(*)::bigint from public.job_images t left join public.jobs j on j.id = t.job_id where t.job_id is not null and j.id is null
  union all select 'job_parts', count(*)::bigint from public.job_parts t left join public.jobs j on j.id = t.job_id where t.job_id is not null and j.id is null
  union all select 'job_services', count(*)::bigint from public.job_services t left join public.jobs j on j.id = t.job_id where t.job_id is not null and j.id is null
  union all select 'job_shipments', count(*)::bigint from public.job_shipments t left join public.jobs j on j.id = t.job_id where t.job_id is not null and j.id is null
  union all select 'part_movements', count(*)::bigint from public.part_movements t left join public.jobs j on j.id = t.job_id where t.job_id is not null and j.id is null
  union all select 'photo_derivatives', count(*)::bigint from public.photo_derivatives t left join public.jobs j on j.id = t.job_id where t.job_id is not null and j.id is null
  union all select 'schedule_events', count(*)::bigint from public.schedule_events t left join public.jobs j on j.id = t.job_id where t.job_id is not null and j.id is null
  union all select 'shipping_items', count(*)::bigint from public.shipping_items t left join public.jobs j on j.id = t.job_id where t.job_id is not null and j.id is null
  union all select 'work_logs', count(*)::bigint from public.work_logs t left join public.jobs j on j.id = t.job_id where t.job_id is not null and j.id is null
),
ownerless_shop_inputs as (
  select
    'production'::text as source,
    sp.shop_id as case_id,
    sp.shop_name,
    (ss.shop_id is not null) as has_subscription,
    ss.status as subscription_status,
    ss.stripe_customer_id,
    ss.stripe_subscription_id,
    null::boolean as expected_issue
  from public.shop_profiles sp
  left join public.shop_members sm on sm.shop_id = sp.shop_id and sm.role = 'owner'
  left join public.shop_subscriptions ss on ss.shop_id = sp.shop_id
  where sm.id is null

  union all

  select
    'self_test'::text,
    test_case,
    test_case,
    has_subscription,
    subscription_status,
    stripe_customer_id,
    stripe_subscription_id,
    expected_issue
  from (values
    ('canceled_without_billing', true, 'canceled', null::text, null::text, false),
    ('cancelled_with_empty_billing', true, 'cancelled', '', '   ', false),
    ('canceled_with_customer_id', true, 'canceled', 'cus_fixture', null::text, true),
    ('canceled_with_subscription_id', true, 'canceled', null::text, 'sub_fixture', true),
    ('active_without_billing', true, 'active', null::text, null::text, true),
    ('missing_subscription', false, null::text, null::text, null::text, true)
  ) as cases(
    test_case,
    has_subscription,
    subscription_status,
    stripe_customer_id,
    stripe_subscription_id,
    expected_issue
  )
),
ownerless_shop_classification as (
  select
    *,
    not (
      has_subscription
      and coalesce(subscription_status, '') in ('canceled', 'cancelled')
      and nullif(trim(coalesce(stripe_customer_id, '')), '') is null
      and nullif(trim(coalesce(stripe_subscription_id, '')), '') is null
    ) as is_operational_issue
  from ownerless_shop_inputs
),
integrity_checks as (
  select
    'job_orphan_rows' as check_name,
    coalesce(sum(orphan_count), 0)::bigint as issue_count,
    coalesce(jsonb_object_agg(table_name, orphan_count order by table_name), '{}'::jsonb) as details
  from job_orphans
  union all
  select
    'operational_shop_profiles_without_owner_member',
    count(*)::bigint,
    coalesce(jsonb_agg(jsonb_build_object(
      'shop_id', case_id,
      'shop_name', shop_name,
      'subscription_status', subscription_status,
      'has_stripe_customer', nullif(trim(coalesce(stripe_customer_id, '')), '') is not null,
      'has_stripe_subscription', nullif(trim(coalesce(stripe_subscription_id, '')), '') is not null
    ) order by case_id), '[]'::jsonb)
  from ownerless_shop_classification
  where source = 'production'
    and is_operational_issue
  union all
  select
    'ownerless_shop_classification_rule',
    count(*)::bigint,
    coalesce(jsonb_agg(jsonb_build_object(
      'case', case_id,
      'expected_issue', expected_issue,
      'actual_issue', is_operational_issue
    ) order by case_id), '[]'::jsonb)
  from ownerless_shop_classification
  where source = 'self_test'
    and is_operational_issue is distinct from expected_issue
  union all
  select
    'shop_members_without_auth_user',
    count(*)::bigint,
    coalesce(jsonb_agg(jsonb_build_object('shop_id', sm.shop_id, 'member_id', sm.id, 'role', sm.role) order by sm.shop_id, sm.id), '[]'::jsonb)
  from public.shop_members sm
  left join auth.users u on u.id = sm.user_id
  where sm.user_id is not null and u.id is null
  union all
  select
    'auth_users_without_identity',
    count(*)::bigint,
    coalesce(jsonb_agg(jsonb_build_object('user_id', u.id) order by u.id), '[]'::jsonb)
  from auth.users u
  left join auth.identities i on i.user_id = u.id
  where i.user_id is null
)
select jsonb_pretty(jsonb_agg(jsonb_build_object(
  'check', check_name,
  'issue_count', issue_count,
  'details', details
) order by check_name)) as report
from integrity_checks;
`;

function runSupabaseQuery(sql) {
  return execFileSync('supabase', ['db', 'query', targetFlag, '-o', 'json', sql], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 45000
  });
}

function parseJsonEnvelope(output) {
  const trimmed = output.trim();
  const jsonStart = trimmed.search(/[\[{]/);
  if (jsonStart === -1) {
    throw new Error(`Supabase query did not return JSON output.\n\n${output}`);
  }

  let inString = false;
  let escaped = false;
  let depth = 0;

  for (let index = jsonStart; index < trimmed.length; index += 1) {
    const character = trimmed[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (character === '\\') {
        escaped = true;
      } else if (character === '"') {
        inString = false;
      }
      continue;
    }

    if (character === '"') {
      inString = true;
      continue;
    }

    if (character === '{' || character === '[') {
      depth += 1;
      continue;
    }

    if (character === '}' || character === ']') {
      depth -= 1;
      if (depth === 0) {
        return JSON.parse(trimmed.slice(jsonStart, index + 1));
      }
    }
  }

  throw new Error(`Supabase query returned incomplete JSON output.\n\n${output}`);
}

let envelope;
try {
  envelope = parseJsonEnvelope(runSupabaseQuery(integritySql));
} catch (error) {
  const output = [error.stdout, error.stderr].filter(Boolean).join('\n').trim();
  console.error(output || error.message);
  console.error(`\nUnable to run read-only Supabase data integrity checks against ${linked ? 'the linked project' : 'local Supabase'}.`);
  process.exit(1);
}

const rows = envelope?.rows || envelope?.data || envelope;
const reportText = Array.isArray(rows) ? rows[0]?.report : rows?.[0]?.report || rows?.report;
if (!reportText) {
  console.error('Supabase data integrity query returned no report payload.');
  process.exit(1);
}

const report = JSON.parse(reportText);
const failed = report.filter((row) => Number(row.issue_count) > 0);

if (failed.length) {
  console.error(`Supabase data integrity checks found ${failed.length} issue group(s) against ${linked ? 'the linked project' : 'local Supabase'}:`);
  for (const row of failed) {
    console.error(`- ${row.check}: ${row.issue_count}`);
    console.error(JSON.stringify(row.details, null, 2));
  }
  process.exit(1);
}

console.log(`Supabase data integrity checks passed against ${linked ? 'the linked project' : 'local Supabase'}.`);
