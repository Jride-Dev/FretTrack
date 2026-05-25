import PhotoGallery from '../photos/PhotoGallery.jsx';
import PhotoUploader from '../photos/PhotoUploader.jsx';

export default function ImagesSection({
  handleImageChange,
  handleImageDelete,
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
      <PhotoUploader inputRef={imageImportInputRef} onChange={handleImageChange} isImporting={isImportingImages} />
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
        images={images}
        workOrderImageIds={workOrderImageIds}
        onDelete={handleImageDelete}
        onWorkOrderToggle={updateWorkOrderImage}
      />
    </section>
  );
}
