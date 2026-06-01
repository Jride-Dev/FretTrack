function normalizePercent(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 50;
  }
  return Math.max(0, Math.min(100, numeric));
}

export default function PrintDamageMap({ title, view = {} }) {
  const imageUrl = view.imageUrl || '';
  const marks = Array.isArray(view.marks) ? view.marks : [];

  if (!imageUrl && marks.length === 0) {
    return null;
  }

  return (
    <section className="print-damage-view print-section">
      <h3>{title}</h3>

      {imageUrl ? (
        <div className="print-damage-canvas-wrap">
          <figure className="print-damage-canvas" aria-label={`${title} diagram`}>
            <img src={imageUrl} alt={`${title} diagram`} />
            <span className="print-damage-marker-layer" aria-hidden="true">
              {marks.map((mark, index) => (
                <span
                  key={mark.id || `${title}-mark-${index + 1}`}
                  className="print-damage-marker"
                  style={{
                    left: `${normalizePercent(mark.x)}%`,
                    top: `${normalizePercent(mark.y)}%`
                  }}
                >
                  {index + 1}
                </span>
              ))}
            </span>
          </figure>
        </div>
      ) : (
        <p className="print-damage-missing">No diagram image available for this view.</p>
      )}

      <p className="print-damage-caption">Damage items marked on the image are listed below.</p>
      {marks.length > 0 ? (
        <ol className="print-damage-list">
          {marks.map((mark, index) => (
            <li key={mark.id || `${title}-list-${index + 1}`}>
              <strong>{mark.area || 'Damage item'}</strong>
              {mark.note ? ` - ${mark.note}` : ''}
              {mark.recommendedRepair ? ` | Repair: ${mark.recommendedRepair}` : ''}
            </li>
          ))}
        </ol>
      ) : (
        <p className="print-damage-empty">No damage markers recorded.</p>
      )}
    </section>
  );
}
