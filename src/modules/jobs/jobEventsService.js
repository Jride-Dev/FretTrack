import { hasSupabaseConfig, supabase } from '../../shared/lib/supabaseClient';
import { getCurrentShopId } from '../shops/shopConfig';

export async function logJobEvent({
  shopId = getCurrentShopId(),
  jobId,
  eventType,
  eventLabel,
  eventNote = '',
  eventData = {},
  createdBy = ''
}) {
  if (!jobId || !eventType || !eventLabel) {
    return null;
  }

  if (!hasSupabaseConfig || !supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from('job_events')
    .insert({
      shop_id: shopId,
      job_id: jobId,
      event_type: eventType,
      event_label: eventLabel,
      event_note: eventNote || null,
      event_data: eventData || {},
      created_by: createdBy || null
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function getJobEvents(jobId) {
  if (!jobId || !hasSupabaseConfig || !supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from('job_events')
    .select('*')
    .eq('job_id', jobId)
    .eq('shop_id', getCurrentShopId())
    .order('created_at', { ascending: false });

  if (error) {
    console.warn('Job events load failed.', error);
    return [];
  }

  return data.map(fromDbJobEvent);
}

export function logJobEventSafe(event) {
  logJobEvent(event).catch((error) => {
    console.warn('Job event logging failed.', error);
  });
}

function fromDbJobEvent(event) {
  return {
    id: event.id,
    shopId: event.shop_id,
    jobId: event.job_id,
    eventType: event.event_type,
    eventLabel: event.event_label,
    eventNote: event.event_note || '',
    eventData: event.event_data || {},
    createdAt: event.created_at,
    createdBy: event.created_by || ''
  };
}
