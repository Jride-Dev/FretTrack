import { money } from '../../shared/utils/money';
import { formatShopDate } from '../../shared/utils/dateFormat';
import WorkspaceSection from '../../shared/components/WorkspaceSection.jsx';
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
      <WorkspaceSection
        title="Customer directory"
        description={`${customers.length} matching record${customers.length === 1 ? '' : 's'}`}
      >
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
          {!customers.length && <p className="empty-state">No customers match these filters.</p>}
        </div>
      </WorkspaceSection>
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
      <div className="customer-card-identity">
        <strong>{customer.displayName || 'Unnamed Customer'}</strong>
        {customer.companyName && customer.displayName !== customer.companyName && <span>{customer.companyName}</span>}
        <span>{customer.phone || 'No phone'} | {customer.email || 'No email'}</span>
        <span>{customer.lastJobDate ? `Last job ${formatShopDate(customer.lastJobDate, dateOptions)}` : 'No job history yet'}</span>
      </div>
      <div className="customer-card-context">
        <span className="customer-card-type">{getCustomerTypeLabel(customer.customerType)}</span>
        <span>{customer.openJobCount || 0} open job{customer.openJobCount === 1 ? '' : 's'}</span>
        <strong>{money(customer.totalBalanceDue, moneyOptions)}</strong>
        {customer.notesIndicator && <span className="customer-card-flag">Notes</span>}
        {!customer.isActive && <span className="customer-card-flag">Inactive</span>}
      </div>
    </button>
  );
}
