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
          <a href={image.url} target="_blank" rel="noreferrer">
            <img src={image.url} alt={image.name || 'Job upload'} />
          </a>
          <div className="image-actions no-print">
            {canEdit && (
              <button type="button" onClick={() => onEdit?.(image)}>
                Edit Photo
              </button>
            )}
            {!canEdit && (
              <span className="locked-feature-chip">Photo Editor - Available on Pro</span>
            )}
            {canToggleCustomerReport && (
              <button
                type="button"
                onClick={() => onWorkOrderToggle(image.id, !workOrderImageIds.includes(image.id))}
              >
                {workOrderImageIds.includes(image.id) ? 'Remove from Customer Report' : 'Use in Customer Report'}
              </button>
            )}
            <a href={image.url} download={image.fileName || image.name || 'job-photo'}>
              Download
            </a>
          </div>
          {canToggleCustomerReport && (
            <label className="image-print-toggle no-print">
              <input
                type="checkbox"
                checked={workOrderImageIds.includes(image.id)}
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
