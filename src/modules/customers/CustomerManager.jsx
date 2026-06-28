import { useEffect, useMemo, useState } from 'react';
import CustomerDetail from './CustomerDetail.jsx';
import CustomerForm from './CustomerForm.jsx';
import CustomerLookup from './CustomerLookup.jsx';
import { buildCustomerDirectory } from './customerInsights';
import { normalizePhone, normalizeText } from './customerNormalize';

const initialFilters = {
  type: 'all',
  balance: 'all',
  status: 'all'
};

export default function CustomerManager({
  customers = [],
  jobs = [],
  canWrite = true,
  dateOptions = {},
  moneyOptions = {},
  onCustomerSaved,
  onCreateJobForCustomer,
  onDirtyChange,
  onNotice
}) {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState(initialFilters);
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [customerModalCustomer, setCustomerModalCustomer] = useState(undefined);
  const [isCustomerFormDirty, setIsCustomerFormDirty] = useState(false);

  const directoryCustomers = useMemo(() => buildCustomerDirectory(customers, jobs), [customers, jobs]);

  useEffect(() => {
    if (!directoryCustomers.length) {
      setSelectedCustomerId(null);
      return;
    }

    if (!selectedCustomerId || !directoryCustomers.some((customer) => customer.id === selectedCustomerId)) {
      setSelectedCustomerId(directoryCustomers[0].id);
    }
  }, [directoryCustomers, selectedCustomerId]);

  const visibleCustomers = useMemo(() => {
    return directoryCustomers.filter((customer) => {
      const queryMatch = matchesQuery(customer, query);
      const typeMatch = filters.type === 'all' || normalizeText(customer.customerType) === filters.type;
      const statusMatch = filters.status === 'all'
        || (filters.status === 'active' && customer.isActive !== false)
        || (filters.status === 'inactive' && customer.isActive === false);
      const balanceMatch = filters.balance === 'all'
        || (filters.balance === 'owed' && (Number(customer.totalBalanceDue) || 0) > 0.005)
        || (filters.balance === 'clear' && (Number(customer.totalBalanceDue) || 0) <= 0.005);

      return queryMatch && typeMatch && statusMatch && balanceMatch;
    });
  }, [directoryCustomers, filters.balance, filters.status, filters.type, query]);
  const visibleCustomerCount = visibleCustomers.length;
  const totalCustomerCount = directoryCustomers.length;

  useEffect(() => {
    if (!visibleCustomers.length) {
      if (selectedCustomerId !== null) {
        setSelectedCustomerId(null);
      }
      return;
    }

    if (!selectedCustomerId || !visibleCustomers.some((customer) => customer.id === selectedCustomerId)) {
      setSelectedCustomerId(visibleCustomers[0].id);
    }
  }, [selectedCustomerId, visibleCustomers]);

  const selectedCustomer = useMemo(() => {
    if (!selectedCustomerId) {
      return null;
    }

    return directoryCustomers.find((customer) => customer.id === selectedCustomerId) || null;
  }, [directoryCustomers, selectedCustomerId]);

  function handleFilterChange(key, value) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function handleSelectCustomer(customer) {
    setSelectedCustomerId(customer.id);
  }

  function openNewCustomerModal() {
    if (isCustomerFormDirty && !window.confirm('You have unsaved changes. Leave without saving?')) {
      return;
    }

    setIsCustomerFormDirty(false);
    setCustomerModalCustomer(null);
  }

  function openEditCustomerModal(customer) {
    if (isCustomerFormDirty && !window.confirm('You have unsaved changes. Leave without saving?')) {
      return;
    }

    setIsCustomerFormDirty(false);
    setCustomerModalCustomer(customer);
  }

  function closeCustomerModal() {
    if (isCustomerFormDirty && !window.confirm('You have unsaved changes. Leave without saving?')) {
      return;
    }

    setIsCustomerFormDirty(false);
    onDirtyChange?.(false);
    setCustomerModalCustomer(undefined);
  }

  async function handleCustomerSaved(savedCustomer) {
    setIsCustomerFormDirty(false);
    onDirtyChange?.(false);
    setSelectedCustomerId(savedCustomer.id);
    setCustomerModalCustomer(undefined);
    await onCustomerSaved?.(savedCustomer);
  }

  function handleCreateJob(customer) {
    onCreateJobForCustomer?.(customer);
  }

  const modalCustomer = customerModalCustomer === undefined ? null : customerModalCustomer;
  const isModalOpen = customerModalCustomer !== undefined;

  return (
    <section className="customer-module">
      <header className="customer-module-header">
        <div className="customer-module-titleblock">
          <h2>Customers</h2>
          <p className="muted-text">
            {visibleCustomerCount === totalCustomerCount
              ? `${totalCustomerCount} customer record${totalCustomerCount === 1 ? '' : 's'}`
              : `${visibleCustomerCount} of ${totalCustomerCount} customer records`}
          </p>
        </div>
        <div className="customer-module-actions no-print">
          {canWrite && <button type="button" className="primary-action" onClick={openNewCustomerModal}>Add Customer</button>}
        </div>
      </header>

      <div className="customer-module-toolbar">
        <input
          className="customer-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by name, company, phone, email, tax ID, or notes..."
        />
        <div className="customer-filter-bar">
          <label>
            Type
            <select value={filters.type} onChange={(event) => handleFilterChange('type', event.target.value)}>
              <option value="all">All Types</option>
              <option value="individual">Individual</option>
              <option value="business">Business</option>
              <option value="subcontractor">Subcontractor</option>
            </select>
          </label>
          <label>
            Balance
            <select value={filters.balance} onChange={(event) => handleFilterChange('balance', event.target.value)}>
              <option value="all">All Balances</option>
              <option value="owed">Balance Owed</option>
              <option value="clear">Paid Up</option>
            </select>
          </label>
          <label>
            Status
            <select value={filters.status} onChange={(event) => handleFilterChange('status', event.target.value)}>
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
        </div>
      </div>

      <div className="customer-module-layout">
        <CustomerLookup
          customers={visibleCustomers}
          selectedCustomerId={selectedCustomerId}
          dateOptions={dateOptions}
          moneyOptions={moneyOptions}
          onSelectCustomer={handleSelectCustomer}
        />
        <CustomerDetail
          customer={selectedCustomer}
          canWrite={canWrite}
          dateOptions={dateOptions}
          moneyOptions={moneyOptions}
          onCreateJob={handleCreateJob}
          onEditCustomer={canWrite ? openEditCustomerModal : null}
        />
      </div>

      {isModalOpen && (
        <div className="feedback-backdrop no-print" role="presentation" onClick={closeCustomerModal}>
          <div
            className="feedback-modal customer-modal"
            role="dialog"
            aria-modal="true"
            aria-label={modalCustomer ? `Edit ${modalCustomer.displayName}` : 'Add customer'}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="feedback-modal-heading">
              <div>
                <h2>{modalCustomer ? 'Edit Customer' : 'Add Customer'}</h2>
                <p>{modalCustomer ? modalCustomer.displayName : 'Create a new customer, business, or subcontractor record.'}</p>
              </div>
              <button type="button" className="modal-close" onClick={closeCustomerModal} aria-label="Close customer form">Close</button>
            </div>
            <CustomerForm
              customer={modalCustomer}
              customers={directoryCustomers}
              canWrite={canWrite}
              onCustomerSaved={handleCustomerSaved}
              onNotice={onNotice}
              onDirtyChange={(isDirty) => {
                setIsCustomerFormDirty(isDirty);
                onDirtyChange?.(isDirty);
              }}
              showHeading={false}
              submitLabel={modalCustomer ? 'Save Changes' : 'Save Customer'}
              title={modalCustomer ? 'Edit Customer' : 'Add Customer'}
            />
          </div>
        </div>
      )}
    </section>
  );
}

function matchesQuery(customer, query) {
  const cleanQuery = normalizeText(query);
  const phoneQuery = normalizePhone(query);

  if (!cleanQuery && !phoneQuery) {
    return true;
  }

  const haystack = [
    customer.displayName,
    customer.firstName,
    customer.lastName,
    customer.companyName,
    customer.email,
    customer.phone,
    customer.secondaryPhone,
    customer.taxId,
    customer.externalRef,
    customer.notes
  ]
    .map((value) => normalizeText(value))
    .join(' ');

  return haystack.includes(cleanQuery) || (phoneQuery && [customer.phone, customer.secondaryPhone].some((phone) => normalizePhone(phone).includes(phoneQuery)));
}
