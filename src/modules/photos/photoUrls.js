import { hasSupabaseConfig, supabase } from '../../shared/lib/supabaseClient';

const SIGNED_IMAGE_URL_TTL_SECONDS = 60 * 60 * 24;

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

export async function resolveJobImageUrl(image) {
  const storagePath = image?.storagePath || image?.storage_path || '';
  const fallbackUrl = image?.url || image?.public_url || '';
  const safeFallbackUrl = String(fallbackUrl).startsWith('blob:') && storagePath ? '' : fallbackUrl;

  if (safeFallbackUrl && !String(safeFallbackUrl).startsWith('blob:')) {
    return safeFallbackUrl;
  }

  return await createJobImageSignedUrl(storagePath) || safeFallbackUrl || '';
}

export async function resolveJobImageUrls(images = []) {
  return Promise.all(
    images.map(async (image) => ({
      ...image,
      url: await resolveJobImageUrl(image)
    }))
  );
}
