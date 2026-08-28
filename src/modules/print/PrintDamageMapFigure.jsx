const VIEW_LABELS = {
  front: 'Front',
  back: 'Back',
  headstock: 'Headstock',
  serial_number: 'Serial Number'
};

function clampPercent(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(100, numeric));
}

function severityClass(severity) {
  const normalized = String(severity || 'Cosmetic').trim().toLowerCase();
  if (normalized === 'critical') return 'is-critical';
  if (normalized === 'structural') return 'is-structural';
  return 'is-cosmetic';
}

export default function PrintDamageMapFigure({ damageMap = {}, viewName }) {
  const view = damageMap.views?.[viewName] || {};
  const marks = Array.isArray(view.marks) ? view.marks : [];
  const imageUrl = String(view.imageUrl || '').trim();
  const hasBaseImage = Boolean(imageUrl || view.storagePath || view.imageId);

  if (!hasBaseImage && marks.length === 0) {
    return null;
  }

  const title = `${VIEW_LABELS[viewName] || 'Condition'} condition map`;

  return (
    <section className="print-damage-map-section" data-damage-view={viewName}>
      <h3>{title}</h3>
      {imageUrl ? (
        <div className="print-damage-map-visual">
          <div className="print-damage-map-stage">
            <img src={imageUrl} alt={`${VIEW_LABELS[viewName] || viewName} condition reference`} decoding="sync" />
            <div className="print-damage-marker-layer" aria-hidden="true">
              {marks.map((mark, index) => (
                <span
                  key={mark.id || `${viewName}-${index}`}
                  className={`print-damage-marker ${severityClass(mark.severity)}`}
                  data-marker-number={index + 1}
                  style={{ left: `${clampPercent(mark.x)}%`, top: `${clampPercent(mark.y)}%` }}
                >
                  {index + 1}
                </span>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <p className="print-damage-map-missing">A condition image was recorded, but it is not currently available for this report.</p>
      )}

      {imageUrl && marks.length > 0 && (
        <table className="print-document-table print-damage-table">
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">Area</th>
              <th scope="col">Severity</th>
              <th scope="col">Observation</th>
              <th scope="col">Recommended repair</th>
            </tr>
          </thead>
          <tbody>
            {marks.map((mark, index) => (
              <tr key={mark.id || `${viewName}-row-${index}`}>
                <td>{index + 1}</td>
                <td>{mark.area || '-'}</td>
                <td>{mark.severity || '-'}</td>
                <td>{mark.note || '-'}</td>
                <td>{mark.recommendedRepair || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
