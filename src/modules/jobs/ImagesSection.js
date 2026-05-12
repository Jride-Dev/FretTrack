import PhotoGallery from '../photos/PhotoGallery.jsx';
import PhotoUploader from '../photos/PhotoUploader.jsx';

export default function ImagesSection({
  handleImageChange,
  handleImageDelete,
  imageImportErrors,
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
