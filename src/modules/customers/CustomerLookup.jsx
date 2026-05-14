import { findCustomerMatches } from './customerDuplicateDetection';

export default function CustomerLookup({ customers = [], query, onQueryChange }) {
  const visibleCustomers = query.trim() ? findCustomerMatches(customers, query) : customers;

  return (
    <section className="panel customer-list-panel">
      <div className="panel-heading">
        <div>
          <h2>Customers</h2>
          <p className="muted-text">{customers.length} customer record{customers.length === 1 ? '' : 's'}</p>
        </div>
        <input
          className="customer-search"
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search customers..."
        />
      </div>
      <div className="customer-list">
        {visibleCustomers.map((customer) => (
          <CustomerSummaryCard customer={customer} key={customer.id} />
        ))}
        {!visibleCustomers.length && <p className="muted-text">No customers found.</p>}
      </div>
    </section>
  );
}

function CustomerSummaryCard({ customer }) {
  return (
    <article className="customer-card">
      <div>
        <strong>{customer.displayName || 'Unnamed Customer'}</strong>
        {customer.companyName && customer.displayName !== customer.companyName && <span>{customer.companyName}</span>}
        <span>{customer.phone || 'No phone'} | {customer.email || 'No email'}</span>
      </div>
      <div>
        <span>{customer.customerType}</span>
        <span>{customer.jobs?.length || 0} job{customer.jobs?.length === 1 ? '' : 's'}</span>
        <span>{customer.source || 'manual'}</span>
      </div>
    </article>
  );
}
