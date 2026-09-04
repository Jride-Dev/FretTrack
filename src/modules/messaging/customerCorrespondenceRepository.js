import { hasSupabaseConfig, supabase } from '../../shared/lib/supabaseClient';
import {
  clampCorrespondenceLimit,
  normalizeCorrespondenceMessage,
  normalizeCorrespondenceThread,
  sortCorrespondence
} from './customerCorrespondence';

export async function listCustomerConversationThreads(shopId, { customerId = '', channel = '', status = 'active' } = {}) {
  if (!hasSupabaseConfig || !supabase || !shopId) return [];

  let query = supabase
    .from('customer_conversation_threads')
    .select('*')
    .eq('shop_id', shopId)
    .order('updated_at', { ascending: false });

  if (customerId) query = query.eq('customer_id', customerId);
  if (channel) query = query.eq('channel', channel);
  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) {
    throw new Error(`Customer conversation threads could not be loaded: ${error.message}`);
  }

  return (data || []).map(normalizeCorrespondenceThread);
}

export async function listCustomerCorrespondence({
  shopId,
  threadId = '',
  customerId = '',
  jobId = '',
  channel = '',
  unassignedOnly = false,
  limit = 200
} = {}) {
  if (!hasSupabaseConfig || !supabase || !shopId) return [];

  let query = supabase
    .from('customer_messages')
    .select('*')
    .eq('shop_id', shopId)
    .order('created_at', { ascending: false })
    .limit(clampCorrespondenceLimit(limit));

  if (threadId) query = query.eq('thread_id', threadId);
  if (customerId) query = query.eq('customer_id', customerId);
  if (jobId) query = query.eq('job_id', jobId);
  if (channel) query = query.eq('channel', channel);
  if (unassignedOnly) query = query.is('job_id', null);

  const { data, error } = await query;
  if (error) {
    throw new Error(`Customer correspondence could not be loaded: ${error.message}`);
  }

  return sortCorrespondence((data || []).map(normalizeCorrespondenceMessage));
}

export async function setCustomerMessageReportInclusion(messageId, includeInCustomerReport) {
  requireRemoteCorrespondence();
  const { data, error } = await supabase
    .rpc('set_customer_message_report_inclusion', {
      p_message_id: messageId,
      p_include: Boolean(includeInCustomerReport)
    })
    .single();

  if (error) {
    throw new Error(`Customer report selection could not be saved: ${error.message}`);
  }

  return normalizeCorrespondenceMessage(data);
}

export async function markCustomerMessageRead(messageId, readAt = new Date().toISOString()) {
  requireRemoteCorrespondence();
  const { data, error } = await supabase
    .rpc('mark_customer_message_read', {
      p_message_id: messageId,
      p_read_at: readAt
    })
    .single();

  if (error) {
    throw new Error(`Customer message could not be marked read: ${error.message}`);
  }

  return normalizeCorrespondenceMessage(data);
}

export async function assignCustomerMessageJob(messageId, jobId) {
  requireRemoteCorrespondence();
  const { data, error } = await supabase
    .rpc('assign_customer_message_job', {
      p_message_id: messageId,
      p_job_id: jobId
    })
    .single();

  if (error) {
    throw new Error(`Customer correspondence could not be routed: ${error.message}`);
  }

  return normalizeCorrespondenceMessage(data);
}

function requireRemoteCorrespondence() {
  if (!hasSupabaseConfig || !supabase) {
    throw new Error('Customer correspondence requires a configured Supabase workspace.');
  }
}
