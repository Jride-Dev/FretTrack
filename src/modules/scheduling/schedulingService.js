import { hasSupabaseConfig, supabase } from '../../shared/lib/supabaseClient';
import { getCurrentShopId } from '../shops/shopConfig';
import { logJobEventSafe } from '../jobs/jobEventsService';

export const scheduleEventTypes = [
  { value: 'intake', label: 'Intake' },
  { value: 'pickup', label: 'Pickup' },
  { value: 'due', label: 'Due Date' },
  { value: 'follow_up', label: 'Follow-up' },
  { value: 'shop_block', label: 'Shop Block' },
  { value: 'other', label: 'Other' }
];

export const scheduleStatuses = [
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'missed', label: 'Missed' }
];

function cleanText(value) {
  return String(value || '').trim();
}

function normalizeDateTime(value) {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function requireSchedulingConfigured() {
  if (!hasSupabaseConfig || !supabase) {
    throw new Error('Scheduling requires the live Supabase-backed FretTrack app.');
  }
}

function toDbScheduleEvent(shopId, payload = {}) {
  return {
    shop_id: shopId,
    job_id: cleanText(payload.jobId || payload.job_id) || null,
    customer_id: cleanText(payload.customerId || payload.customer_id) || null,
    title: cleanText(payload.title),
    description: cleanText(payload.description) || null,
    event_type: payload.eventType || payload.event_type || 'other',
    starts_at: normalizeDateTime(payload.startsAt || payload.starts_at),
    ends_at: normalizeDateTime(payload.endsAt || payload.ends_at),
    all_day: Boolean(payload.allDay ?? payload.all_day),
    status: payload.status || 'scheduled',
    location: cleanText(payload.location) || null
  };
}

export function fromDbScheduleEvent(row = {}) {
  return {
    id: row.id,
    shopId: row.shop_id,
    jobId: row.job_id || '',
    customerId: row.customer_id || '',
    title: row.title || '',
    description: row.description || '',
    eventType: row.event_type || 'other',
    startsAt: row.starts_at || '',
    endsAt: row.ends_at || '',
    allDay: Boolean(row.all_day),
    status: row.status || 'scheduled',
    location: row.location || '',
    createdBy: row.created_by || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function validateSchedulePayload(payload) {
  if (!cleanText(payload.title)) {
    throw new Error('Event title is required.');
  }
  if (!normalizeDateTime(payload.startsAt || payload.starts_at)) {
    throw new Error('Start date/time is required.');
  }
}

function logScheduleJobEvent(scheduleEvent, eventType, label) {
  if (!scheduleEvent?.jobId) {
    return;
  }
  logJobEventSafe({
    shopId: scheduleEvent.shopId,
    jobId: scheduleEvent.jobId,
    eventType,
    eventLabel: label,
    eventNote: scheduleEvent.title,
    eventData: {
      scheduleEventId: scheduleEvent.id,
      eventType: scheduleEvent.eventType,
      startsAt: scheduleEvent.startsAt,
      status: scheduleEvent.status
    }
  });
}

export async function listScheduleEvents(shopId = getCurrentShopId(), rangeStart, rangeEnd, filters = {}) {
  if (!hasSupabaseConfig || !supabase) {
    return [];
  }

  let query = supabase
    .from('schedule_events')
    .select('*')
    .eq('shop_id', shopId)
    .order('starts_at', { ascending: true });

  const start = normalizeDateTime(rangeStart);
  const end = normalizeDateTime(rangeEnd);
  if (start) {
    query = query.gte('starts_at', start);
  }
  if (end) {
    query = query.lt('starts_at', end);
  }
  if (filters.eventType) {
    query = query.eq('event_type', filters.eventType);
  }
  if (filters.status) {
    query = query.eq('status', filters.status);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }
  return (data || []).map(fromDbScheduleEvent);
}

export async function createScheduleEvent(shopId = getCurrentShopId(), payload = {}) {
  requireSchedulingConfigured();
  validateSchedulePayload(payload);

  const { data, error } = await supabase
    .from('schedule_events')
    .insert(toDbScheduleEvent(shopId, payload))
    .select()
    .single();

  if (error) {
    throw error;
  }
  const scheduleEvent = fromDbScheduleEvent(data);
  logScheduleJobEvent(scheduleEvent, 'schedule_event_created', 'Schedule event created');
  return scheduleEvent;
}

export async function updateScheduleEvent(eventId, payload = {}) {
  requireSchedulingConfigured();
  const existingEvent = await getScheduleEvent(eventId);
  if (!existingEvent) {
    throw new Error('Schedule event not found.');
  }

  const nextPayload = toDbScheduleEvent(existingEvent.shopId, { ...existingEvent, ...payload });
  validateSchedulePayload(nextPayload);

  const { data, error } = await supabase
    .from('schedule_events')
    .update(nextPayload)
    .eq('id', eventId)
    .select()
    .single();

  if (error) {
    throw error;
  }
  const scheduleEvent = fromDbScheduleEvent(data);
  logScheduleJobEvent(scheduleEvent, 'schedule_event_updated', 'Schedule event updated');
  return scheduleEvent;
}

export async function deleteScheduleEvent(eventId) {
  requireSchedulingConfigured();
  const existingEvent = await getScheduleEvent(eventId);
  if (!existingEvent) {
    return null;
  }
  const { error } = await supabase
    .from('schedule_events')
    .delete()
    .eq('id', eventId);

  if (error) {
    throw error;
  }
  logScheduleJobEvent(existingEvent, 'schedule_event_cancelled', 'Schedule event deleted');
  return existingEvent;
}

export async function completeScheduleEvent(eventId) {
  return updateScheduleEvent(eventId, { status: 'completed' });
}

export async function cancelScheduleEvent(eventId) {
  const scheduleEvent = await updateScheduleEvent(eventId, { status: 'cancelled' });
  logScheduleJobEvent(scheduleEvent, 'schedule_event_cancelled', 'Schedule event cancelled');
  return scheduleEvent;
}

export async function listUpcomingEvents(shopId = getCurrentShopId(), limit = 5) {
  if (!hasSupabaseConfig || !supabase) {
    return [];
  }
  const { data, error } = await supabase
    .from('schedule_events')
    .select('*')
    .eq('shop_id', shopId)
    .eq('status', 'scheduled')
    .gte('starts_at', new Date().toISOString())
    .order('starts_at', { ascending: true })
    .limit(limit);

  if (error) {
    throw error;
  }
  return (data || []).map(fromDbScheduleEvent);
}

export async function listJobScheduleEvents(jobId) {
  if (!hasSupabaseConfig || !supabase || !jobId) {
    return [];
  }
  const { data, error } = await supabase
    .from('schedule_events')
    .select('*')
    .eq('job_id', jobId)
    .order('starts_at', { ascending: true });

  if (error) {
    throw error;
  }
  return (data || []).map(fromDbScheduleEvent);
}

async function getScheduleEvent(eventId) {
  const { data, error } = await supabase
    .from('schedule_events')
    .select('*')
    .eq('id', eventId)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return data ? fromDbScheduleEvent(data) : null;
}
