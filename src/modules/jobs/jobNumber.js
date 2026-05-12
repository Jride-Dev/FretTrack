const DEFAULT_SEQUENCE = 1;

export function getJobDateValue(date = new Date()) {
  const normalizedDate = normalizeDate(date);

  if (!normalizedDate) {
    return '';
  }

  const year = normalizedDate.getFullYear();
  const month = String(normalizedDate.getMonth() + 1).padStart(2, '0');
  const day = String(normalizedDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getJobDayCode(date = new Date()) {
  const normalizedDate = normalizeDate(date);

  if (!normalizedDate) {
    return '';
  }

  const year = String(normalizedDate.getFullYear()).slice(-2);
  const start = Date.UTC(normalizedDate.getFullYear(), 0, 0);
  const current = Date.UTC(normalizedDate.getFullYear(), normalizedDate.getMonth(), normalizedDate.getDate());
  const diff = current - start;
  const oneDay = 1000 * 60 * 60 * 24;
  const dayOfYear = String(Math.floor(diff / oneDay)).padStart(3, '0');

  return `${year}${dayOfYear}`;
}

export function formatJobNumber(dayCode, sequence = DEFAULT_SEQUENCE) {
  if (!dayCode) {
    return '';
  }

  return `${dayCode}-${String(Number(sequence) || DEFAULT_SEQUENCE).padStart(3, '0')}`;
}

export function getNextDailySequence(date = new Date(), jobs = [], currentJobId = '', shopId = '') {
  const jobDate = getJobDateValue(date);
  const dayCode = getJobDayCode(date);
  const matchingSequences = jobs
    .filter((job) => {
      const sameJob = job.id && currentJobId && job.id === currentJobId;
      const sameShop = !shopId || !job.shopId || job.shopId === shopId;
      const sameDate = job.jobDate === jobDate || job.dateReceived === jobDate || job.jobDayCode === dayCode;
      return !sameJob && sameShop && sameDate;
    })
    .map((job) => {
      const explicitSequence = Number(job.dailySequence || job.daily_sequence || 0);
      if (explicitSequence > 0) {
        return explicitSequence;
      }

      const match = String(job.jobNumber || job.job_number || '').match(/-(\d{3})$/);
      return match ? Number(match[1]) : 0;
    });

  return Math.max(0, ...matchingSequences) + 1;
}

export function generateJobNumber(date = new Date(), jobs = [], currentJobId = '', shopId = '') {
  const dayCode = getJobDayCode(date);

  if (!dayCode) {
    return '';
  }

  return formatJobNumber(dayCode, getNextDailySequence(date, jobs, currentJobId, shopId));
}

function normalizeDate(date) {
  const normalizedDate = typeof date === 'string' ? new Date(`${date}T00:00:00`) : date;
  if (!(normalizedDate instanceof Date) || Number.isNaN(normalizedDate.getTime())) {
    return null;
  }
  return normalizedDate;
}
