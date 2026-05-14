import { hasSupabaseConfig, supabase } from '../../shared/lib/supabaseClient';

const JOB_IMAGE_SIGNED_URL_TTL_SECONDS = 60 * 60 * 24;

export async function createJobImageSignedUrl(storagePath) {
  if (!storagePath || !hasSupabaseConfig || !supabase) {
    return '';
  }

  const { data, error } = await supabase.storage
    .from('job-images')
    .createSignedUrl(storagePath, JOB_IMAGE_SIGNED_URL_TTL_SECONDS);

  if (error) {
    console.error('Job image signed URL creation failed.', error);
    return '';
  }

  return data?.signedUrl || '';
}

export async function resolveJobImageUrl(image) {
  const storagePath = image?.storagePath || image?.storage_path || '';
  const signedUrl = await createJobImageSignedUrl(storagePath);
  return signedUrl || image?.url || image?.public_url || '';
}

export async function resolveJobImageUrls(images = []) {
  return Promise.all(
    images.map(async (image) => ({
      ...image,
      url: await resolveJobImageUrl(image)
    }))
  );
}
