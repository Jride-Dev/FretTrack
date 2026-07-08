import { hasSupabaseConfig, supabase } from '../../shared/lib/supabaseClient';

const SIGNED_IMAGE_URL_TTL_SECONDS = 60 * 60 * 24;
const JOB_IMAGE_STORAGE_URL_MARKERS = [
  '/storage/v1/object/sign/job-images/',
  '/storage/v1/object/public/job-images/',
  '/storage/v1/object/authenticated/job-images/'
];

export function isBlobJobImageUrl(url) {
  return String(url || '').startsWith('blob:');
}

export function isDataJobImageUrl(url) {
  return String(url || '').startsWith('data:');
}

export function getJobImageStoragePathFromUrl(url) {
  const rawUrl = String(url || '');

  if (!rawUrl || isBlobJobImageUrl(rawUrl) || isDataJobImageUrl(rawUrl)) {
    return '';
  }

  try {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://frettrack.local';
    const parsedUrl = new URL(rawUrl, baseUrl);
    const marker = JOB_IMAGE_STORAGE_URL_MARKERS.find((candidate) => parsedUrl.pathname.includes(candidate));

    if (!marker) {
      return '';
    }

    const encodedPath = parsedUrl.pathname.slice(parsedUrl.pathname.indexOf(marker) + marker.length);
    return decodeURIComponent(encodedPath);
  } catch {
    return '';
  }
}

export function getJobImageStoragePath(image = {}) {
  const explicitPath = image.storagePath || image.storage_path || '';

  if (explicitPath) {
    return explicitPath;
  }

  return getJobImageStoragePathFromUrl(image.url || image.public_url || image.publicUrl || '');
}

export function getPersistableJobImageUrl(image = {}) {
  const storagePath = getJobImageStoragePath(image);
  const fallbackUrl = image.url || image.public_url || image.publicUrl || '';

  if (storagePath || isBlobJobImageUrl(fallbackUrl) || isDataJobImageUrl(fallbackUrl)) {
    return '';
  }

  return fallbackUrl;
}

export async function createJobImageSignedUrl(storagePath) {
  if (!storagePath || !hasSupabaseConfig || !supabase) {
    return '';
  }

  const { data, error } = await supabase.storage
    .from('job-images')
    .createSignedUrl(storagePath, SIGNED_IMAGE_URL_TTL_SECONDS);

  if (error) {
    console.error('Job image signed URL failed.', error);
    return '';
  }

  return data?.signedUrl || '';
}

function warnMissingStoragePath(image, fallbackUrl) {
  if (!fallbackUrl || isBlobJobImageUrl(fallbackUrl) || isDataJobImageUrl(fallbackUrl)) {
    return;
  }

  console.warn('Photo record missing storage path. Display may fail after temporary URLs expire.', {
    imageId: image?.id || image?.imageId || '',
    jobId: image?.jobId || image?.job_id || ''
  });
}

export async function resolveJobImageUrl(image) {
  const storagePath = getJobImageStoragePath(image);
  const fallbackUrl = image?.url || image?.public_url || '';
  const safeFallbackUrl = String(fallbackUrl).startsWith('blob:') && storagePath ? '' : fallbackUrl;

  if (storagePath) {
    const signedUrl = await createJobImageSignedUrl(storagePath);

    if (signedUrl) {
      return signedUrl;
    }

    if (safeFallbackUrl && !String(safeFallbackUrl).startsWith('blob:')) {
      console.warn('Job image signed URL regeneration failed. Falling back to existing display URL.', {
        imageId: image?.id || image?.imageId || '',
        jobId: image?.jobId || image?.job_id || '',
        storagePath
      });
      return safeFallbackUrl;
    }

    return safeFallbackUrl || '';
  }

  warnMissingStoragePath(image, safeFallbackUrl);
  return safeFallbackUrl || '';
}

export async function resolveJobImageUrls(images = []) {
  return Promise.all(
    images.map(async (image) => {
      const storagePath = getJobImageStoragePath(image);

      return {
        ...image,
        storagePath,
        url: await resolveJobImageUrl({ ...image, storagePath })
      };
    })
  );
}
