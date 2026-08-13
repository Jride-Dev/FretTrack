export function mergeUploadedJobImages(currentJob, uploadedJob) {
  if (!uploadedJob?.images) {
    return currentJob;
  }

  return {
    ...currentJob,
    images: uploadedJob.images
  };
}

export function findUploadedJobImage({ beforeImages = [], uploadedImages = [], category = '', originalFileName = '' } = {}) {
  const existingIds = new Set(beforeImages.map((image) => image.id));
  const newImages = uploadedImages.filter((image) => !existingIds.has(image.id));

  return newImages.find((image) => image.category === category && image.originalFileName === originalFileName)
    || newImages.find((image) => image.category === category)
    || null;
}

export function getPhotoUnavailableMessage(image = {}) {
  return image.storagePath || image.storage_path
    ? 'Photo unavailable. Could not load from storage.'
    : 'Photo unavailable. Storage path missing.';
}
