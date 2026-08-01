import { money } from '../../shared/utils/money';
import { formatInventoryDate, formatInventoryStatus } from './inventoryFormatting.js';
import { purchaseOrderTotals, remainingForPurchaseOrderItem } from './purchaseOrderCalculations.js';
import { PURCHASE_UNIT_OPTIONS, purchaseConversionSummary, purchaseUnitLabel } from './purchaseUnits.js';

export default function InventoryPurchaseOrderEditor({
  purchaseOrderForm,
  selectedPurchaseOrder,
  vendors,
  vendorsById,
  parts,
  statusOptions,
  canWrite,
  isSaving,
  purchaseReceiveQuantities,
  purchaseReceiveCosts,
  purchaseReceiveNote,
  moneyOptions,
  onPurchaseOrderFormChange,
  onAddItem,
  onUpdateItem,
  onRemoveItem,
  onSavePurchaseOrder,
  onCloseDetail,
  onStatusChange,
  onReceiveQuantityChange,
  onReceiveCostChange,
  onReceiveNoteChange,
  onReceive
}) {
  return (
    <div className="inventory-editor">
      <form onSubmit={onSavePurchaseOrder}>
        <h3>New Purchase Order</h3>
        <div className="form-grid">
          <label>Vendor
            <select disabled={!canWrite} value={purchaseOrderForm.vendorId} onChange={(event) => onPurchaseOrderFormChange('vendorId', event.target.value)}>
              <option value="">No vendor</option>
              {vendors.filter((vendor) => vendor.isActive).map((vendor) => (
                <option key={vendor.id} value={vendor.id}>{vendor.name}</option>
              ))}
            </select>
          </label>
          <label>Status
            <select disabled={!canWrite} value={purchaseOrderForm.status} onChange={(event) => onPurchaseOrderFormChange('status', event.target.value)}>
              {statusOptions.map((status) => (
                <option key={status} value={status}>{formatInventoryStatus(status)}</option>
              ))}
            </select>
          </label>
          <label>Ordered<input disabled={!canWrite} type="date" value={purchaseOrderForm.orderedAt} onChange={(event) => onPurchaseOrderFormChange('orderedAt', event.target.value)} /></label>
          <label>Expected<input disabled={!canWrite} type="date" value={purchaseOrderForm.expectedAt} onChange={(event) => onPurchaseOrderFormChange('expectedAt', event.target.value)} /></label>
          <label>Shipping Cost<input disabled={!canWrite} type="number" min="0" step="0.01" value={purchaseOrderForm.shippingCost} onChange={(event) => onPurchaseOrderFormChange('shippingCost', event.target.value)} /></label>
          <label>Notes<input disabled={!canWrite} value={purchaseOrderForm.notes} onChange={(event) => onPurchaseOrderFormChange('notes', event.target.value)} /></label>
        </div>
        <label className="table-checkbox">
          <input disabled={!canWrite} type="checkbox" checked={purchaseOrderForm.addShippingToCost} onChange={(event) => onPurchaseOrderFormChange('addShippingToCost', event.target.checked)} />
          Add shipping to cost
        </label>
        <p className="muted-text">Use this for inbound vendor shipping. Customer/outbound shipping is planned separately.</p>

        <div className="inventory-subsection">
          <div className="editor-heading">
            <h4>Items</h4>
            {canWrite && <button type="button" onClick={onAddItem}>Add Item</button>}
          </div>
          <p className="muted-text">Choose an existing part, or leave the selector on Create new inventory part. New PO items are added to inventory with quantity 0 until received.</p>
          {purchaseOrderForm.items.map((item, index) => (
            <div className="purchase-order-item-block" key={`${index}-${item.partId || 'manual'}`}>
              <div className="purchase-order-item-row">
                <select disabled={!canWrite} value={item.partId} onChange={(event) => onUpdateItem(index, 'partId', event.target.value)}>
                  <option value="">Create new inventory part</option>
                  {parts.filter((part) => part.isActive).map((part) => (
                    <option key={part.id} value={part.id}>{part.name}</option>
                  ))}
                </select>
                <input disabled={!canWrite} placeholder="Description" value={item.description} onChange={(event) => onUpdateItem(index, 'description', event.target.value)} />
                <input disabled={!canWrite} placeholder="Vendor UPC" value={item.vendorSku} onChange={(event) => onUpdateItem(index, 'vendorSku', event.target.value)} />
                <input aria-label="Purchase quantity" disabled={!canWrite} type="number" min="1" step="1" placeholder="Purchase qty" value={item.quantityOrdered} onChange={(event) => onUpdateItem(index, 'quantityOrdered', event.target.value)} />
                <select aria-label="Purchase unit" disabled={!canWrite || Boolean(item.partId)} value={item.purchaseUnit} onChange={(event) => onUpdateItem(index, 'purchaseUnit', event.target.value)}>
                  {PURCHASE_UNIT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                <input aria-label="Units per purchase unit" disabled={!canWrite || Boolean(item.partId)} type="number" min="1" max="999999" step="1" placeholder="Units each" value={item.unitsPerPurchaseUnit} onChange={(event) => onUpdateItem(index, 'unitsPerPurchaseUnit', event.target.value)} />
                <input aria-label="Cost per purchase unit" disabled={!canWrite} type="number" min="0" step="0.01" placeholder={`Cost per ${purchaseUnitLabel(item.purchaseUnit)}`} value={item.unitCost} onChange={(event) => onUpdateItem(index, 'unitCost', event.target.value)} />
                {canWrite && <button type="button" onClick={() => onRemoveItem(index)}>Remove</button>}
              </div>
              <small className="purchase-conversion-summary">{purchaseConversionSummary(item.quantityOrdered || 0, item.purchaseUnit, item.unitsPerPurchaseUnit)}</small>
            </div>
          ))}
        </div>
        {canWrite && (
          <div className="mode-actions">
            <button type="submit" className="primary-action" disabled={isSaving}>{isSaving ? 'Saving...' : 'Create PO'}</button>
          </div>
        )}
      </form>

      {selectedPurchaseOrder && (
        <form className="inventory-stock-actions" onSubmit={onReceive}>
          <div className="editor-heading">
            <h3>Receive {selectedPurchaseOrder.poNumber}</h3>
            <div className="mode-actions no-print">
              <span className={`status-pill ${selectedPurchaseOrder.status === 'received' ? 'success' : selectedPurchaseOrder.status === 'cancelled' ? 'muted' : 'warning'}`}>{formatInventoryStatus(selectedPurchaseOrder.status)}</span>
              <button type="button" onClick={onCloseDetail}>Close Detail</button>
            </div>
          </div>
          <PurchaseOrderSummary purchaseOrder={selectedPurchaseOrder} vendorsById={vendorsById} moneyOptions={moneyOptions} />
          {canWrite && (
            <div className="mode-actions">
              <button type="button" onClick={() => onStatusChange('ordered')} disabled={isSaving || selectedPurchaseOrder.status === 'cancelled' || selectedPurchaseOrder.status === 'received'}>Mark Ordered</button>
              <button type="button" onClick={() => onStatusChange('cancelled')} disabled={isSaving || selectedPurchaseOrder.status === 'cancelled' || selectedPurchaseOrder.status === 'received'}>Cancel PO</button>
            </div>
          )}
          <div className="inventory-receive-list">
            {(selectedPurchaseOrder.items || []).map((item) => {
              const remaining = remainingForPurchaseOrderItem(item);
              return (
                <div className="receive-item-row" key={item.id}>
                  <span>
                    <strong>{item.description}</strong>
                    <small>{item.vendorSku || 'No vendor UPC'} - ordered {item.quantityOrdered} - received {item.quantityReceived} - remaining {remaining} {purchaseUnitLabel(item.purchaseUnit, remaining)}</small>
                    <small>{purchaseConversionSummary(item.quantityOrdered, item.purchaseUnit, item.unitsPerPurchaseUnit)}</small>
                    {Number(purchaseReceiveQuantities[item.id] || 0) > 0 && (
                      <small>Receiving: {purchaseConversionSummary(purchaseReceiveQuantities[item.id], item.purchaseUnit, item.unitsPerPurchaseUnit)}</small>
                    )}
                  </span>
                  <input
                    disabled={!canWrite || remaining <= 0 || selectedPurchaseOrder.status === 'cancelled'}
                    type="number"
                    min="0"
                    max={remaining}
                    step="1"
                    aria-label={`Receive purchase quantity in ${purchaseUnitLabel(item.purchaseUnit, 2)}`}
                    placeholder={`Receive ${purchaseUnitLabel(item.purchaseUnit, 2)}`}
                    value={purchaseReceiveQuantities[item.id] ?? ''}
                    onChange={(event) => onReceiveQuantityChange(item.id, event.target.value)}
                  />
                  <input
                    disabled={!canWrite || remaining <= 0 || selectedPurchaseOrder.status === 'cancelled'}
                    type="number"
                    min="0"
                    step="0.01"
                    aria-label={`Cost per ${purchaseUnitLabel(item.purchaseUnit)}`}
                    placeholder={`Cost per ${purchaseUnitLabel(item.purchaseUnit)}`}
                    value={purchaseReceiveCosts[item.id] ?? ''}
                    onChange={(event) => onReceiveCostChange(item.id, event.target.value)}
                  />
                </div>
              );
            })}
          </div>
          <input disabled={!canWrite} placeholder="Receipt note" value={purchaseReceiveNote} onChange={(event) => onReceiveNoteChange(event.target.value)} />
          {canWrite && (
            <div className="mode-actions">
              <button type="submit" className="primary-action" disabled={isSaving || selectedPurchaseOrder.status === 'cancelled'}>{isSaving ? 'Receiving...' : 'Receive Selected'}</button>
            </div>
          )}
        </form>
      )}
    </div>
  );
}

function PurchaseOrderSummary({ purchaseOrder, vendorsById, moneyOptions }) {
  const totals = purchaseOrderTotals(purchaseOrder);
  return (
    <div className="inventory-meta-grid">
      <span>Vendor <strong>{vendorsById.get(purchaseOrder.vendorId)?.name || '-'}</strong></span>
      <span>Ordered <strong>{formatInventoryDate(purchaseOrder.orderedAt)}</strong></span>
      <span>Expected <strong>{formatInventoryDate(purchaseOrder.expectedAt)}</strong></span>
      <span>Received <strong>{formatInventoryDate(purchaseOrder.latestReceivedAt)}</strong></span>
      <span>Line count <strong>{totals.lineCount}</strong></span>
      <span>Purchase units ordered <strong>{totals.ordered}</strong></span>
      <span>Purchase units received <strong>{totals.received}</strong></span>
      <span>Purchase units remaining <strong>{totals.remaining}</strong></span>
      <span>Inventory units ordered <strong>{totals.inventoryOrdered}</strong></span>
      <span>Inventory units received <strong>{totals.inventoryReceived}</strong></span>
      <span>Inventory units remaining <strong>{totals.inventoryRemaining}</strong></span>
      <span>Item subtotal <strong>{money(totals.itemSubtotal, moneyOptions)}</strong></span>
      <span>Shipping cost <strong>{money(totals.shippingCost, moneyOptions)}</strong></span>
      <span>Estimated total <strong>{money(totals.estimatedTotal, moneyOptions)}</strong></span>
      <span>Add shipping to cost <strong>{purchaseOrder.addShippingToCost ? 'Yes' : 'No'}</strong></span>
      <span>Received subtotal <strong>{money(totals.receivedSubtotal, moneyOptions)}</strong></span>
      <span>Allocated shipping <strong>{money(totals.allocatedShipping, moneyOptions)}</strong></span>
      <span>Landed received total <strong>{money(totals.landedReceivedTotal, moneyOptions)}</strong></span>
    </div>
  );
}
