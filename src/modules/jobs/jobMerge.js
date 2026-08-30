function getActiveShopId(shopId = '') {
  return shopId || '';
}

export function getJobIdentityKey(job) {
  const shopId = getActiveShopId(job.shopId || job.shop_id);
  const jobNumber = job.jobNumber || job.job_number || '';
  return shopId && jobNumber ? `${shopId}:${jobNumber}` : '';
}

export function looksLikeRemoteJob(job) {
  return Boolean(job.jobNumber || job.job_number || job.dailySequence || job.daily_sequence);
}

export function isNewerJob(candidate, baseline) {
  const candidateTime = new Date(candidate.updatedAt || candidate.updated_at || candidate.createdAt || 0).getTime();
  const baselineTime = new Date(baseline.updatedAt || baseline.updated_at || baseline.createdAt || 0).getTime();
  return candidateTime > baselineTime;
}

export function mergeJobsByUpdatedAt(remoteJobs, localJobs, { activeShopId = '', normalizeJob = (job) => job } = {}) {
  const merged = new Map();
  const remoteKeys = new Set();

  remoteJobs.forEach((job) => {
    merged.set(job.id, job);
    const key = getJobIdentityKey(job);
    if (key) {
      remoteKeys.add(key);
    }
  });

  localJobs.forEach((localJob) => {
    if (getActiveShopId(localJob.shopId) !== activeShopId) {
      return;
    }

    if (!remoteJobs.length && looksLikeRemoteJob(localJob)) {
      return;
    }

    const localKey = getJobIdentityKey(localJob);
    if (localKey && remoteKeys.has(localKey) && !merged.has(localJob.id)) {
      return;
    }

    const remoteJob = merged.get(localJob.id);
    if (!remoteJob || isNewerJob(localJob, remoteJob)) {
      merged.set(localJob.id, localJob);
    }
  });

  return Array.from(merged.values())
    .map((job) => normalizeJob(job))
    .sort((a, b) => new Date(b.createdAt || b.updatedAt) - new Date(a.createdAt || a.updatedAt));
}
