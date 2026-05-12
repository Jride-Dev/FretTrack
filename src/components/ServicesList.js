import { servicePresets } from '../data/servicePresets';
import { money } from '../shared/utils/money';

function margin(row) {
  const quantity = Number(row.quantity || 1);
  return ((Number(row.retail) || 0) - (Number(row.cost) || 0)) * quantity;
}

function retailTotal(row) {
  return (Number(row.retail) || 0) * (Number(row.quantity || 1));
}

export default function ServicesList({ services, service, setService, onAddService, onUpdateService }) {
  function applyPreset(event) {
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
        <select defaultValue="" onChange={applyPreset}>
          <option value="">Add Service Preset...</option>
          <option value="">Custom Service</option>
          {servicePresets.map((preset) => (
            <option key={preset.name} value={preset.name}>{preset.name}</option>
          ))}
        </select>
      </label>
      <form className="row-form price-form" onSubmit={onAddService}>
        <input placeholder="Description" value={service.description} onChange={(event) => setService((current) => ({ ...current, description: event.target.value }))} />
        <input type="number" min="0" step="0.01" placeholder="Qty" value={service.quantity} onChange={(event) => setService((current) => ({ ...current, quantity: event.target.value }))} />
        <input type="number" min="0" step="0.01" placeholder="Cost" value={service.cost} onChange={(event) => setService((current) => ({ ...current, cost: event.target.value }))} />
        <input type="number" min="0" step="0.01" placeholder="Retail" value={service.retail} onChange={(event) => setService((current) => ({ ...current, retail: event.target.value }))} />
        <button type="submit">Add Service</button>
      </form>
      <table>
        <thead>
          <tr>
            <th>Description</th>
            <th>Qty</th>
            <th className="internal-only">Cost</th>
            <th className="internal-only">Margin</th>
            <th>Retail Total</th>
          </tr>
        </thead>
        <tbody>
          {services.map((row) => (
            <tr key={row.id}>
              <td>
                <input value={row.description} onChange={(event) => onUpdateService(row.id, 'description', event.target.value)} />
              </td>
              <td>
                <input type="number" min="0" step="0.01" value={row.quantity || 1} onChange={(event) => onUpdateService(row.id, 'quantity', event.target.value)} />
              </td>
              <td className="internal-only">
                <input type="number" min="0" step="0.01" value={row.cost} onChange={(event) => onUpdateService(row.id, 'cost', event.target.value)} />
              </td>
              <td className="internal-only">{money(margin(row))}</td>
              <td>
                <input type="number" min="0" step="0.01" value={row.retail} onChange={(event) => onUpdateService(row.id, 'retail', event.target.value)} />
                <strong>{money(retailTotal(row))}</strong>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
