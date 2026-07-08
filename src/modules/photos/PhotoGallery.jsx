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
        <div key={image.id} className="image-tile">
          {image.url ? (
            <a href={image.url} target="_blank" rel="noreferrer">
              <img src={image.url} alt={image.name || 'Job upload'} />
            </a>
          ) : (
            <div className="photo-missing-warning">
              Photo unavailable. Storage path missing.
            </div>
          )}
          <div className="image-actions no-print">
            {canEdit && (
              <button type="button" onClick={() => onEdit?.(image)} disabled={!image.url}>
                Edit Photo
              </button>
            )}
            {!canEdit && (
              <span className="locked-feature-chip">Photo Editor - Available in Pro</span>
            )}
            {canToggleCustomerReport && (
              <button
                type="button"
                disabled={!image.url && !workOrderImageIds.includes(image.id)}
                onClick={() => onWorkOrderToggle(image.id, !workOrderImageIds.includes(image.id))}
              >
                {workOrderImageIds.includes(image.id) ? 'Remove from Customer Report' : 'Use in Customer Report'}
              </button>
            )}
            {image.url && (
              <a href={image.url} download={image.fileName || image.name || 'job-photo'}>
                Download
              </a>
            )}
          </div>
          {canToggleCustomerReport && (
            <label className="image-print-toggle no-print">
              <input
                type="checkbox"
                checked={workOrderImageIds.includes(image.id)}
                disabled={!image.url && !workOrderImageIds.includes(image.id)}
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
      ))}
    </div>
  );
}
