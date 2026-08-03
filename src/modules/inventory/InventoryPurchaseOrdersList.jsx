import { money } from '../../shared/utils/money';
import { formatInventoryDate, formatInventoryStatus } from './inventoryFormatting.js';
import { purchaseOrderTotals } from './purchaseOrderCalculations.js';

export default function InventoryPurchaseOrdersList({
  purchaseOrders,
  selectedPurchaseOrderId,
  statusFilter,
  statusOptions,
  vendorsById,
  moneyOptions,
  onStatusFilterChange,
  onSelectPurchaseOrder,
  children
}) {
  return (
    <div className="inventory-layout inventory-layout-wide">
      <div className="inventory-table-wrap">
        <div className="inventory-label-toolbar">
          <label>Filter
            <select value={statusFilter} onChange={(event) => onStatusFilterChange(event.target.value)}>
              {statusOptions.map((status) => (
                <option key={status} value={status}>{status === 'all' ? 'All' : formatInventoryStatus(status)}</option>
              ))}
            </select>
          </label>
        </div>
        <table>
          <thead>
            <tr>
              <th>PO</th>
              <th>Vendor</th>
              <th>Status</th>
              <th>Ordered</th>
              <th>Expected</th>
              <th>Received</th>
              <th>Lines</th>
              <th>Purchase Qty</th>
              <th>Purchase Remaining</th>
              <th>Inventory Qty</th>
              <th>Item Subtotal</th>
              <th>Shipping</th>
              <th>Est. Total</th>
              <th>Receipts</th>
            </tr>
          </thead>
          <tbody>
            {purchaseOrders.map((order) => {
              const totals = purchaseOrderTotals(order);
              return (
                <tr
                  key={order.id}
                  className={selectedPurchaseOrderId === order.id ? 'selected-row' : ''}
                  onClick={() => onSelectPurchaseOrder(order)}
                >
                  <td><strong>{order.poNumber}</strong></td>
                  <td>{vendorsById.get(order.vendorId)?.name || '-'}</td>
                  <td><span className={`status-pill ${order.status === 'received' ? 'success' : order.status === 'cancelled' ? 'muted' : 'warning'}`}>{formatInventoryStatus(order.status)}</span></td>
                  <td>{formatInventoryDate(order.orderedAt)}</td>
                  <td>{formatInventoryDate(order.expectedAt)}</td>
                  <td>{formatInventoryDate(order.latestReceivedAt)}</td>
                  <td>{totals.lineCount}</td>
                  <td>{totals.received} / {totals.ordered}</td>
                  <td>{totals.remaining}</td>
                  <td>{totals.inventoryReceived} / {totals.inventoryOrdered}</td>
                  <td>{money(totals.itemSubtotal, moneyOptions)}</td>
                  <td>{money(totals.shippingCost, moneyOptions)}</td>
                  <td>{money(totals.estimatedTotal, moneyOptions)}</td>
                  <td>{order.receiptCount || 0}</td>
                </tr>
              );
            })}
            {!purchaseOrders.length && (
              <tr><td colSpan="14">No purchase orders found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {children}
    </div>
  );
}
