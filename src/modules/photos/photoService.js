import { optimizeImageForStorage, readFileAsDataUrl } from '../../services/imageProcessing';
import { hasSupabaseConfig, supabase } from '../../shared/lib/supabaseClient';
import { ensureRemoteJob, getLocalJobs, saveLocalJobs, updateJob } from '../jobs/jobService';
import { logJobEventSafe } from '../jobs/jobEventsService';
import { getCurrentShopId } from '../shops/shopConfig';
import {
  releaseDeletedPhotoStorage,
  releasePhotoUsageReservation,
  reservePhotoUsage,
  settlePhotoUsage
} from '../billing/usageCaps';
import { createJobImageSignedUrl, getJobImageStoragePath } from './photoUrls';

const JOB_IMAGES_BUCKET = 'job-images';

export async function uploadJobImages(job, files, options = {}) {
  const fileList = Array.from(files || []);
  const errors = [];
  const optimizationNotices = [];
  let currentJob = normalizePhotoJob(job);

  for (let index = 0; index < fileList.length; index += 1) {
    try {
      const savedImageResult = await uploadJobImage(currentJob, fileList[index], {
        ...options,
        index: index + 1,
        uploadId: options.uploadIds?.[index] || options.uploadId || crypto.randomUUID()
      });

      const savedJob = savedImageResult?.job || savedImageResult;
      if (savedImageResult?.optimizationNotice) {
        optimizationNotices.push({
          fileName: fileList[index]?.name || `Image ${index + 1}`,
          message: savedImageResult.optimizationNotice
        });
      }
      if (savedJob) {
        currentJob = normalizePhotoJob(savedJob);
      }
    } catch (error) {
      console.error('Image import failed.', error);
      errors.push({
        fileName: fileList[index]?.name || `Image ${index + 1}`,
        uploadId: options.uploadIds?.[index] || options.uploadId || '',
        code: error?.code || '',
        message: error instanceof Error ? error.message : 'Image import failed.'
      });
    }
  }

  return { job: currentJob, errors, optimizationNotices };
}

export async function uploadJobImage(jobOrId, file, options = {}) {
  if (!file) {
    return null;
  }

  const job = typeof jobOrId === 'string' ? null : jobOrId;
  let jobId = typeof jobOrId === 'string' ? jobOrId : jobOrId.id;
  let normalizedJob = job ? normalizePhotoJob(job) : null;
  const originalFileName = file.name || 'imported-image';
  const uploadedAt = new Date().toISOString();
  const category = options.category || 'job';
  const imageId = options.uploadId || crypto.randomUUID();
  const optimization = await optimizeImageForStorage(file, {
    preset: category.startsWith('damage-map') ? 'damage' : 'job',
    originalFileName
  });
  const uploadFile = optimization.file;
  const optimizationMetadata = optimization.metadata;

  if (!hasSupabaseConfig || !supabase) {
    if (!job) {
      return null;
    }
    const image = {
      id: imageId,
      jobId,
      url: await readFileAsDataUrl(uploadFile),
      fileName: uploadFile.name,
      name: uploadFile.name,
      originalFileName,
      uploadedAt,
      category,
      createdAt: uploadedAt,
      ...imageMetadataToObject(optimizationMetadata)
    };
    const savedJob = await updateJob({ ...normalizedJob, images: [...(normalizedJob.images || []), image] });
    logImageUploaded(savedJob || normalizedJob, image);
    return { job: savedJob, optimizationNotice: optimization.notice };
  }

  if (normalizedJob) {
    normalizedJob = normalizePhotoJob(await ensureRemoteJob(normalizedJob));
    jobId = normalizedJob.id;
  }

  const existingImage = await findExistingUploadedImage(jobId, imageId);
  if (existingImage) {
    if (job) {
      return { job: mergePhotoIntoJob(normalizedJob, existingImage), image: existingImage, optimizationNotice: optimization.notice, replayed: true };
    }
    return { ...existingImage, optimizationNotice: optimization.notice, replayed: true };
  }

  const storedFileName = makeJobImageFileName(normalizedJob, imageId);
  const filePath = `${jobId}/${storedFileName}`;
  const shopId = requirePhotoShopId(normalizedJob?.shopId);
  await uploadPhotoObjectWithQuota({
    shopId,
    bucket: JOB_IMAGES_BUCKET,
    path: filePath,
    file: uploadFile,
    usageKind: 'source_photo',
    uploadOptions: {
      contentType: uploadFile.type,
      cacheControl: '31536000',
      upsert: true
    },
    requestId: imageId
  });

  const imageUrl = await createJobImageSignedUrl(filePath);

  const image = {
    id: imageId,
    jobId,
    url: imageUrl,
    fileName: storedFileName,
    name: storedFileName,
    storagePath: filePath,
    originalFileName,
    uploadedAt,
    category,
    createdAt: uploadedAt,
    ...imageMetadataToObject({
      ...optimizationMetadata,
      storedFileName
    })
  };

  const { error: dbError } = await supabase.from('job_images').insert({
    id: image.id,
    job_id: jobId,
    url: '',
    public_url: '',
    storage_path: image.storagePath,
    file_name: image.fileName,
    stored_filename: image.storedFileName,
    original_filename: image.originalFileName,
    original_size_bytes: image.originalSizeBytes,
    optimized_size_bytes: image.optimizedSizeBytes,
    mime_type: image.mimeType,
    width: image.width,
    height: image.height,
    optimization_version: image.optimizationVersion,
    uploaded_at: image.uploadedAt,
    category: image.category,
    created_at: image.createdAt
  });

  if (dbError) {
    if (dbError.code === '23505') {
      const replayedImage = await findExistingUploadedImage(jobId, imageId);
      if (replayedImage) {
        if (job) {
          return { job: mergePhotoIntoJob(normalizedJob, replayedImage), image: replayedImage, optimizationNotice: optimization.notice, replayed: true };
        }
        return { ...replayedImage, optimizationNotice: optimization.notice, replayed: true };
      }
    }
    console.error('Image database insert failed.', dbError);
    await removeSettledPhotoObjectSafe({ shopId, bucket: JOB_IMAGES_BUCKET, path: filePath });
    throw new Error(`Image uploaded, but database photo record failed: ${dbError.message}`);
  }

  if (job) {
    const savedJob = mergePhotoIntoJob(normalizedJob, image);
    saveLocalJobs(getLocalJobs().map((item) => (item.id === savedJob.id ? savedJob : item)));
    logImageUploaded(savedJob, image);
    return { job: savedJob, image, optimizationNotice: optimization.notice };
  }

  logImageUploaded({ id: jobId, shopId: getCurrentShopId() }, image);
  return {
    ...image,
    optimizationNotice: optimization.notice
  };
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

  const storagePath = getJobImageStoragePath(image);
  if (storagePath) {
    const { error: storageError } = await supabase.storage
      .from(JOB_IMAGES_BUCKET)
      .remove([storagePath]);

    if (storageError) {
      console.error('Image storage delete failed.', storageError);
      return null;
    }
    try {
      await releaseDeletedPhotoStorage({
        shopId: requirePhotoShopId(nextJob.shopId),
        bucket: JOB_IMAGES_BUCKET,
        path: storagePath
      });
    } catch (releaseError) {
      // The object is already gone, so preserve the user's delete and leave a
      // conservative over-count for an operator reconciliation pass.
      console.error('Photo storage usage release failed.', releaseError);
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

async function findExistingUploadedImage(jobId, imageId) {
  const { data, error } = await supabase
    .from('job_images')
    .select('*')
    .eq('id', imageId)
    .eq('job_id', jobId)
    .maybeSingle();
  if (error) {
    throw new Error(`Photo upload reconciliation failed: ${error.message}`);
  }
  if (!data) {
    return null;
  }
  const storagePath = getJobImageStoragePath(data);
  return normalizeImage({
    ...data,
    url: storagePath ? await createJobImageSignedUrl(storagePath) : ''
  });
}

function mergePhotoIntoJob(job, image) {
  if (!job) {
    return null;
  }
  return {
    ...job,
    images: [...(job.images || []).filter((item) => item.id !== image.id), image]
  };
}

function normalizePhotoJob(job) {
  return {
    ...job,
    images: (job.images || []).map(normalizeImage)
  };
}

function normalizeImage(image) {
  const storagePath = getJobImageStoragePath(image);

  return {
    id: image.id || crypto.randomUUID(),
    jobId: image.jobId || image.job_id || '',
    url: image.url || image.public_url || '',
    storagePath,
    fileName: image.fileName || image.file_name || image.name || '',
    originalFileName: image.originalFileName || image.original_filename || image.fileName || image.file_name || image.name || '',
    storedFileName: image.storedFileName || image.stored_filename || image.fileName || image.file_name || image.name || '',
    originalSizeBytes: Number(image.originalSizeBytes ?? image.original_size_bytes ?? 0),
    optimizedSizeBytes: Number(image.optimizedSizeBytes ?? image.optimized_size_bytes ?? 0),
    mimeType: image.mimeType || image.mime_type || '',
    width: Number(image.width || 0),
    height: Number(image.height || 0),
    optimizationVersion: image.optimizationVersion || image.optimization_version || '',
    name: image.name || image.fileName || image.file_name || '',
    uploadedAt: image.uploadedAt || image.uploaded_at || image.createdAt || image.created_at || new Date().toISOString(),
    category: image.category || 'job',
    createdAt: image.createdAt || image.created_at || new Date().toISOString()
  };
}

export async function saveEditedJobImageCopy(job, sourceImage, editedFile, editMetadata = {}) {
  if (!job || !sourceImage || !editedFile) {
    return null;
  }

  const normalizedJob = normalizePhotoJob(job);
  const savedAt = new Date().toISOString();

  if (!hasSupabaseConfig || !supabase) {
    const image = {
      id: crypto.randomUUID(),
      jobId: normalizedJob.id,
      url: await readFileAsDataUrl(editedFile),
      fileName: editedFile.name,
      name: editedFile.name,
      originalFileName: editedFile.name,
      uploadedAt: savedAt,
      category: 'edited',
      createdAt: savedAt,
      originalSizeBytes: editedFile.size || 0,
      optimizedSizeBytes: editedFile.size || 0,
      mimeType: editedFile.type || 'image/png',
      width: Number(editMetadata.width || 0),
      height: Number(editMetadata.height || 0),
      optimizationVersion: 'photo-editor-v1'
    };
    const savedJob = await updateJob({ ...normalizedJob, images: [...(normalizedJob.images || []), image] });
    logImageUploaded(savedJob || normalizedJob, image);
    return { job: savedJob, image };
  }

  const jobId = normalizedJob.id;
  const fileName = makeEditedImageFileName(sourceImage, 'edited');
  const filePath = `${jobId}/edited/${fileName}`;
  const shopId = requirePhotoShopId(normalizedJob.shopId);
  await uploadPhotoObjectWithQuota({
    shopId,
    bucket: JOB_IMAGES_BUCKET,
    path: filePath,
    file: editedFile,
    usageKind: 'photo_derivative',
    uploadOptions: {
      contentType: editedFile.type || 'image/png',
      cacheControl: '31536000'
    }
  });

  const imageUrl = await createJobImageSignedUrl(filePath);
  const image = {
    id: crypto.randomUUID(),
    jobId,
    url: imageUrl,
    fileName,
    name: fileName,
    storagePath: filePath,
    originalFileName: fileName,
    storedFileName: fileName,
    uploadedAt: savedAt,
    category: 'edited',
    createdAt: savedAt,
    originalSizeBytes: editedFile.size || 0,
    optimizedSizeBytes: editedFile.size || 0,
    mimeType: editedFile.type || 'image/png',
    width: Number(editMetadata.width || 0),
    height: Number(editMetadata.height || 0),
    optimizationVersion: 'photo-editor-v1'
  };

  const { error: dbError } = await supabase.from('job_images').insert({
    id: image.id,
    job_id: jobId,
    url: '',
    public_url: '',
    storage_path: image.storagePath,
    file_name: image.fileName,
    stored_filename: image.storedFileName,
    original_filename: image.originalFileName,
    original_size_bytes: image.originalSizeBytes,
    optimized_size_bytes: image.optimizedSizeBytes,
    mime_type: image.mimeType,
    width: image.width,
    height: image.height,
    optimization_version: image.optimizationVersion,
    uploaded_at: image.uploadedAt,
    category: image.category,
    created_at: image.createdAt
  });

  if (dbError) {
    await removeSettledPhotoObjectSafe({ shopId, bucket: JOB_IMAGES_BUCKET, path: filePath });
    throw new Error(`Edited image record failed: ${dbError.message}`);
  }

  await insertPhotoDerivativeSafe({
    shopId,
    jobId,
    sourcePhotoId: sourceImage.id,
    derivativeType: derivePhotoDerivativeType(editMetadata),
    storagePath: filePath,
    editMetadata
  });

  const savedJob = await updateJob({ ...normalizedJob, images: [...(normalizedJob.images || []), image] });
  logImageUploaded(savedJob || normalizedJob, image);
  return { job: savedJob, image };
}

export async function overwriteJobImage(job, sourceImage, editedFile, editMetadata = {}) {
  if (!job || !sourceImage || !editedFile) {
    return null;
  }

  const normalizedJob = normalizePhotoJob(job);
  const savedAt = new Date().toISOString();

  if (!hasSupabaseConfig || !supabase) {
    const updatedImage = {
      ...sourceImage,
      url: await readFileAsDataUrl(editedFile),
      fileName: editedFile.name,
      name: editedFile.name,
      originalFileName: sourceImage.originalFileName || sourceImage.fileName || editedFile.name,
      uploadedAt: savedAt,
      updatedAt: savedAt,
      originalSizeBytes: editedFile.size || 0,
      optimizedSizeBytes: editedFile.size || 0,
      mimeType: editedFile.type || 'image/png',
      width: Number(editMetadata.width || sourceImage.width || 0),
      height: Number(editMetadata.height || sourceImage.height || 0),
      optimizationVersion: 'photo-editor-v1'
    };
    const savedJob = await updateJob({
      ...normalizedJob,
      images: (normalizedJob.images || []).map((image) => (image.id === sourceImage.id ? updatedImage : image))
    });
    return { job: savedJob, image: updatedImage };
  }

  const jobId = normalizedJob.id;
  const backupStoragePath = getJobImageStoragePath(sourceImage);
  const fileName = makeEditedImageFileName(sourceImage, 'overwrite');
  const filePath = `${jobId}/edited/${fileName}`;
  const shopId = requirePhotoShopId(normalizedJob.shopId);
  await uploadPhotoObjectWithQuota({
    shopId,
    bucket: JOB_IMAGES_BUCKET,
    path: filePath,
    file: editedFile,
    usageKind: 'source_photo',
    uploadOptions: {
      contentType: editedFile.type || 'image/png',
      cacheControl: '31536000'
    }
  });

  const imageUrl = await createJobImageSignedUrl(filePath);
  const updatedImage = {
    ...sourceImage,
    url: imageUrl,
    storagePath: filePath,
    fileName,
    name: fileName,
    storedFileName: fileName,
    uploadedAt: savedAt,
    originalSizeBytes: editedFile.size || 0,
    optimizedSizeBytes: editedFile.size || 0,
    mimeType: editedFile.type || 'image/png',
    width: Number(editMetadata.width || sourceImage.width || 0),
    height: Number(editMetadata.height || sourceImage.height || 0),
    optimizationVersion: 'photo-editor-v1'
  };

  const { error: dbError } = await supabase
    .from('job_images')
    .update({
      storage_path: updatedImage.storagePath,
      file_name: updatedImage.fileName,
      stored_filename: updatedImage.storedFileName,
      original_size_bytes: updatedImage.originalSizeBytes,
      optimized_size_bytes: updatedImage.optimizedSizeBytes,
      mime_type: updatedImage.mimeType,
      width: updatedImage.width,
      height: updatedImage.height,
      optimization_version: updatedImage.optimizationVersion,
      uploaded_at: updatedImage.uploadedAt
    })
    .eq('id', sourceImage.id)
    .eq('job_id', jobId);

  if (dbError) {
    await removeSettledPhotoObjectSafe({ shopId, bucket: JOB_IMAGES_BUCKET, path: filePath });
    throw new Error(`Edited image record failed: ${dbError.message}`);
  }

  await insertPhotoDerivativeSafe({
    shopId,
    jobId,
    sourcePhotoId: sourceImage.id,
    derivativeType: 'edited',
    storagePath: filePath,
    editMetadata: {
      ...editMetadata,
      saveMode: 'overwrite',
      backupStoragePath
    }
  });

  const savedJob = await updateJob({
    ...normalizedJob,
    images: (normalizedJob.images || []).map((image) => (image.id === sourceImage.id ? updatedImage : image))
  });
  if (backupStoragePath && backupStoragePath !== filePath) {
    await removeSettledPhotoObjectSafe({
      shopId,
      bucket: JOB_IMAGES_BUCKET,
      path: backupStoragePath
    });
  }
  return { job: savedJob, image: updatedImage };
}

async function uploadPhotoObjectWithQuota({
  shopId,
  bucket,
  path,
  file,
  usageKind,
  uploadOptions,
  requestId = crypto.randomUUID()
}) {
  await reservePhotoUsage({
    shopId,
    requestId,
    usageKind,
    expectedStorageBytes: file.size,
    bucket,
    path
  });

  let uploaded = false;
  try {
    const { error } = await supabase.storage
      .from(bucket)
      .upload(path, file, uploadOptions);
    if (error) {
      throw error;
    }
    uploaded = true;
    await settlePhotoUsage({ shopId, requestId });
  } catch (error) {
    if (uploaded) {
      await supabase.storage.from(bucket).remove([path]);
    }
    await releasePhotoUsageReservation({ shopId, requestId }).catch((releaseError) => {
      console.error('Photo quota reservation release failed.', releaseError);
    });
    throw error;
  }
}

async function removeSettledPhotoObjectSafe({ shopId, bucket, path }) {
  if (!path) {
    return;
  }
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) {
    console.error('Photo storage cleanup failed.', error);
    return;
  }
  try {
    await releaseDeletedPhotoStorage({ shopId, bucket, path });
  } catch (releaseError) {
    console.error('Photo storage usage release failed.', releaseError);
  }
}

function requirePhotoShopId(shopId) {
  const value = String(shopId || '').trim();
  if (!value) {
    throw new Error('An explicit shop is required for photo storage.');
  }
  return value;
}

function imageMetadataToObject(metadata = {}) {
  return {
    storedFileName: metadata.storedFileName || '',
    originalSizeBytes: Number(metadata.originalSizeBytes || 0),
    optimizedSizeBytes: Number(metadata.optimizedSizeBytes || 0),
    mimeType: metadata.mimeType || '',
    width: Number(metadata.width || 0),
    height: Number(metadata.height || 0),
    optimizationVersion: metadata.optimizationVersion || ''
  };
}

function makeJobImageFileName(job, uploadId) {
  const jobNumber = safeStorageFileName(job?.jobNumber || job?.id || 'job').replace(/\.[^.]+$/, '');
  return `job-${jobNumber}-${safeStorageFileName(uploadId)}.jpg`;
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
      storagePath: image.storagePath || '',
      originalSizeBytes: image.originalSizeBytes || 0,
      optimizedSizeBytes: image.optimizedSizeBytes || 0,
      optimizationVersion: image.optimizationVersion || ''
    }
  });
}

function makeEditedImageFileName(sourceImage, prefix = 'edited') {
  const timestamp = compactTimestamp(new Date());
  const baseName = safeStorageFileName(sourceImage?.fileName || sourceImage?.name || sourceImage?.id || 'photo').replace(/\.[^.]+$/, '');
  return `${prefix}-${baseName}-${timestamp}.png`;
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

async function insertPhotoDerivativeSafe({
  shopId,
  jobId,
  sourcePhotoId,
  derivativeType,
  storagePath,
  editMetadata
}) {
  if (!hasSupabaseConfig || !supabase) {
    return;
  }

  try {
    const { error } = await supabase.from('photo_derivatives').insert({
      shop_id: shopId || '',
      job_id: jobId,
      source_photo_id: sourcePhotoId || null,
      derivative_type: derivativeType || 'edited',
      storage_path: storagePath || '',
      public_url: '',
      edit_metadata: editMetadata || {},
    });
    if (error) {
      console.warn('Photo derivative metadata insert failed.', error);
    }
  } catch (error) {
    console.warn('Photo derivative metadata insert failed.', error);
  }
}

function derivePhotoDerivativeType(editMetadata = {}) {
  const tools = new Set(editMetadata.toolsUsed || []);
  if (tools.has('background')) {
    return 'background_removed';
  }
  if (tools.has('crop')) {
    return 'cropped';
  }
  if (tools.has('pen') || tools.has('arrow') || tools.has('circle') || tools.has('rectangle') || tools.has('text')) {
    return 'annotated';
  }
  return 'edited';
}
