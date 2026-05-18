import { money } from '../shared/utils/money';
import { getShopMoneyOptions } from '../modules/shops/shopConfig';

function margin(row) {
  const quantity = Number(row.quantity || 1);
  return ((Number(row.retail) || 0) - (Number(row.cost) || 0)) * quantity;
}

function retailTotal(row) {
  return (Number(row.retail) || 0) * (Number(row.quantity || 1));
}

export default function PartsList({ parts, part, setPart, onAddPart, onUpdatePart }) {
  const moneyOptions = getShopMoneyOptions();
  return (
    <section>
      <h3>Parts</h3>
      <form className="row-form price-form" onSubmit={onAddPart}>
        <input placeholder="Name" value={part.name} onChange={(event) => setPart((current) => ({ ...current, name: event.target.value }))} />
        <input type="number" min="0" step="0.01" placeholder="Qty" value={part.quantity} onChange={(event) => setPart((current) => ({ ...current, quantity: event.target.value }))} />
        <input type="number" min="0" step="0.01" placeholder="Cost" value={part.cost} onChange={(event) => setPart((current) => ({ ...current, cost: event.target.value }))} />
        <input type="number" min="0" step="0.01" placeholder="Retail" value={part.retail} onChange={(event) => setPart((current) => ({ ...current, retail: event.target.value }))} />
        <button type="submit">Add Part</button>
      </form>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Qty</th>
            <th className="internal-only">Cost</th>
            <th className="internal-only">Margin</th>
            <th>Included</th>
            <th>Retail Total</th>
          </tr>
        </thead>
        <tbody>
          {parts.map((row) => (
            <tr key={row.id}>
              <td>
                <input value={row.name} onChange={(event) => onUpdatePart(row.id, 'name', event.target.value)} />
              </td>
              <td>
                <input type="number" min="0" step="0.01" value={row.quantity || 1} onChange={(event) => onUpdatePart(row.id, 'quantity', event.target.value)} />
              </td>
              <td className="internal-only">
                <input type="number" min="0" step="0.01" value={row.cost} onChange={(event) => onUpdatePart(row.id, 'cost', event.target.value)} />
              </td>
              <td className="internal-only">{money(margin(row), moneyOptions)}</td>
              <td>
                <label className="table-checkbox">
                  <input
                    type="checkbox"
                    checked={Boolean(row.includedInService)}
                    onChange={(event) => onUpdatePart(row.id, 'includedInService', event.target.checked)}
                  />
                  Service
                </label>
              </td>
              <td>
                <input type="number" min="0" step="0.01" value={row.retail} onChange={(event) => onUpdatePart(row.id, 'retail', event.target.value)} />
                <strong>{row.includedInService ? 'Included' : money(retailTotal(row), moneyOptions)}</strong>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
