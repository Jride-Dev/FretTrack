export default function PhotoGallery({ images = [], workOrderImageIds = [], onDelete, onWorkOrderToggle }) {
  return (
    <div className="image-grid">
      {images.map((image) => (
        <div key={image.id} className="image-tile">
          <a href={image.url} target="_blank" rel="noreferrer">
            <img src={image.url} alt={image.name || 'Job upload'} />
          </a>
          <label className="image-print-toggle no-print">
              <input
                type="checkbox"
                checked={workOrderImageIds.includes(image.id)}
                onChange={(event) => onWorkOrderToggle(image.id, event.target.checked)}
              />
              Add Pictures to Work Order
          </label>
          <button
            type="button"
            className="image-delete no-print"
            onClick={() => onDelete(image)}
            aria-label={`Delete ${image.name || 'job image'}`}
            title="Delete image"
          >
            Delete
          </button>
        </div>
      ))}
    </div>
  );
}
