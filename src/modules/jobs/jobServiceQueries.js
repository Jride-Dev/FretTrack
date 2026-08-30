import { supabase, hasSupabaseConfig } from '../../shared/lib/supabaseClient';
import { mergeJobsByUpdatedAt } from './jobMerge.js';
import {
  fromDbJob,
  getActiveShopId,
  hydrateJobImageUrls,
  normalizeJob,
  sanitizeJobForPersistence
} from './jobServiceNormalization.js';

const STORAGE_KEY = 'guitar_checkin_jobs';
const OLD_STORAGE_KEY = 'guitar-checkin-jobs';

export function getLocalJobs() {
  try {
    const activeShopId = getActiveShopId();
    const storedJobs = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (storedJobs) {
      return storedJobs.map(normalizeJob).filter((job) => job.shopId === activeShopId);
    }

    const oldStoredJobs = JSON.parse(localStorage.getItem(OLD_STORAGE_KEY));
    if (oldStoredJobs) {
      const migratedJobs = oldStoredJobs.map(normalizeJob).filter((job) => job.shopId === activeShopId);
      saveLocalJobs(migratedJobs);
      return migratedJobs;
    }

    return [];
  } catch {
    return [];
  }
}

export function saveLocalJobs(jobs) {
  try {
    const persistedJobs = jobs.map((job) => sanitizeJobForPersistence(normalizeJob(job)));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persistedJobs));
  } catch (error) {
    console.error('Local job save failed. Supabase save will still be attempted when configured.', error);
  }
}

export const saveJobs = saveLocalJobs;

export async function getJobs() {
  const activeShopId = getActiveShopId();

  if (!hasSupabaseConfig || !supabase) {
    return getLocalJobs();
  }

  const { data, error } = await supabase
    .from('jobs')
    .select(`
      *,
      work_logs (*),
      job_parts (*),
      job_services (*),
      job_images (*),
      customer_messages (*)
    `)
    .eq('shop_id', activeShopId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Supabase getJobs failed. Falling back to localStorage.', error);
    return getLocalJobs();
  }

  const remoteJobs = await Promise.all(data.map(async (job) => hydrateJobImageUrls(fromDbJob(job))));
  const jobs = mergeJobsByUpdatedAt(remoteJobs, getLocalJobs(), {
    activeShopId,
    normalizeJob
  });
  saveLocalJobs(jobs);
  return jobs;
}

export async function findRemoteJobByNumber(jobNumber, shopId = '') {
  if (!hasSupabaseConfig || !supabase || !jobNumber) {
    return null;
  }

  const { data, error } = await supabase
    .from('jobs')
    .select('id, job_number, created_at')
    .eq('shop_id', getActiveShopId(shopId))
    .eq('job_number', jobNumber)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn('Remote job lookup by number failed.', error);
    return null;
  }

  return data || null;
}
