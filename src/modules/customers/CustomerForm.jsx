import { useMemo, useState } from 'react';
import { findDuplicateCustomer } from './customerDuplicateDetection';
import { addCustomer } from './customerService';
import { customerSources, customerTypes } from './customerTypes';
import { getCustomerDisplayName, normalizeCustomer } from './customerNormalize';
import { hasRecommendedContactMethod } from './customerValidation';
import { getCurrentShopId } from '../shops/shopConfig';

const initialForm = {
  displayName: '',
  firstName: '',
  lastName: '',
  companyName: '',
  customerType: 'individual',
  email: '',
  phone: '',
  secondaryPhone: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  region: '',
  postalCode: '',
  country: '',
  notes: '',
  source: 'walk_in',
  externalRef: ''
};

export default function CustomerForm({ customers = [], canWrite = true, onCustomerSaved, onNotice }) {
  const [form, setForm] = useState(initialForm);
  const [isSaving, setIsSaving] = useState(false);

  const draftCustomer = useMemo(() => normalizeCustomer({ ...form, shopId: getCurrentShopId() }), [form]);
  const duplicateCustomer = useMemo(() => findDuplicateCustomer(customers, draftCustomer), [customers, draftCustomer]);
  const hasContactMethod = hasRecommendedContactMethod(draftCustomer);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!canWrite) {
      onNotice?.({ type: 'error', message: 'Your shop role is read-only.' });
      return;
    }

    setIsSaving(true);
    try {
      const savedCustomer = await addCustomer({
        ...form,
        displayName: getCustomerDisplayName(form)
      });
      setForm(initialForm);
      await onCustomerSaved?.(savedCustomer);
      onNotice?.({ type: 'success', message: `Saved customer ${savedCustomer.displayName}.` });
    } catch (error) {
      onNotice?.({
        type: 'error',
        message: getErrorMessage(error, 'Customer save failed.')
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className="panel customer-add-form" onSubmit={handleSubmit}>
      <h2>Add Customer</h2>
      {!canWrite && <p className="muted-text">Your shop role can view customers but cannot create or edit them.</p>}
      <div className="form-grid">
        <label>
          Display Name
          <input name="displayName" value={form.displayName} onChange={handleChange} placeholder="Name shown in FretTrack" disabled={!canWrite} />
        </label>
        <label>
          Customer Type
          <select name="customerType" value={form.customerType} onChange={handleChange} disabled={!canWrite}>
            {customerTypes.map((type) => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>
        </label>
        <label>
          First Name
          <input name="firstName" value={form.firstName} onChange={handleChange} disabled={!canWrite} />
        </label>
        <label>
          Last Name
          <input name="lastName" value={form.lastName} onChange={handleChange} disabled={!canWrite} />
        </label>
        <label>
          Company
          <input name="companyName" value={form.companyName} onChange={handleChange} placeholder="School, studio, store..." disabled={!canWrite} />
        </label>
        <label>
          Email
          <input type="email" name="email" value={form.email} onChange={handleChange} disabled={!canWrite} />
        </label>
        <label>
          Phone
          <input name="phone" value={form.phone} onChange={handleChange} disabled={!canWrite} />
        </label>
        <label>
          Secondary Phone
          <input name="secondaryPhone" value={form.secondaryPhone} onChange={handleChange} disabled={!canWrite} />
        </label>
        <label>
          Source
          <select name="source" value={form.source} onChange={handleChange} disabled={!canWrite}>
            {customerSources.map((source) => (
              <option key={source.value} value={source.value}>{source.label}</option>
            ))}
          </select>
        </label>
        <label>
          External Ref
          <input name="externalRef" value={form.externalRef} onChange={handleChange} placeholder="Spreadsheet/customer ID" disabled={!canWrite} />
        </label>
        <label className="wide">
          Address Line 1
          <input name="addressLine1" value={form.addressLine1} onChange={handleChange} disabled={!canWrite} />
        </label>
        <label className="wide">
          Address Line 2
          <input name="addressLine2" value={form.addressLine2} onChange={handleChange} disabled={!canWrite} />
        </label>
        <label>
          City
          <input name="city" value={form.city} onChange={handleChange} disabled={!canWrite} />
        </label>
        <label>
          Region
          <input name="region" value={form.region} onChange={handleChange} disabled={!canWrite} />
        </label>
        <label>
          Postal Code
          <input name="postalCode" value={form.postalCode} onChange={handleChange} disabled={!canWrite} />
        </label>
        <label>
          Country
          <input name="country" value={form.country} onChange={handleChange} disabled={!canWrite} />
        </label>
        <label className="wide">
          Notes
          <textarea name="notes" value={form.notes} onChange={handleChange} rows="3" disabled={!canWrite} />
        </label>
      </div>
      {!hasContactMethod && (
        <p className="form-warning">Email or phone is recommended for duplicate detection and follow-up, but this record can still be saved.</p>
      )}
      {duplicateCustomer && (
        <p className="form-warning">
          Possible match: {duplicateCustomer.displayName} | {duplicateCustomer.phone || 'No phone'} | {duplicateCustomer.email || 'No email'}
        </p>
      )}
      <button type="submit" disabled={isSaving || !canWrite}>{isSaving ? 'Saving...' : 'Save Customer'}</button>
    </form>
  );
}

function getErrorMessage(error, fallback) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message || fallback);
  }

  return fallback;
}
