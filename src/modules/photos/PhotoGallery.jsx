import useJobImageUrl from './useJobImageUrl.js';
import { getPhotoUnavailableMessage } from './photoState.js';

function PhotoGalleryItem({
  canDelete,
  canEdit,
  canToggleCustomerReport,
  image,
  workOrderImageIds,
  onDelete,
  onEdit,
  onWorkOrderToggle
}) {
  const { displayUrl, isResolving, retry } = useJobImageUrl(image);
  const isOnWorkOrder = workOrderImageIds.includes(image.id);

  return (
    <div className="image-tile">
      {displayUrl ? (
        <a href={displayUrl} target="_blank" rel="noreferrer">
          <img
            src={displayUrl}
            alt={image.name || 'Job upload'}
            onError={() => retry()}
          />
        </a>
      ) : isResolving ? (
        <div className="photo-missing-warning">Loading stored photo...</div>
      ) : (
        <div className="photo-missing-warning">
          {getPhotoUnavailableMessage(image)}
        </div>
      )}
      <div className="image-actions no-print">
        {canEdit && (
          <button type="button" onClick={() => onEdit?.({ ...image, url: displayUrl })} disabled={!displayUrl}>
            Edit Photo
          </button>
        )}
        {!canEdit && (
          <span className="locked-feature-chip">Photo Editor - Available in Pro</span>
        )}
        {canToggleCustomerReport && (
          <button
            type="button"
            disabled={!displayUrl && !isOnWorkOrder}
            onClick={() => onWorkOrderToggle(image.id, !isOnWorkOrder)}
          >
            {isOnWorkOrder ? 'Remove from Customer Report' : 'Use in Customer Report'}
          </button>
        )}
        {displayUrl && (
          <a href={displayUrl} download={image.fileName || image.name || 'job-photo'}>
            Download
          </a>
        )}
      </div>
      {canToggleCustomerReport && (
        <label className="image-print-toggle no-print">
          <input
            type="checkbox"
            checked={isOnWorkOrder}
            disabled={!displayUrl && !isOnWorkOrder}
            onChange={(event) => onWorkOrderToggle(image.id, event.target.checked)}
          />
          Add Pictures to Work Order
        </label>
      )}
      {canDelete && (
        <button
          type="button"
          className="image-delete no-print"
          onClick={() => onDelete(image)}
          aria-label={`Delete ${image.name || 'job image'}`}
          title="Delete image"
        >
          Delete
        </button>
      )}
    </div>
  );
}

export default function PhotoGallery({
  canDelete = true,
  canEdit = true,
  canToggleCustomerReport = true,
  images = [],
  workOrderImageIds = [],
  onDelete,
  onEdit,
  onWorkOrderToggle
}) {
  return (
    <div className="image-grid">
      {images.map((image) => (
        <PhotoGalleryItem
          key={image.id}
          canDelete={canDelete}
          canEdit={canEdit}
          canToggleCustomerReport={canToggleCustomerReport}
          image={image}
          workOrderImageIds={workOrderImageIds}
          onDelete={onDelete}
          onEdit={onEdit}
          onWorkOrderToggle={onWorkOrderToggle}
        />
      ))}
    </div>
  );
}
