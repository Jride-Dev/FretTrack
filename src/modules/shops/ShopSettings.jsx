import { useState } from 'react';
import { getShopSettings, saveShopSettings } from './shopConfig';

export default function ShopSettings({ onSave, onNotice }) {
  const [settings, setSettings] = useState(() => getShopSettings());

  function updateField(event) {
    const { name, value } = event.target;
    setSettings((current) => ({ ...current, [name]: value }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    const savedSettings = saveShopSettings(settings);
    setSettings(savedSettings);
    onNotice?.({ type: 'success', message: 'Shop settings saved.' });
    onSave?.(savedSettings);
  }

  return (
    <section className="panel shop-settings">
      <h2>Shop Settings</h2>
      <form className="form-grid" onSubmit={handleSubmit}>
        <label>
          Shop Name
          <input name="shopName" value={settings.shopName} onChange={updateField} />
        </label>
        <label>
          Phone
          <input name="phone" value={settings.phone} onChange={updateField} />
        </label>
        <label>
          Email
          <input type="email" name="email" value={settings.email} onChange={updateField} />
        </label>
        <label className="wide">
          Address
          <textarea name="address" value={settings.address} onChange={updateField} rows="2" />
        </label>
        <label className="wide">
          Logo Upload
          <input type="file" accept="image/*" disabled />
          <small>Logo upload is a placeholder for the trial build.</small>
        </label>
        <label className="wide">
          Print Footer Text
          <textarea name="printFooterText" value={settings.printFooterText} onChange={updateField} rows="3" />
        </label>
        <button type="submit">Save Shop Settings</button>
      </form>
    </section>
  );
}
