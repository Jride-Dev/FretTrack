import { hasSupabaseConfig, supabase } from '../../shared/lib/supabaseClient.js';

export const DEFAULT_SERVICE_REMINDER_RULE = {
  shopId: '',
  enabled: false,
  intervalMonths: 6,
  eligibleServiceKeywords: ['setup'],
  subjectTemplate: 'Is it time for your next {{service_name}}?',
  bodyTemplate: 'Hi {{customer_first_name}},\n\nIt has been {{months}} months since your last {{service_name}} at {{shop_name}}. Would you like to book another appointment?\n\n{{booking_url}}',
  bookingUrl: '',
  updatedAt: ''
};

function fromDbRule(row = {}) {
  return {
    ...DEFAULT_SERVICE_REMINDER_RULE,
    shopId: row.shop_id || '',
    enabled: row.enabled === true,
    intervalMonths: Number(row.interval_months || 6),
    eligibleServiceKeywords: row.eligible_service_keywords || ['setup'],
    subjectTemplate: row.subject_template || DEFAULT_SERVICE_REMINDER_RULE.subjectTemplate,
    bodyTemplate: row.body_template || DEFAULT_SERVICE_REMINDER_RULE.bodyTemplate,
    bookingUrl: row.booking_url || '',
    updatedAt: row.updated_at || ''
  };
}

export async function getServiceReminderRule(shopId) {
  if (!hasSupabaseConfig || !supabase || !shopId) return { ...DEFAULT_SERVICE_REMINDER_RULE, shopId };
  const { data, error } = await supabase.from('service_reminder_rules').select('*').eq('shop_id', shopId).maybeSingle();
  if (error) throw error;
  return fromDbRule(data || { shop_id: shopId });
}

export async function saveServiceReminderRule(shopId, rule) {
  if (!hasSupabaseConfig || !supabase) throw new Error('Automated Service Reminders require the live Supabase-backed app.');
  const keywords = [...new Set((rule.eligibleServiceKeywords || []).map((value) => String(value || '').trim()).filter(Boolean))];
  if (!keywords.length) throw new Error('Add at least one eligible service keyword.');
  const { data, error } = await supabase.from('service_reminder_rules').upsert({
    shop_id: shopId,
    enabled: rule.enabled === true,
    interval_months: Math.min(60, Math.max(1, Number(rule.intervalMonths || 6))),
    eligible_service_keywords: keywords,
    subject_template: String(rule.subjectTemplate || '').trim(),
    body_template: String(rule.bodyTemplate || '').trim(),
    booking_url: String(rule.bookingUrl || '').trim()
  }, { onConflict: 'shop_id' }).select().single();
  if (error) throw error;
  const { error: rebuildError } = await supabase.rpc('rebuild_service_reminder_queue', { target_shop_id: shopId });
  if (rebuildError) throw rebuildError;
  return fromDbRule(data);
}

export async function listServiceReminderQueue(shopId, limit = 25) {
  if (!hasSupabaseConfig || !supabase || !shopId) return [];
  const { data, error } = await supabase
    .from('service_reminder_queue')
    .select('id,customer_id,source_job_id,service_name,due_at,status,attempt_count,error_message,sent_at')
    .eq('shop_id', shopId)
    .order('due_at', { ascending: true })
    .limit(limit);
  if (error) throw error;
  return (data || []).map((row) => ({
    id: row.id,
    customerId: row.customer_id,
    sourceJobId: row.source_job_id,
    serviceName: row.service_name,
    dueAt: row.due_at,
    status: row.status,
    attemptCount: Number(row.attempt_count || 0),
    errorMessage: row.error_message || '',
    sentAt: row.sent_at || ''
  }));
}
