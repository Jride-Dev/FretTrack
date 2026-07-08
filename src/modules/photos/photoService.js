import { optimizeImageForStorage, readFileAsDataUrl } from '../../services/imageProcessing';
import { hasSupabaseConfig, supabase } from '../../shared/lib/supabaseClient';
import { ensureRemoteJob, getLocalJobs, saveLocalJobs, updateJob } from '../jobs/jobService';
import { logJobEventSafe } from '../jobs/jobEventsService';
import { getCurrentShopId } from '../shops/shopConfig';
import { createJobImageSignedUrl, getJobImageStoragePath } from './photoUrls';

export async function uploadJobImages(job, files, options = {}) {
  const fileList = Array.from(files || []);
  const errors = [];
  const optimizationNotices = [];
  let currentJob = normalizePhotoJob(job);

  for (let index = 0; index < fileList.length; index += 1) {
    try {
      const savedImageResult = await uploadJobImage(currentJob, fileList[index], {
        ...options,
        index: index + 1
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
      id: crypto.randomUUID(),
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

  const storedFileName = makeJobImageFileName(normalizedJob, options.index || 1);
  const filePath = `${jobId}/${storedFileName}`;

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

  const imageUrl = await createJobImageSignedUrl(filePath);

  const image = {
    id: crypto.randomUUID(),
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
    console.error('Image database insert failed.', dbError);
    throw new Error(`Image uploaded, but database photo record failed: ${dbError.message}`);
  }

  if (job) {
    const savedJob = await updateJob({ ...normalizedJob, images: [...(normalizedJob.images || []), image] });
    logImageUploaded(savedJob || normalizedJob, image);
    return { job: savedJob, optimizationNotice: optimization.notice };
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

  const { error: uploadError } = await supabase.storage
    .from('job-images')
    .upload(filePath, editedFile, {
      contentType: editedFile.type || 'image/png',
      cacheControl: '31536000'
    });

  if (uploadError) {
    throw new Error(`Edited image upload failed: ${uploadError.message}`);
  }

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
    throw new Error(`Edited image record failed: ${dbError.message}`);
  }

  await insertPhotoDerivativeSafe({
    shopId: normalizedJob.shopId || getCurrentShopId(),
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

  const { error: uploadError } = await supabase.storage
    .from('job-images')
    .upload(filePath, editedFile, {
      contentType: editedFile.type || 'image/png',
      cacheControl: '31536000'
    });

  if (uploadError) {
    throw new Error(`Edited image upload failed: ${uploadError.message}`);
  }

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
    throw new Error(`Edited image record failed: ${dbError.message}`);
  }

  await insertPhotoDerivativeSafe({
    shopId: normalizedJob.shopId || getCurrentShopId(),
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
  return { job: savedJob, image: updatedImage };
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
