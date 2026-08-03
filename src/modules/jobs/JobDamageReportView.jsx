import { markerColorForReport } from './jobDetailFormatting.js';

const damageViewLabels = {
  front: 'Front',
  back: 'Back',
  headstock: 'Headstock',
  serial_number: 'Serial Number'
};

export default function JobDamageReportView({ damageMap = {}, viewName }) {
  const view = damageMap.views?.[viewName] || { marks: [] };
  const imageUrl = view.imageUrl || '';
  const hasBaseImage = Boolean(imageUrl || view.storagePath || view.imageId);
  const marks = view.marks || [];
  const title = `${damageViewLabels[viewName] || 'Damage'} Damage Map`;

  if (!hasBaseImage && marks.length === 0) {
    return null;
  }

  return (
    <div className="report-damage-view">
      <h3>{title}</h3>
      {hasBaseImage && imageUrl ? (
        <div className="report-damage-canvas">
          <img src={imageUrl} alt={`${viewName} damage map`} />
          {marks.map((mark, index) => (
            <span
              key={mark.id}
              className="damage-marker"
              style={{ left: `${mark.x}%`, top: `${mark.y}%`, backgroundColor: markerColorForReport(mark.severity) }}
            >
              {index + 1}
            </span>
          ))}
        </div>
      ) : (
        <p className="report-damage-missing">No damage map image was attached.</p>
      )}
      {hasBaseImage && imageUrl && marks.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Area</th>
              <th>Severity</th>
              <th>Note</th>
              <th>Recommended Repair</th>
            </tr>
          </thead>
          <tbody>
            {marks.map((mark, index) => (
              <tr key={mark.id}>
                <td>{index + 1}</td>
                <td>{mark.area}</td>
                <td>{mark.severity}</td>
                <td>{mark.note}</td>
                <td>{mark.recommendedRepair}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
