import { useEffect, useMemo, useState } from 'react';
import { findDuplicateCustomer } from './customerDuplicateDetection';
import { addCustomer } from './customerService';
import { customerSources, customerStatusOptions, customerTypes } from './customerTypes';
import { getCustomerDisplayName, normalizeCustomer } from './customerNormalize';
import { hasRecommendedContactMethod } from './customerValidation';
import { getCurrentShopId } from '../shops/shopConfig';

const initialForm = {
  id: '',
  displayName: '',
  firstName: '',
  lastName: '',
  companyName: '',
  customerType: 'individual',
  isActive: true,
  taxId: '',
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

export default function CustomerForm({
  customers = [],
  canWrite = true,
  customer = null,
  onCustomerSaved,
  onNotice,
  onCancel,
  submitLabel,
  title
}) {
  const [form, setForm] = useState(() => buildFormState(customer));
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setForm(buildFormState(customer));
  }, [customer?.id]);

  const customerPool = useMemo(() => {
    if (!form.id) {
      return customers;
    }

    return customers.filter((current) => current.id !== form.id);
  }, [customers, form.id]);

  const draftCustomer = useMemo(() => normalizeCustomer({ ...form, shopId: getCurrentShopId() }), [form]);
  const duplicateCustomer = useMemo(() => findDuplicateCustomer(customerPool, draftCustomer), [customerPool, draftCustomer]);
  const hasContactMethod = hasRecommendedContactMethod(draftCustomer);
  const isEditing = Boolean(customer?.id);
  const heading = title || (isEditing ? 'Edit Customer' : 'Add Customer');
  const buttonLabel = submitLabel || (isEditing ? 'Save Changes' : 'Save Customer');

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({
      ...current,
      [name]: name === 'isActive' ? value === 'active' : value
    }));
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

      if (!isEditing) {
        setForm(initialForm);
      } else {
        setForm(buildFormState(savedCustomer));
      }

      await onCustomerSaved?.(savedCustomer);
      onNotice?.({ type: 'success', message: `${isEditing ? 'Updated' : 'Saved'} customer ${savedCustomer.displayName}.` });
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
      <h2>{heading}</h2>
      {!canWrite && <p className="muted-text">Your shop role can view customers but cannot create or edit them.</p>}
      {isEditing && (
        <div className="mode-actions no-print customer-edit-actions">
          {onCancel && <button type="button" onClick={onCancel}>Cancel</button>}
        </div>
      )}
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
          Status
          <select name="isActive" value={form.isActive ? 'active' : 'inactive'} onChange={handleChange} disabled={!canWrite}>
            {customerStatusOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label>
          Tax / VAT ID
          <input name="taxId" value={form.taxId} onChange={handleChange} placeholder="Optional business tax ID" disabled={!canWrite} />
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
      <button type="submit" disabled={isSaving || !canWrite}>{isSaving ? 'Saving...' : buttonLabel}</button>
    </form>
  );
}

function buildFormState(customer) {
  if (!customer) {
    return { ...initialForm };
  }

  const normalized = normalizeCustomer(customer);
  return {
    ...initialForm,
    ...normalized,
    id: normalized.id || customer.id || '',
    isActive: normalized.isActive !== false,
    taxId: normalized.taxId || ''
  };
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
