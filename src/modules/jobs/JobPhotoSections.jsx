import ImagesSection from '../images/ImagesSection';

export default function JobPhotoSections({
  canDeletePhotos,
  canEditPhotos,
  canUploadPhotos,
  canWrite,
  imageImportErrors,
  imageImportInputRef,
  imageOptimizationNotices,
  images,
  isImportingImages,
  onImageChange,
  onImageDelete,
  onImageEdit,
  onWorkOrderImageToggle,
  workOrderImageIds
}) {
  return (
    <ImagesSection
      canWrite={canWrite}
      canUploadPhotos={canUploadPhotos}
      canEditPhotos={canEditPhotos}
      canDeletePhotos={canDeletePhotos}
      handleImageChange={onImageChange}
      handleImageDelete={onImageDelete}
      handleImageEdit={onImageEdit}
      imageImportErrors={imageImportErrors}
      imageOptimizationNotices={imageOptimizationNotices}
      imageImportInputRef={imageImportInputRef}
      images={images}
      isImportingImages={isImportingImages}
      updateWorkOrderImage={onWorkOrderImageToggle}
      workOrderImageIds={workOrderImageIds}
    />
  );
}
