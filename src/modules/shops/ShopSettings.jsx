import { useEffect, useState } from 'react';
import UserSettings from '../auth/UserSettings.jsx';
import { SUPPORTED_DATE_FORMATS, getDefaultDateFormatForLocale } from '../../shared/utils/dateFormat';
import { SUPPORTED_CURRENCIES, getDefaultLocaleForCurrency, getSupportedCurrency } from '../../shared/utils/money';
import { getShopSettings, saveShopSettings } from './shopConfig';
import { saveShopProfile, uploadShopLogo } from './shopProfileService';

export default function ShopSettings({
  canManageShop = true,
  initialSettings = null,
  requireCompletion = false,
  onSave,
  onNotice
}) {
  const [settings, setSettings] = useState(() => initialSettings || getShopSettings());
  const [logoFile, setLogoFile] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (initialSettings) {
      setSettings(initialSettings);
    }
  }, [initialSettings?.shopId, initialSettings?.updatedAt]);

  function updateField(event) {
    const { name, type, checked, value } = event.target;
    setSettings((current) => {
      if (name === 'currencyCode') {
        const currency = getSupportedCurrency(value);
        return {
          ...current,
          currencyCode: currency.code,
          locale: getDefaultLocaleForCurrency(currency.code),
          taxLabel: currency.taxLabel,
          dateFormat: getDefaultDateFormatForLocale(getDefaultLocaleForCurrency(currency.code))
        };
      }

      return { ...current, [name]: type === 'checkbox' ? checked : value };
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!canManageShop) {
      onNotice?.({ type: 'error', message: 'Only shop owners and admins can change shop settings.' });
      return;
    }

    if (!settings.shopName.trim()) {
      onNotice?.({ type: 'error', message: 'Shop name is required.' });
      return;
    }

    if (requireCompletion && !settings.taxState.trim()) {
      onNotice?.({ type: 'error', message: 'State is required before beta use.' });
      return;
    }

    setIsSaving(true);
    try {
      let nextSettings = { ...settings };
      if (logoFile) {
        const logo = await uploadShopLogo(logoFile, nextSettings.shopId);
        nextSettings = {
          ...nextSettings,
          logoStoragePath: logo?.logoStoragePath || nextSettings.logoStoragePath || '',
          logoUrl: logo?.logoUrl || nextSettings.logoUrl || ''
        };
      }

      const savedSettings = await saveShopProfile(nextSettings);
      saveShopSettings(savedSettings);
      setSettings(savedSettings);
      setLogoFile(null);
      onNotice?.({ type: 'success', message: requireCompletion ? 'Shop onboarding complete.' : 'Shop settings saved.' });
      onSave?.(savedSettings);
    } catch (error) {
      console.error('Shop settings save failed.', error);
      onNotice?.({
        type: 'error',
        message: error instanceof Error && error.message ? error.message : 'Shop settings save failed.'
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="panel shop-settings">
      <h2>{requireCompletion ? 'Set Up Your Shop' : 'Shop Settings'}</h2>
      {requireCompletion && (
        <p className="muted-text">
          Complete this before creating work orders so printed sheets, defaults, and shop access are scoped correctly.
        </p>
      )}
      <section className="shop-profile-settings">
        <h3>Shop Profile</h3>
        {!canManageShop && <p className="muted-text">Only shop owners and admins can change shop settings.</p>}
        <form className="form-grid" onSubmit={handleSubmit}>
          <label>
            Shop Name
            <input name="shopName" value={settings.shopName} onChange={updateField} disabled={!canManageShop || isSaving} required />
          </label>
          <label>
            Phone
            <input name="phone" value={settings.phone} onChange={updateField} disabled={!canManageShop || isSaving} />
          </label>
          <label>
            Email
            <input type="email" name="email" value={settings.email} onChange={updateField} disabled={!canManageShop || isSaving} />
          </label>
          <label className="wide">
            Address
            <textarea name="address" value={settings.address} onChange={updateField} rows="2" disabled={!canManageShop || isSaving} />
          </label>
          <label className="wide">
            Logo Upload
            <input
              type="file"
              accept="image/*"
              disabled={!canManageShop || isSaving}
              onChange={(event) => setLogoFile(event.target.files?.[0] || null)}
            />
            <small>{settings.logoStoragePath ? 'Current logo is saved for this shop.' : 'Optional. Used for shop branding where available.'}</small>
          </label>
          {settings.logoUrl && (
            <div className="wide shop-logo-preview">
              <img src={settings.logoUrl} alt={`${settings.shopName || 'Shop'} logo preview`} />
            </div>
          )}
          <label>
            Currency
            <select name="currencyCode" value={settings.currencyCode || 'USD'} onChange={updateField} disabled={!canManageShop || isSaving}>
              {SUPPORTED_CURRENCIES.map((currency) => (
                <option key={currency.code} value={currency.code}>{currency.label}</option>
              ))}
            </select>
          </label>
          <label>
            Locale
            <input name="locale" value={settings.locale || ''} onChange={updateField} disabled={!canManageShop || isSaving} placeholder="en-US" />
          </label>
          <label>
            Date Format
            <select name="dateFormat" value={settings.dateFormat || getDefaultDateFormatForLocale(settings.locale)} onChange={updateField} disabled={!canManageShop || isSaving}>
              {SUPPORTED_DATE_FORMATS.map((format) => (
                <option key={format} value={format}>{format}</option>
              ))}
            </select>
          </label>
          <label>
            Tax/VAT Label
            <input name="taxLabel" value={settings.taxLabel || ''} onChange={updateField} disabled={!canManageShop || isSaving} placeholder="Sales Tax" />
          </label>
          <label>
            Tax/VAT Registration #
            <input name="taxRegistrationNumber" value={settings.taxRegistrationNumber || ''} onChange={updateField} disabled={!canManageShop || isSaving} />
          </label>
          <label>
            Tax Jurisdiction
            <input name="taxState" value={settings.taxState || ''} onChange={updateField} disabled={!canManageShop || isSaving} required={requireCompletion} maxLength="80" />
          </label>
          <label>
            Default {settings.taxLabel || 'Tax'} %
            <input type="number" min="0" step="0.001" name="salesTaxRate" value={settings.salesTaxRate || ''} onChange={updateField} disabled={!canManageShop || isSaving} />
          </label>
          <label className="checkline">
            <input type="checkbox" name="taxablePartsDefault" checked={settings.taxablePartsDefault !== false} onChange={updateField} disabled={!canManageShop || isSaving} />
            Parts taxable by default
          </label>
          <label className="checkline">
            <input type="checkbox" name="taxableServicesDefault" checked={Boolean(settings.taxableServicesDefault)} onChange={updateField} disabled={!canManageShop || isSaving} />
            Services taxable by default
          </label>
          <label className="wide">
            Print Footer Text
            <textarea name="printFooterText" value={settings.printFooterText} onChange={updateField} rows="3" disabled={!canManageShop || isSaving} />
          </label>
          <button type="submit" disabled={!canManageShop || isSaving}>{isSaving ? 'Saving...' : requireCompletion ? 'Finish Shop Setup' : 'Save Shop Settings'}</button>
        </form>
      </section>
      {!requireCompletion && <UserSettings onNotice={onNotice} />}
    </section>
  );
}
