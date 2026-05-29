import { customerStatusOptions, customerTypes, getCustomerTypeLabel } from './customerTypes';
import { money } from '../../shared/utils/money';
import { formatShopDate } from '../../shared/utils/dateFormat';

const balanceOptions = [
  { value: 'all', label: 'All Balances' },
  { value: 'owed', label: 'Balance Owed' },
  { value: 'clear', label: 'Paid Up' }
];

export default function CustomerLookup({
  customers = [],
  query,
  filters,
  dateOptions = {},
  moneyOptions = {},
  onQueryChange,
  onFilterChange,
  onSelectCustomer
}) {
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
          placeholder="Search customers, companies, phone, or email..."
        />
      </div>
      <div className="customer-filter-bar">
        <label>
          Type
          <select value={filters.type} onChange={(event) => onFilterChange('type', event.target.value)}>
            <option value="all">All Types</option>
            {customerTypes.map((type) => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>
        </label>
        <label>
          Balance
          <select value={filters.balance} onChange={(event) => onFilterChange('balance', event.target.value)}>
            {balanceOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label>
          Status
          <select value={filters.status} onChange={(event) => onFilterChange('status', event.target.value)}>
            <option value="all">All Statuses</option>
            {customerStatusOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="customer-list">
        {customers.map((customer) => (
        <CustomerSummaryCard customer={customer} key={customer.id} moneyOptions={moneyOptions} dateOptions={dateOptions} onSelectCustomer={onSelectCustomer} />
        ))}
        {!customers.length && <p className="muted-text">No customers found.</p>}
      </div>
    </section>
  );
}

function CustomerSummaryCard({ customer, moneyOptions, dateOptions, onSelectCustomer }) {
  return (
    <button type="button" className="customer-card customer-card-button" onClick={() => onSelectCustomer(customer)}>
      <div>
        <strong>{customer.displayName || 'Unnamed Customer'}</strong>
        {customer.companyName && customer.displayName !== customer.companyName && <span>{customer.companyName}</span>}
        <span>{customer.phone || 'No phone'} | {customer.email || 'No email'}</span>
        <span>{customer.lastJobDate ? `Last job ${formatShopDate(customer.lastJobDate, dateOptions)}` : 'No job history yet'}</span>
      </div>
      <div>
        <span>{getCustomerTypeLabel(customer.customerType)}</span>
        <span>{customer.openJobCount || 0} open job{customer.openJobCount === 1 ? '' : 's'}</span>
        <span>{money(customer.totalBalanceDue, moneyOptions)}</span>
        {customer.notesIndicator && <span>Notes</span>}
        {!customer.isActive && <span>Inactive</span>}
      </div>
    </button>
  );
}
