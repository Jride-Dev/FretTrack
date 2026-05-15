import { supabase, hasSupabaseConfig } from '../../shared/lib/supabaseClient';
import { getCurrentShopId } from '../shops/shopConfig';

export async function getVisibleAnnouncements() {
  if (!hasSupabaseConfig || !supabase) {
    return [];
  }

  const { data: announcements, error } = await supabase
    .from('system_announcements')
    .select('id, title, message, severity, target_shop_id, starts_at, ends_at, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('System announcements load failed.', error);
    return [];
  }

  if (!announcements?.length) {
    return [];
  }

  const announcementIds = announcements.map((announcement) => announcement.id);
  const { data: dismissals, error: dismissalsError } = await supabase
    .from('system_announcement_dismissals')
    .select('announcement_id')
    .in('announcement_id', announcementIds);

  if (dismissalsError) {
    console.error('System announcement dismissals load failed.', dismissalsError);
    return announcements.map(fromAnnouncementRow);
  }

  const dismissedIds = new Set((dismissals || []).map((dismissal) => dismissal.announcement_id));
  return announcements
    .filter((announcement) => !dismissedIds.has(announcement.id))
    .map(fromAnnouncementRow);
}

export async function dismissAnnouncement(announcementId) {
  if (!hasSupabaseConfig || !supabase || !announcementId) {
    return;
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user?.id) {
    throw userError || new Error('Unable to confirm signed-in user.');
  }

  const { error } = await supabase
    .from('system_announcement_dismissals')
    .insert({
      announcement_id: announcementId,
      user_id: userData.user.id
    });

  if (error && error.code !== '23505') {
    throw error;
  }
}

export async function submitBetaFeedback(feedback) {
  if (!hasSupabaseConfig || !supabase) {
    throw new Error('Supabase is not configured.');
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user?.id) {
    throw userError || new Error('Unable to confirm signed-in user.');
  }

  const { error } = await supabase
    .from('beta_feedback')
    .insert({
      shop_id: feedback.shopId || getCurrentShopId(),
      user_id: userData.user.id,
      user_email: userData.user.email || '',
      feedback_type: feedback.feedbackType || 'bug',
      severity: feedback.severity || 'normal',
      page_url: window.location.href,
      subject: feedback.subject || '',
      message: feedback.message,
      job_id: feedback.jobId || null,
      job_number: feedback.jobNumber || '',
      browser_info: getBrowserInfo()
    });

  if (error) {
    throw error;
  }
}

function fromAnnouncementRow(row) {
  return {
    id: row.id,
    title: row.title,
    message: row.message,
    severity: row.severity || 'info',
    targetShopId: row.target_shop_id || '',
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    createdAt: row.created_at
  };
}

function getBrowserInfo() {
  return {
    userAgent: navigator.userAgent,
    language: navigator.language,
    platform: navigator.platform,
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight
    }
  };
}
