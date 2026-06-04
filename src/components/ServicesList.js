import { servicePresets } from '../data/servicePresets';
import { money } from '../shared/utils/money';
import { getShopMoneyOptions } from '../modules/shops/shopConfig';

function margin(row) {
  const quantity = Number(row.quantity || 1);
  return ((Number(row.retail) || 0) - (Number(row.cost) || 0)) * quantity;
}

function retailTotal(row) {
  return (Number(row.retail) || 0) * (Number(row.quantity || 1));
}

export default function ServicesList({ services, service, setService, onAddService, onUpdateService, onRemoveService, canWrite = true }) {
  const moneyOptions = getShopMoneyOptions();
  function applyPreset(event) {
    if (!canWrite) {
      return;
    }
    const preset = servicePresets.find((item) => item.name === event.target.value);
    if (!preset) {
      return;
    }

    setService((current) => ({
      ...current,
      description: preset.description,
      cost: String(preset.cost),
      retail: String(preset.retail)
    }));
    event.target.value = '';
  }

  return (
    <section>
      <h3>Services</h3>
      <label className="service-preset no-print">
        Service Preset
        <select defaultValue="" onChange={applyPreset} disabled={!canWrite}>
          <option value="">Add Service Preset...</option>
          <option value="">Custom Service</option>
          {servicePresets.map((preset) => (
            <option key={preset.name} value={preset.name}>{preset.name}</option>
          ))}
        </select>
      </label>
      <form className="row-form price-form" onSubmit={onAddService}>
        <input disabled={!canWrite} placeholder="Service or labor description" value={service.description} onChange={(event) => setService((current) => ({ ...current, description: event.target.value }))} />
        <input disabled={!canWrite} type="number" min="0" step="0.01" placeholder="Qty / Hours" value={service.quantity} onChange={(event) => setService((current) => ({ ...current, quantity: event.target.value }))} />
        <input disabled={!canWrite} type="number" min="0" step="0.01" placeholder="Internal cost" value={service.cost} onChange={(event) => setService((current) => ({ ...current, cost: event.target.value }))} />
        <input disabled={!canWrite} type="number" min="0" step="0.01" placeholder="Price / Rate" value={service.retail} onChange={(event) => setService((current) => ({ ...current, retail: event.target.value }))} />
        <button type="submit" disabled={!canWrite}>Add Service</button>
      </form>
      <table>
        <thead>
          <tr>
            <th>Description</th>
            <th>Qty</th>
            <th className="internal-only">Cost</th>
            <th className="internal-only">Margin</th>
            <th>Retail Total</th>
            <th className="no-print">Actions</th>
          </tr>
        </thead>
        <tbody>
          {services.map((row) => (
            <tr key={row.id}>
              <td>
                <input disabled={!canWrite} value={row.description} onChange={(event) => onUpdateService(row.id, 'description', event.target.value)} />
              </td>
              <td>
                <input disabled={!canWrite} type="number" min="0" step="0.01" value={row.quantity || 1} onChange={(event) => onUpdateService(row.id, 'quantity', event.target.value)} />
              </td>
              <td className="internal-only">
                <input disabled={!canWrite} type="number" min="0" step="0.01" value={row.cost} onChange={(event) => onUpdateService(row.id, 'cost', event.target.value)} />
              </td>
              <td className="internal-only">{money(margin(row), moneyOptions)}</td>
              <td>
                <input disabled={!canWrite} type="number" min="0" step="0.01" value={row.retail} onChange={(event) => onUpdateService(row.id, 'retail', event.target.value)} />
                <strong>{money(retailTotal(row), moneyOptions)}</strong>
              </td>
              <td className="no-print">
                <button type="button" className="row-remove" onClick={() => onRemoveService(row.id)} disabled={!canWrite}>Remove</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
