import { hasSupabaseConfig, supabase } from '../../shared/lib/supabaseClient';

export async function createJobImageObjectUrl(storagePath) {
  if (!storagePath || !hasSupabaseConfig || !supabase) {
    return '';
  }

  const { data, error } = await supabase.storage
    .from('job-images')
    .download(storagePath);

  if (error) {
    console.error('Job image download failed.', error);
    return '';
  }

  return data ? URL.createObjectURL(data) : '';
}

export async function resolveJobImageUrl(image) {
  const storagePath = image?.storagePath || image?.storage_path || '';
  const objectUrl = await createJobImageObjectUrl(storagePath);
  const fallbackUrl = image?.url || image?.public_url || '';
  return objectUrl || (String(fallbackUrl).startsWith('blob:') ? '' : fallbackUrl);
}

export async function resolveJobImageUrls(images = []) {
  return Promise.all(
    images.map(async (image) => ({
      ...image,
      url: await resolveJobImageUrl(image)
    }))
  );
}
