import { money } from '../shared/utils/money';
import { getShopMoneyOptions } from '../modules/shops/shopConfig';

function margin(row) {
  const quantity = Number(row.quantity || 1);
  return ((Number(row.retail) || 0) - (Number(row.cost) || 0)) * quantity;
}

function retailTotal(row) {
  return (Number(row.retail) || 0) * (Number(row.quantity || 1));
}

export default function PartsList({
  parts,
  part,
  setPart,
  onAddPart,
  onUpdatePart,
  onRemovePart,
  canWrite = true,
  inventoryParts = [],
  inventorySearch = '',
  setInventorySearch,
  onSearchInventoryParts,
  onAddInventoryPart,
  isInventoryLoading = false
}) {
  const moneyOptions = getShopMoneyOptions();
  return (
    <section>
      <h3>Parts</h3>
      {canWrite && onAddInventoryPart && (
        <form className="row-form price-form inventory-picker-form" onSubmit={onSearchInventoryParts}>
          <input
            placeholder="Search inventory by name, SKU, category, or supplier"
            value={inventorySearch}
            onChange={(event) => setInventorySearch(event.target.value)}
          />
          <button type="submit" disabled={isInventoryLoading}>{isInventoryLoading ? 'Searching...' : 'Search'}</button>
          {inventoryParts.length > 0 && (
            <select
              defaultValue=""
              onChange={(event) => {
                const selectedPart = inventoryParts.find((item) => item.id === event.target.value);
                if (selectedPart) {
                  onAddInventoryPart(selectedPart, 1);
                  event.target.value = '';
                }
              }}
            >
              <option value="">Add inventory part...</option>
              {inventoryParts.map((inventoryPart) => (
                <option key={inventoryPart.id} value={inventoryPart.id}>
                  {inventoryPart.sku ? `${inventoryPart.sku} - ` : ''}{inventoryPart.name} ({inventoryPart.quantityOnHand} on hand, {money(inventoryPart.retailPrice, moneyOptions)})
                </option>
              ))}
            </select>
          )}
        </form>
      )}
      <form className="row-form price-form" onSubmit={onAddPart}>
        <input disabled={!canWrite} placeholder="Part name or description" value={part.name} onChange={(event) => setPart((current) => ({ ...current, name: event.target.value }))} />
        <input disabled={!canWrite} type="number" min="0" step="0.01" placeholder="Qty" value={part.quantity} onChange={(event) => setPart((current) => ({ ...current, quantity: event.target.value }))} />
        <input disabled={!canWrite} type="number" min="0" step="0.01" placeholder="Unit cost" value={part.cost} onChange={(event) => setPart((current) => ({ ...current, cost: event.target.value }))} />
        <input disabled={!canWrite} type="number" min="0" step="0.01" placeholder="Unit price" value={part.retail} onChange={(event) => setPart((current) => ({ ...current, retail: event.target.value }))} />
        <button type="submit" disabled={!canWrite}>Add Part</button>
      </form>
      <table>
        <thead>
          <tr>
            <th>SKU</th>
            <th>Name</th>
            <th>Qty</th>
            {canWrite && <th className="internal-only">Cost</th>}
            {canWrite && <th className="internal-only">Margin</th>}
            <th>Included</th>
            <th>Retail Total</th>
            <th className="no-print">Actions</th>
          </tr>
        </thead>
        <tbody>
          {parts.map((row) => (
            <tr key={row.id}>
              <td>{row.sku || '-'}</td>
              <td>
                <input disabled={!canWrite} value={row.name} onChange={(event) => onUpdatePart(row.id, 'name', event.target.value)} />
              </td>
              <td>
                <input disabled={!canWrite} type="number" min="0" step="0.01" value={row.quantity || 1} onChange={(event) => onUpdatePart(row.id, 'quantity', event.target.value)} />
              </td>
              {canWrite && (
                <td className="internal-only">
                  <input disabled={!canWrite} type="number" min="0" step="0.01" value={row.cost} onChange={(event) => onUpdatePart(row.id, 'cost', event.target.value)} />
                </td>
              )}
              {canWrite && <td className="internal-only">{money(margin(row), moneyOptions)}</td>}
              <td>
                <label className="table-checkbox">
                  <input
                    disabled={!canWrite}
                    type="checkbox"
                    checked={Boolean(row.includedInService)}
                    onChange={(event) => onUpdatePart(row.id, 'includedInService', event.target.checked)}
                  />
                  Service
                </label>
              </td>
              <td>
                <input disabled={!canWrite} type="number" min="0" step="0.01" value={row.retail} onChange={(event) => onUpdatePart(row.id, 'retail', event.target.value)} />
                <strong>{row.includedInService ? 'Included' : money(retailTotal(row), moneyOptions)}</strong>
              </td>
              <td className="no-print">
                <button type="button" className="row-remove" onClick={() => onRemovePart(row.id)} disabled={!canWrite}>Remove</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
