import BarcodeLabelSheet from './BarcodeLabelSheet.jsx';

export default function InventoryLabelsTab({ selectedLabelParts, labelPreset, onSelectParts, onPrintLabels }) {
  const presetLabel = labelPreset === 'shipping_4x6'
    ? '4 x 6 thermal shipping label'
    : labelPreset === 'letter'
      ? 'Letter / plain paper'
      : '2.25 x 1.25 parts/bin label';

  return (
    <div className="inventory-label-panel">
      <section className="inventory-editor">
        <div className="editor-heading">
          <h3>Barcode Labels</h3>
          <div className="mode-actions">
            <button type="button" onClick={onSelectParts}>Select Parts</button>
            <button type="button" onClick={onPrintLabels} className="primary-action" disabled={!selectedLabelParts.length}>Print Labels</button>
          </div>
        </div>
        <p className="muted-text">Labels use stable barcode identity only. Prices, quantities, and other mutable stock data are not encoded.</p>
        <p className="muted-text">Current printer preset: {presetLabel}.</p>
        <BarcodeLabelSheet parts={selectedLabelParts} labelPreset={labelPreset} />
      </section>
    </div>
  );
}
