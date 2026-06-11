import PhotoGallery from '../photos/PhotoGallery.jsx';
import PhotoUploader from '../photos/PhotoUploader.jsx';

export default function ImagesSection({
  canWrite = true,
  canUploadPhotos = canWrite,
  canEditPhotos = canWrite,
  canDeletePhotos = canWrite,
  handleImageChange,
  handleImageDelete,
  handleImageEdit,
  imageImportErrors,
  imageOptimizationNotices = [],
  imageImportInputRef,
  images,
  isImportingImages,
  updateWorkOrderImage,
  workOrderImageIds
}) {
  return (
    <section>
      <h3>Images</h3>
      {canUploadPhotos ? (
        <PhotoUploader inputRef={imageImportInputRef} onChange={handleImageChange} isImporting={isImportingImages} />
      ) : (
        <p className="muted-text no-print">Viewer role can view photos but cannot upload, edit, overwrite, or delete them.</p>
      )}
      {imageOptimizationNotices.length > 0 && (
        <div className="import-notices no-print">
          {imageOptimizationNotices.map((notice) => (
            <p key={`${notice.fileName}-${notice.message}`}>{notice.message}</p>
          ))}
        </div>
      )}
      {imageImportErrors.length > 0 && (
        <div className="import-errors no-print">
          {imageImportErrors.map((error) => (
            <p key={`${error.fileName}-${error.message}`}>{error.fileName}: {error.message}</p>
          ))}
        </div>
      )}
      <PhotoGallery
        canDelete={canDeletePhotos}
        canEdit={canEditPhotos}
        canToggleCustomerReport={canWrite}
        images={images}
        workOrderImageIds={workOrderImageIds}
        onDelete={handleImageDelete}
        onEdit={handleImageEdit}
        onWorkOrderToggle={updateWorkOrderImage}
      />
    </section>
  );
}
