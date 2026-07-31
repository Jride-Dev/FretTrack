import { money } from '../../shared/utils/money';
import { getInventoryBarcodeLabel } from './inventoryFormatting.js';

export default function InventoryPartsList({
  parts,
  selectedPartId,
  selectedLabelPartIds,
  search,
  showInactive,
  lowStockOnly,
  isLoading,
  moneyOptions,
  onSearchChange,
  onShowInactiveChange,
  onLowStockOnlyChange,
  onSearch,
  onSelectPart,
  onToggleLabelPart,
  onSelectVisibleLabelParts,
  onClearLabelParts,
  onPreviewLabels,
  children
}) {
  return (
    <>
      <form className="row-form inventory-search" onSubmit={onSearch}>
        <input
          placeholder="Search name, manufacturer UPC, barcode, vendor SKU, vendor UPC, category, or vendor"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
        />
        <label className="table-checkbox">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(event) => onShowInactiveChange(event.target.checked)}
          />
          Show inactive
        </label>
        <label className="table-checkbox">
          <input
            type="checkbox"
            checked={lowStockOnly}
            onChange={(event) => onLowStockOnlyChange(event.target.checked)}
          />
          Low stock only
        </label>
        <button type="submit" disabled={isLoading}>{isLoading ? 'Searching...' : 'Search'}</button>
      </form>

      <div className="inventory-label-toolbar">
        <span>{selectedLabelPartIds.length} label part{selectedLabelPartIds.length === 1 ? '' : 's'} selected</span>
        <button type="button" onClick={onSelectVisibleLabelParts}>Select visible with barcodes</button>
        <button type="button" onClick={onClearLabelParts}>Clear labels</button>
        <button type="button" className="primary-action" onClick={onPreviewLabels}>Preview Labels</button>
      </div>

      <div className="inventory-layout">
        <div className="inventory-table-wrap">
          <table>
          <thead>
            <tr>
              <th>Label</th>
              <th>UPC</th>
              <th>Name</th>
              <th>Barcode</th>
              <th>On hand</th>
              <th>Reorder</th>
              <th>Desired</th>
              <th>Retail</th>
              <th>Location</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {parts.map((part) => {
              const isLowStock = !part.specialOrder && part.quantityOnHand <= part.reorderPoint;
              return (
                <tr
                  key={part.id}
                  className={`${selectedPartId === part.id ? 'selected-row' : ''}${part.isActive ? '' : ' inactive-row'}`}
                  onClick={() => onSelectPart(part)}
                >
                  <td onClick={(event) => event.stopPropagation()}>
                    <input
                      aria-label={`Select ${part.name} barcode label`}
                      disabled={!part.barcodeCode}
                      type="checkbox"
                      checked={selectedLabelPartIds.includes(part.id)}
                      onChange={(event) => onToggleLabelPart(part.id, event.target.checked)}
                    />
                  </td>
                  <td>{part.sku || '-'}</td>
                  <td><strong>{part.name}</strong></td>
                  <td><code>{getInventoryBarcodeLabel(part)}</code></td>
                  <td>{part.quantityOnHand}</td>
                  <td>{part.reorderPoint}</td>
                  <td>{part.specialOrder ? '-' : part.desiredStockLevel}</td>
                  <td>{money(part.retailPrice, moneyOptions)}</td>
                  <td>{part.location || '-'}</td>
                  <td>
                    <span className={`status-pill ${part.isActive ? (isLowStock ? 'warning' : 'success') : 'muted'}`}>
                      {part.isActive ? (part.specialOrder ? 'Special order' : isLowStock ? 'Low stock' : 'Active') : 'Inactive'}
                    </span>
                  </td>
                </tr>
              );
            })}
            {!parts.length && (
              <tr>
                <td colSpan="10">{isLoading ? 'Loading parts...' : 'No parts found.'}</td>
              </tr>
            )}
          </tbody>
          </table>
        </div>
        {children}
      </div>
    </>
  );
}
