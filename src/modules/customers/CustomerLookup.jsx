import { money } from '../../shared/utils/money';
import { formatShopDate } from '../../shared/utils/dateFormat';
import { getCustomerTypeLabel } from './customerTypes';

export default function CustomerLookup({
  customers = [],
  selectedCustomerId = null,
  moneyOptions = {},
  dateOptions = {},
  onSelectCustomer
}) {
  return (
    <section className="panel customer-list-panel">
      <div className="customer-list">
        {customers.map((customer) => (
          <CustomerSummaryCard
            customer={customer}
            key={customer.id}
            dateOptions={dateOptions}
            moneyOptions={moneyOptions}
            onSelectCustomer={onSelectCustomer}
            selected={customer.id === selectedCustomerId}
          />
        ))}
        {!customers.length && <p className="muted-text">No customers found.</p>}
      </div>
    </section>
  );
}

function CustomerSummaryCard({ customer, dateOptions, moneyOptions, onSelectCustomer, selected }) {
  return (
    <button
      type="button"
      className={`customer-card customer-card-button${selected ? ' selected' : ''}`}
      onClick={() => onSelectCustomer(customer)}
      aria-pressed={selected}
    >
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
