import UnsavedChangesBadge from '../../shared/components/UnsavedChangesBadge.jsx';
import { money } from '../../shared/utils/money';
import { getInventoryBarcodeLabel } from './inventoryFormatting.js';
import {
  PURCHASE_UNIT_OPTIONS,
  purchaseConversionSummary,
  purchaseUnitLabel
} from './purchaseUnits';

export default function InventoryPartEditor({
  selectedPart,
  partForm,
  vendors,
  vendorsById,
  categoryOptions,
  locationOptions,
  canWrite,
  isSaving,
  isDirty,
  saveStatus,
  partImagePreviewUrl,
  partImageFile,
  receiveForm,
  adjustForm,
  moneyOptions,
  onPartFormChange,
  onPartImageChange,
  onSavePart,
  onGenerateBarcodeCode,
  onResetPart,
  onDeactivatePart,
  onReceiveFormChange,
  onReceive,
  onAdjustFormChange,
  onAdjust
}) {
  return (
    <div className="inventory-editor">
      <form onSubmit={onSavePart}>
        <div className="editor-heading">
          <h3>{selectedPart ? 'Edit Part' : 'Add Part'}</h3>
          {(isDirty || saveStatus === 'saving' || saveStatus === 'error') && (
            <UnsavedChangesBadge
              state={saveStatus}
              reminder={isDirty ? 'Remember to save before leaving.' : ''}
            />
          )}
        </div>
        <div className="form-grid">
          <label>Vendor
            <select disabled={!canWrite} value={partForm.vendorId} onChange={(event) => onPartFormChange('vendorId', event.target.value)}>
              <option value="">No vendor</option>
              {vendors.map((vendor) => (
                <option key={vendor.id} value={vendor.id}>{vendor.name}</option>
              ))}
            </select>
          </label>
          <label>Part Name<input disabled={!canWrite} value={partForm.name} onChange={(event) => onPartFormChange('name', event.target.value)} required /></label>
          <label>Part Number<input disabled={!canWrite} value={partForm.partNumber} onChange={(event) => onPartFormChange('partNumber', event.target.value)} /></label>
          <label>Category
            <select disabled={!canWrite} value={partForm.category} onChange={(event) => onPartFormChange('category', event.target.value)}>
              <option value="">No category</option>
              {categoryOptions.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </label>
          <label>Location
            <select disabled={!canWrite} value={partForm.location} onChange={(event) => onPartFormChange('location', event.target.value)}>
              <option value="">No location</option>
              {locationOptions.map((location) => (
                <option key={location} value={location}>{location}</option>
              ))}
            </select>
          </label>
          <label>Description<input disabled={!canWrite} value={partForm.description} onChange={(event) => onPartFormChange('description', event.target.value)} /></label>
          <label>Vendor SKU<input disabled={!canWrite} value={partForm.supplier} onChange={(event) => onPartFormChange('supplier', event.target.value)} /></label>
          <label>Vendor UPC<input disabled={!canWrite} value={partForm.vendorSku} onChange={(event) => onPartFormChange('vendorSku', event.target.value)} /></label>
          <label>Barcode<input disabled={!canWrite} value={partForm.barcodeCode} onChange={(event) => onPartFormChange('barcodeCode', event.target.value)} /></label>
          <label>Manufacturer<input disabled={!canWrite} value={partForm.manufacturer} onChange={(event) => onPartFormChange('manufacturer', event.target.value)} /></label>
          <label>Manufacturer UPC<input disabled={!canWrite} value={partForm.sku} onChange={(event) => onPartFormChange('sku', event.target.value)} /></label>
          <label>Purchase Unit
            <select disabled={!canWrite} value={partForm.purchaseUnit} onChange={(event) => onPartFormChange('purchaseUnit', event.target.value)}>
              {PURCHASE_UNIT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label>Units per Purchase Unit
            <input
              disabled={!canWrite}
              type="number"
              min="1"
              max="999999"
              step="1"
              value={partForm.unitsPerPurchaseUnit}
              onChange={(event) => onPartFormChange('unitsPerPurchaseUnit', event.target.value)}
            />
          </label>
          {canWrite && (
            <label>Price for One Whole {purchaseUnitLabel(partForm.purchaseUnit)}
              <input type="number" min="0" step="0.01" value={partForm.purchaseUnitCost} onChange={(event) => onPartFormChange('purchaseUnitCost', event.target.value)} />
              <small>Enter the vendor price for the complete package. FretTrack calculates the inventory-each cost.</small>
            </label>
          )}
          <label>Retail Price<input disabled={!canWrite} type="number" min="0" step="0.01" value={partForm.retailPrice} onChange={(event) => onPartFormChange('retailPrice', event.target.value)} /></label>
          <label>QTY On Hand<input disabled={!canWrite} type="number" step="1" value={partForm.quantityOnHand} onChange={(event) => onPartFormChange('quantityOnHand', event.target.value)} /></label>
          <label>Reorder Point<input disabled={!canWrite} type="number" min="0" step="1" value={partForm.reorderPoint} onChange={(event) => onPartFormChange('reorderPoint', event.target.value)} /></label>
          <div className="inventory-stock-policy-field">
            <label>Desired Stock
              <input
                disabled={!canWrite || partForm.specialOrder}
                type="number"
                min="0"
                step="1"
                value={partForm.specialOrder ? '0' : partForm.desiredStockLevel}
                onChange={(event) => onPartFormChange('desiredStockLevel', event.target.value)}
              />
              {partForm.specialOrder && <small>Special order parts are not treated as stocked items.</small>}
            </label>
            <label className="table-checkbox">
              <input
                disabled={!canWrite}
                type="checkbox"
                checked={partForm.specialOrder}
                onChange={(event) => onPartFormChange('specialOrder', event.target.checked)}
              />
              Special Order Part
            </label>
          </div>
        </div>
        <label className="inventory-image-field">
          Part Image
          <input disabled={!canWrite} type="file" accept="image/*" onChange={onPartImageChange} />
          <small>Must already be 300x300 px or smaller. FretTrack will reject larger images and will not resize or compress.</small>
        </label>
        {(partImagePreviewUrl || selectedPart?.imagePath || partImageFile) && (
          <div className="inventory-part-image-preview">
            {partImagePreviewUrl ? (
              <img src={partImagePreviewUrl} alt={`${selectedPart?.name || partForm.name || 'Part'} preview`} />
            ) : (
              <span>{partImageFile ? partImageFile.name : 'Part image saved.'}</span>
            )}
            {selectedPart?.imageWidth && selectedPart?.imageHeight && (
              <small>{selectedPart.imageWidth}x{selectedPart.imageHeight} px</small>
            )}
          </div>
        )}
        {selectedPart && (
          <div className="inventory-meta-grid">
            <span>Barcode label <strong><code>{getInventoryBarcodeLabel(selectedPart)}</code></strong></span>
            <span>Vendor <strong>{vendorsById.get(selectedPart.vendorId)?.name || '-'}</strong></span>
            <span>Vendor UPC <strong>{selectedPart.vendorSku || '-'}</strong></span>
            <span>Location <strong>{selectedPart.location || '-'}</strong></span>
            <span>On hand <strong>{selectedPart.quantityOnHand}</strong></span>
            <span>Purchase conversion <strong>{purchaseUnitLabel(selectedPart.purchaseUnit)} × {selectedPart.unitsPerPurchaseUnit} Each</strong></span>
            <span>Reorder point <strong>{selectedPart.reorderPoint}</strong></span>
            <span>Desired stock <strong>{selectedPart.specialOrder ? 'Special order' : selectedPart.desiredStockLevel}</strong></span>
            <span>Last cost <strong>{selectedPart.lastCost === null ? '-' : money(selectedPart.lastCost, moneyOptions)}</strong></span>
            <span>Average cost <strong>{selectedPart.averageCost === null ? '-' : money(selectedPart.averageCost, moneyOptions)}</strong></span>
          </div>
        )}
        {selectedPart && !selectedPart.barcodeCode && canWrite && (
          <div className="mode-actions">
            <button type="button" onClick={onGenerateBarcodeCode} disabled={isSaving}>Generate Barcode</button>
          </div>
        )}
        <label className="table-checkbox">
          <input disabled={!canWrite} type="checkbox" checked={partForm.isActive} onChange={(event) => onPartFormChange('isActive', event.target.checked)} />
          Active
        </label>
        {canWrite && (
          <div className="mode-actions">
            <button type="submit" className="primary-action" disabled={isSaving}>{isSaving ? 'Saving...' : selectedPart ? 'Save Changes' : 'Save Part'}</button>
            {selectedPart && <button type="button" onClick={onResetPart} disabled={isSaving}>Cancel</button>}
            {selectedPart && <button type="button" onClick={onDeactivatePart} disabled={isSaving}>Deactivate</button>}
          </div>
        )}
      </form>

      {selectedPart && canWrite && (
        <div className="inventory-stock-actions">
          <form onSubmit={onReceive}>
            <h3>Receive Stock</h3>
            <p className="muted-text">
              Enter purchase units. {purchaseConversionSummary(receiveForm.quantity || 0, selectedPart.purchaseUnit, selectedPart.unitsPerPurchaseUnit)}
            </p>
            <div className="row-form">
              <input aria-label="Purchase quantity" type="number" min="1" step="1" placeholder={`Qty (${purchaseUnitLabel(selectedPart.purchaseUnit, 2)})`} value={receiveForm.quantity} onChange={(event) => onReceiveFormChange('quantity', event.target.value)} />
              <input aria-label="Cost per purchase unit" type="number" min="0" step="0.01" placeholder={`Cost per ${purchaseUnitLabel(selectedPart.purchaseUnit)}`} value={receiveForm.cost} onChange={(event) => onReceiveFormChange('cost', event.target.value)} />
              <input placeholder="Note" value={receiveForm.note} onChange={(event) => onReceiveFormChange('note', event.target.value)} />
              <button type="submit" disabled={isSaving}>Receive</button>
            </div>
          </form>
          <form onSubmit={onAdjust}>
            <h3>Adjust Stock</h3>
            <div className="row-form">
              <input type="number" step="1" placeholder="+/- Qty" value={adjustForm.quantityDelta} onChange={(event) => onAdjustFormChange('quantityDelta', event.target.value)} />
              <input placeholder="Reason" value={adjustForm.note} onChange={(event) => onAdjustFormChange('note', event.target.value)} />
              <button type="submit" disabled={isSaving}>Adjust</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
