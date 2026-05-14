import { useState } from 'react';
import { getShopSettings, saveShopSettings } from './shopConfig';

export default function ShopSettings({ canManageShop = true, onSave, onNotice }) {
  const [settings, setSettings] = useState(() => getShopSettings());

  function updateField(event) {
    const { name, value } = event.target;
    setSettings((current) => ({ ...current, [name]: value }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (!canManageShop) {
      onNotice?.({ type: 'error', message: 'Only shop owners and admins can change shop settings.' });
      return;
    }

    const savedSettings = saveShopSettings(settings);
    setSettings(savedSettings);
    onNotice?.({ type: 'success', message: 'Shop settings saved.' });
    onSave?.(savedSettings);
  }

  return (
    <section className="panel shop-settings">
      <h2>Shop Settings</h2>
      {!canManageShop && <p className="muted-text">Only shop owners and admins can change shop settings.</p>}
      <form className="form-grid" onSubmit={handleSubmit}>
        <label>
          Shop Name
          <input name="shopName" value={settings.shopName} onChange={updateField} disabled={!canManageShop} />
        </label>
        <label>
          Phone
          <input name="phone" value={settings.phone} onChange={updateField} disabled={!canManageShop} />
        </label>
        <label>
          Email
          <input type="email" name="email" value={settings.email} onChange={updateField} disabled={!canManageShop} />
        </label>
        <label className="wide">
          Address
          <textarea name="address" value={settings.address} onChange={updateField} rows="2" disabled={!canManageShop} />
        </label>
        <label className="wide">
          Logo Upload
          <input type="file" accept="image/*" disabled />
          <small>Logo upload is a placeholder for the trial build.</small>
        </label>
        <label className="wide">
          Print Footer Text
          <textarea name="printFooterText" value={settings.printFooterText} onChange={updateField} rows="3" disabled={!canManageShop} />
        </label>
        <button type="submit" disabled={!canManageShop}>Save Shop Settings</button>
      </form>
    </section>
  );
}
