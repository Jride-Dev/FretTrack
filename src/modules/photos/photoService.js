import { prepareImageForStorage, readFileAsDataUrl } from '../../services/imageProcessing';
import { hasSupabaseConfig, supabase } from '../../shared/lib/supabaseClient';
import { ensureRemoteJob, getLocalJobs, saveLocalJobs, updateJob } from '../jobs/jobService';
import { logJobEventSafe } from '../jobs/jobEventsService';
import { getCurrentShopId } from '../shops/shopConfig';
import { createJobImageSignedUrl } from './photoUrls';

export async function uploadJobImages(job, files, options = {}) {
  const fileList = Array.from(files || []);
  const errors = [];
  let currentJob = normalizePhotoJob(job);

  for (let index = 0; index < fileList.length; index += 1) {
    try {
      const savedJob = await uploadJobImage(currentJob, fileList[index], {
        ...options,
        index: index + 1
      });

      if (savedJob) {
        currentJob = normalizePhotoJob(savedJob);
      }
    } catch (error) {
      console.error('Image import failed.', error);
      errors.push({
        fileName: fileList[index]?.name || `Image ${index + 1}`,
        message: error instanceof Error ? error.message : 'Image import failed.'
      });
    }
  }

  return { job: currentJob, errors };
}

export async function uploadJobImage(jobOrId, file, options = {}) {
  if (!file) {
    return null;
  }

  const job = typeof jobOrId === 'string' ? null : jobOrId;
  let jobId = typeof jobOrId === 'string' ? jobOrId : jobOrId.id;
  let normalizedJob = job ? normalizePhotoJob(job) : null;
  const originalFileName = file.name || 'imported-image';
  const uploadFile = await prepareImageForStorage(file, originalFileName);
  const uploadedAt = new Date().toISOString();
  const category = options.category || 'job';

  if (!hasSupabaseConfig || !supabase) {
    if (!job) {
      return null;
    }
    const image = {
      id: crypto.randomUUID(),
      jobId,
      url: await readFileAsDataUrl(uploadFile),
      fileName: uploadFile.name,
      name: uploadFile.name,
      originalFileName,
      uploadedAt,
      category,
      createdAt: uploadedAt
    };
    const savedJob = await updateJob({ ...normalizedJob, images: [...(normalizedJob.images || []), image] });
    logImageUploaded(savedJob || normalizedJob, image);
    return savedJob;
  }

  if (normalizedJob) {
    normalizedJob = normalizePhotoJob(await ensureRemoteJob(normalizedJob));
    jobId = normalizedJob.id;
  }

  const filePath = `${jobId}/${makeJobImageFileName(normalizedJob, options.index || 1)}`;

  const { error: uploadError } = await supabase.storage
    .from('job-images')
    .upload(filePath, uploadFile, {
      contentType: uploadFile.type,
      cacheControl: '31536000'
    });

  if (uploadError) {
    console.error('Image upload failed.', uploadError);
    return null;
  }

  const signedUrl = await createJobImageSignedUrl(filePath);

  const image = {
    id: crypto.randomUUID(),
    jobId,
    url: signedUrl,
    fileName: uploadFile.name,
    name: uploadFile.name,
    storagePath: filePath,
    originalFileName,
    uploadedAt,
    category,
    createdAt: uploadedAt
  };

  const { error: dbError } = await supabase.from('job_images').insert({
    id: image.id,
    job_id: jobId,
    url: image.url,
    public_url: '',
    storage_path: image.storagePath,
    file_name: image.fileName,
    original_filename: image.originalFileName,
    uploaded_at: image.uploadedAt,
    category: image.category,
    created_at: image.createdAt
  });

  if (dbError) {
    console.error('Image database insert failed.', dbError);
    throw new Error(`Image uploaded, but database photo record failed: ${dbError.message}`);
  }

  if (job) {
    const savedJob = await updateJob({ ...normalizedJob, images: [...(normalizedJob.images || []), image] });
    logImageUploaded(savedJob || normalizedJob, image);
    return savedJob;
  }

  logImageUploaded({ id: jobId, shopId: getCurrentShopId() }, image);
  return image;
}

export async function deleteJobImage(job, image) {
  if (!job || !image) {
    return null;
  }

  const nextJob = normalizePhotoJob({
    ...job,
    images: (job.images || []).filter((item) => item.id !== image.id)
  });

  saveLocalJobs(getLocalJobs().map((item) => (item.id === nextJob.id ? nextJob : item)));

  if (!hasSupabaseConfig || !supabase) {
    logImageDeleted(nextJob, image);
    return nextJob;
  }

  const storagePath = image.storagePath || getStoragePathFromPublicUrl(image.url);
  if (storagePath) {
    const { error: storageError } = await supabase.storage
      .from('job-images')
      .remove([storagePath]);

    if (storageError) {
      console.error('Image storage delete failed.', storageError);
      return null;
    }
  }

  const { error: dbError } = await supabase
    .from('job_images')
    .delete()
    .eq('id', image.id)
    .eq('job_id', nextJob.id);

  if (dbError) {
    console.error('Image database delete failed.', dbError);
    return null;
  }

  logImageDeleted(nextJob, image);
  return nextJob;
}

function normalizePhotoJob(job) {
  return {
    ...job,
    images: (job.images || []).map(normalizeImage)
  };
}

function normalizeImage(image) {
  return {
    id: image.id || crypto.randomUUID(),
    jobId: image.jobId || image.job_id || '',
    url: image.url || image.public_url || '',
    storagePath: image.storagePath || image.storage_path || '',
    fileName: image.fileName || image.file_name || image.name || '',
    originalFileName: image.originalFileName || image.original_filename || image.fileName || image.file_name || image.name || '',
    name: image.name || image.fileName || image.file_name || '',
    uploadedAt: image.uploadedAt || image.uploaded_at || image.createdAt || image.created_at || new Date().toISOString(),
    category: image.category || 'job',
    createdAt: image.createdAt || image.created_at || new Date().toISOString()
  };
}

function makeJobImageFileName(job, index = 1) {
  const timestamp = compactTimestamp(new Date());
  const jobNumber = safeStorageFileName(job?.jobNumber || job?.id || 'job').replace(/\.[^.]+$/, '');
  const paddedIndex = String(index).padStart(3, '0');
  return `job-${jobNumber}-${timestamp}-${paddedIndex}.jpg`;
}

function compactTimestamp(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  const second = String(date.getSeconds()).padStart(2, '0');
  const millisecond = String(date.getMilliseconds()).padStart(3, '0');
  return `${year}${month}${day}${hour}${minute}${second}${millisecond}`;
}

function safeStorageFileName(fileName) {
  return String(fileName || '')
    .trim()
    .replace(/[^a-z0-9._-]+/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'job-image.jpg';
}

function getStoragePathFromPublicUrl(url) {
  if (!url || url.startsWith('data:')) {
    return '';
  }

  try {
    const parsedUrl = new URL(url);
    const publicMarker = '/storage/v1/object/public/job-images/';
    const signedMarker = '/storage/v1/object/sign/job-images/';
    const marker = parsedUrl.pathname.includes(publicMarker) ? publicMarker : signedMarker;
    const markerIndex = parsedUrl.pathname.indexOf(marker);
    if (markerIndex === -1) {
      return '';
    }

    return decodeURIComponent(parsedUrl.pathname.slice(markerIndex + marker.length));
  } catch {
    return '';
  }
}

function logImageUploaded(job, image) {
  logJobEventSafe({
    shopId: job.shopId || getCurrentShopId(),
    jobId: job.id || image.jobId,
    eventType: 'image_uploaded',
    eventLabel: 'Image uploaded',
    eventNote: image.originalFileName || image.fileName || '',
    eventData: {
      imageId: image.id,
      category: image.category,
      fileName: image.fileName,
      storagePath: image.storagePath || ''
    }
  });
}

function logImageDeleted(job, image) {
  logJobEventSafe({
    shopId: job.shopId || getCurrentShopId(),
    jobId: job.id || image.jobId,
    eventType: 'image_deleted',
    eventLabel: 'Image deleted',
    eventNote: image.originalFileName || image.fileName || '',
    eventData: {
      imageId: image.id,
      category: image.category,
      fileName: image.fileName,
      storagePath: image.storagePath || ''
    }
  });
}
