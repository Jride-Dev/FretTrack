import { useRef, useState } from 'react';
import { overwriteJobImage, saveEditedJobImageCopy } from '../photos/photoService';
import { mergeUploadedJobImages } from '../photos/photoState.js';
import {
  buildAppendImagePreviewsJob,
  buildRemoveImageJob,
  buildWorkOrderImageIdsPatch,
  findNewDamageViewImage
} from './jobDetailFormatting.js';

export default function useJobPhotoController({
  canDeletePhotos,
  canEditPhotos,
  canOverwritePhotos,
  canUploadPhotos,
  canWrite,
  draftJob,
  onImageDelete,
  onImageUpload,
  onNotice,
  onRefresh,
  patchJob,
  setDraftJob,
  setIsDirty,
  workOrderImageIds
}) {
  const [imageImportErrors, setImageImportErrors] = useState([]);
  const [imageOptimizationNotices, setImageOptimizationNotices] = useState([]);
  const [isImportingImages, setIsImportingImages] = useState(false);
  const [photoEditorImage, setPhotoEditorImage] = useState(null);
  const [isSavingEditedPhoto, setIsSavingEditedPhoto] = useState(false);
  const imageImportInputRef = useRef(null);

  async function handleImageChange(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!canUploadPhotos) {
      onNotice?.({ type: 'error', message: 'Your shop role cannot upload photos.' });
      return;
    }
    if (!files.length) {
      return;
    }

    const previews = files
      .filter((file) => file.type.startsWith('image/') && !/\.(heic|heif)$/i.test(file.name))
      .map((file) => ({
        id: `preview-${crypto.randomUUID()}`,
        jobId: draftJob.id,
        url: URL.createObjectURL(file),
        fileName: file.name,
        name: file.name,
        originalFileName: file.name,
        category: 'job',
        uploadedAt: new Date().toISOString(),
        createdAt: new Date().toISOString()
      }));

    if (previews.length) {
      setIsDirty(true);
      setDraftJob((current) => buildAppendImagePreviewsJob(current, previews));
    }

    setImageImportErrors([]);
    setImageOptimizationNotices([]);
    setIsImportingImages(true);
    try {
      const result = await onImageUpload(draftJob, files);
      if (result?.job) {
        setDraftJob(result.job);
        setIsDirty(false);
      }
      setImageImportErrors(result?.errors || []);
      setImageOptimizationNotices(result?.optimizationNotices || []);
    } finally {
      setIsImportingImages(false);
    }
  }

  async function handleDamageViewImageUpload(viewName, file, uploadOptions = {}) {
    if (!canUploadPhotos) {
      onNotice?.({ type: 'error', message: 'Your shop role cannot upload photos.' });
      return null;
    }
    const category = uploadOptions.category || `damage-map-${viewName}`;
    const existingImageIds = new Set((draftJob.images || []).map((image) => image.id));
    const result = await onImageUpload(draftJob, [file], { category, skipRefresh: true });
    if (result?.errors?.length) {
      const uploadError = new Error(result.errors[0].message || 'Damage photo upload failed.');
      uploadError.code = result.errors[0].code || '';
      throw uploadError;
    }
    if (result?.job) {
      const uploadedImages = result.job.images || [];
      setDraftJob((current) => mergeUploadedJobImages(current, result.job));
      return findNewDamageViewImage(uploadedImages, existingImageIds, category, file.name);
    }
    return null;
  }

  function handleImageDelete(image) {
    if (!canDeletePhotos) {
      onNotice?.({ type: 'error', message: 'Your shop role cannot delete photos.' });
      return;
    }
    if (!window.confirm('Delete this image from the job?')) {
      return;
    }
    setDraftJob((current) => buildRemoveImageJob(current, image.id));
    setIsDirty(true);
    onImageDelete(draftJob, image);
  }

  function handleImageEdit(image) {
    if (!canEditPhotos) {
      onNotice?.({ type: 'error', message: 'Photo Editor is available in Pro.' });
      return;
    }
    setPhotoEditorImage(image);
  }

  async function saveEditedPhotoCopy(file, editMetadata) {
    if (!canEditPhotos) {
      onNotice?.({ type: 'error', message: 'Your shop role cannot edit photos.' });
      return;
    }
    setIsSavingEditedPhoto(true);
    try {
      const result = await saveEditedJobImageCopy(draftJob, photoEditorImage, file, editMetadata);
      if (result?.job) {
        setDraftJob(result.job);
        setIsDirty(false);
      }
      setPhotoEditorImage(null);
      onNotice?.({ type: 'success', message: 'Edited photo saved as a copy.' });
      if (onRefresh) {
        await onRefresh();
      }
    } catch (error) {
      console.error('Edited photo save failed.', error);
      onNotice?.({ type: 'error', message: error instanceof Error ? error.message : 'Edited photo save failed.' });
    } finally {
      setIsSavingEditedPhoto(false);
    }
  }

  async function overwriteEditedPhoto(file, editMetadata) {
    if (!canOverwritePhotos) {
      onNotice?.({ type: 'error', message: 'Your shop role cannot overwrite photos.' });
      return;
    }
    setIsSavingEditedPhoto(true);
    try {
      const result = await overwriteJobImage(draftJob, photoEditorImage, file, editMetadata);
      if (result?.job) {
        setDraftJob(result.job);
        setIsDirty(false);
      }
      setPhotoEditorImage(null);
      onNotice?.({ type: 'success', message: 'Original photo was overwritten with the edited PNG.' });
      if (onRefresh) {
        await onRefresh();
      }
    } catch (error) {
      console.error('Edited photo overwrite failed.', error);
      onNotice?.({ type: 'error', message: error instanceof Error ? error.message : 'Edited photo overwrite failed.' });
    } finally {
      setIsSavingEditedPhoto(false);
    }
  }

  function updateWorkOrderImage(imageId, checked) {
    if (!canWrite) {
      return;
    }
    patchJob(buildWorkOrderImageIdsPatch(draftJob, workOrderImageIds, imageId, checked));
  }

  return {
    handleDamageViewImageUpload,
    handleImageChange,
    handleImageDelete,
    handleImageEdit,
    imageImportErrors,
    imageImportInputRef,
    imageOptimizationNotices,
    isImportingImages,
    isSavingEditedPhoto,
    overwriteEditedPhoto,
    photoEditorImage,
    saveEditedPhotoCopy,
    setPhotoEditorImage,
    updateWorkOrderImage
  };
}
