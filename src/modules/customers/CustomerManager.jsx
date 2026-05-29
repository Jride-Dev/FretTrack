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
  onNotice
}) {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState(initialFilters);
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [isEditing, setIsEditing] = useState(false);

  const directoryCustomers = useMemo(() => buildCustomerDirectory(customers, jobs), [customers, jobs]);

  useEffect(() => {
    if (!directoryCustomers.length) {
      setSelectedCustomerId(null);
      setIsEditing(false);
      return;
    }

    if (!selectedCustomerId || !directoryCustomers.some((customer) => customer.id === selectedCustomerId)) {
      setSelectedCustomerId(directoryCustomers[0].id);
    }
  }, [directoryCustomers, selectedCustomerId]);

  const visibleCustomers = useMemo(() => {
    return directoryCustomers.filter((customer) => {
      const queryMatch = matchesQuery(customer, query);
      const typeMatch = filters.type === 'all' || normalizeText(customer.customerType) === filters.type || (filters.type === 'business' && normalizeText(customer.customerType) === 'company');
      const statusMatch = filters.status === 'all'
        || (filters.status === 'active' && customer.isActive !== false)
        || (filters.status === 'inactive' && customer.isActive === false);
      const balanceMatch = filters.balance === 'all'
        || (filters.balance === 'owed' && (Number(customer.totalBalanceDue) || 0) > 0.005)
        || (filters.balance === 'clear' && (Number(customer.totalBalanceDue) || 0) <= 0.005);

      return queryMatch && typeMatch && statusMatch && balanceMatch;
    });
  }, [directoryCustomers, filters.balance, filters.status, filters.type, query]);

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
    setIsEditing(false);
  }

  function handleStartEdit(customer) {
    setSelectedCustomerId(customer.id);
    setIsEditing(true);
  }

  async function handleCustomerSaved(savedCustomer) {
    setSelectedCustomerId(savedCustomer.id);
    setIsEditing(false);
    await onCustomerSaved?.(savedCustomer);
  }

  function handleCreateJob(customer) {
    onCreateJobForCustomer?.(customer);
  }

  return (
    <section className="customer-module">
      <div className="customer-module-sidebar">
        <CustomerForm
          customers={directoryCustomers}
          canWrite={canWrite}
          onCustomerSaved={handleCustomerSaved}
          onNotice={onNotice}
          title="Add Customer"
          submitLabel="Save Customer"
        />
        <CustomerLookup
          customers={visibleCustomers}
          query={query}
          filters={filters}
          dateOptions={dateOptions}
          moneyOptions={moneyOptions}
          onQueryChange={setQuery}
          onFilterChange={handleFilterChange}
          onSelectCustomer={handleSelectCustomer}
        />
      </div>
      <CustomerDetail
        customer={selectedCustomer}
        customers={directoryCustomers}
        canWrite={canWrite}
        isEditing={isEditing}
        dateOptions={dateOptions}
        moneyOptions={moneyOptions}
        onCancelEdit={() => setIsEditing(false)}
        onCustomerSaved={handleCustomerSaved}
        onCreateJob={handleCreateJob}
        onStartEdit={handleStartEdit}
      />
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
