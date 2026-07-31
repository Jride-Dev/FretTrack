import { money } from '../../shared/utils/money.js';
import { purchaseUnitLabel } from './purchaseUnits.js';
import { formatInventoryDateTime, formatInventoryStatus } from './inventoryFormatting.js';

export default function InventoryHistoryTab({ selectedPart, partPurchaseHistory, purchaseHistory, partMovements, moneyOptions }) {
  const visiblePurchaseHistory = selectedPart ? partPurchaseHistory : purchaseHistory;

  return (
    <div className="inventory-history-grid">
      <section className="inventory-editor">
        <h3>{selectedPart ? `Purchase History: ${selectedPart.name}` : 'Purchase History'}</h3>
        <table>
          <thead>
            <tr>
              <th>Date</th><th>Part</th><th>Vendor</th><th>PO</th><th>Receipt</th>
              <th>Purchase Qty</th><th>Inventory Qty</th><th>Purchase Unit Cost</th>
              <th>Shipping Allocated</th><th>Landed Inventory Unit Cost</th><th>Total Landed Cost</th>
              <th>Received By</th><th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {visiblePurchaseHistory.map((row) => (
              <tr key={row.id}>
                <td>{formatInventoryDateTime(row.receivedAt)}</td>
                <td>{row.partName || row.description || '-'}</td>
                <td>{row.vendorName || '-'}</td>
                <td>{row.poNumber || 'Manual'}</td>
                <td>{row.receiptNumber || '-'}</td>
                <td>{row.quantityReceived} {purchaseUnitLabel(row.purchaseUnit, row.quantityReceived)}</td>
                <td>{row.inventoryQuantityReceived}</td>
                <td>{money(row.baseUnitCost ?? row.unitCost, moneyOptions)}</td>
                <td>{row.shippingAllocated ? money(row.shippingAllocated, moneyOptions) : '-'}</td>
                <td>{money(row.landedUnitCost ?? row.unitCost, moneyOptions)}</td>
                <td>{money(row.totalLandedCost ?? row.totalCost ?? row.quantityReceived * row.unitCost, moneyOptions)}</td>
                <td>{row.receivedBy ? `${row.receivedBy.slice(0, 8)}...` : '-'}</td>
                <td>{row.receiptNotes || '-'}</td>
              </tr>
            ))}
            {!visiblePurchaseHistory.length && <tr><td colSpan="13">No purchase receipts yet.</td></tr>}
          </tbody>
        </table>
      </section>

      <section className="inventory-editor">
        {selectedPart ? (
          <>
            <h3>Stock Movements: {selectedPart.name}</h3>
            <table>
              <thead><tr><th>Type</th><th>Qty</th><th>Cost</th><th>Note</th><th>Date</th></tr></thead>
              <tbody>
                {partMovements.map((movement) => (
                  <tr key={movement.id}>
                    <td>{formatInventoryStatus(movement.movementType)}</td>
                    <td>{movement.quantity}</td>
                    <td>{movement.unitCost === null ? '-' : money(movement.unitCost, moneyOptions)}</td>
                    <td>{movement.note || '-'}</td>
                    <td>{formatInventoryDateTime(movement.createdAt)}</td>
                  </tr>
                ))}
                {!partMovements.length && <tr><td colSpan="5">No stock movements yet.</td></tr>}
              </tbody>
            </table>
          </>
        ) : (
          <p className="muted-text">Select a part from the Parts tab to view stock movement history for that specific item.</p>
        )}
      </section>
    </div>
  );
}
