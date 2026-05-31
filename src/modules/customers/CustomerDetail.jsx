import { money } from '../../shared/utils/money';
import { formatShopDate } from '../../shared/utils/dateFormat';
import { getCustomerTypeLabel } from './customerTypes';

export default function CustomerDetail({
  customer,
  canWrite = true,
  dateOptions = {},
  moneyOptions = {},
  onCreateJob,
  onEditCustomer
}) {
  if (!customer) {
    return (
      <section className="panel customer-detail">
        <h2>Customer Profile</h2>
        <p className="muted-text">Select a customer to review their profile, jobs, and balance.</p>
      </section>
    );
  }

  return (
    <section className="panel customer-detail">
      <div className="panel-heading customer-detail-heading">
        <div>
          <h2>{customer.displayName}</h2>
          <p className="muted-text">
            {getCustomerTypeLabel(customer.customerType)}{customer.companyName ? ` - ${customer.companyName}` : ''}{!customer.isActive ? ' - Inactive' : ''}
          </p>
        </div>
        <div className="mode-actions no-print customer-detail-actions">
          {canWrite && onEditCustomer && <button type="button" onClick={() => onEditCustomer(customer)}>Edit Profile</button>}
          {canWrite && onCreateJob && <button type="button" className="primary-action" onClick={() => onCreateJob(customer)}>Create Job</button>}
        </div>
      </div>

      <div className="customer-summary-grid">
        <SummaryCard label="Total Billed" value={money(customer.totalBilled, moneyOptions)} />
        <SummaryCard label="Total Paid" value={money(customer.totalPaid, moneyOptions)} />
        <SummaryCard label="Balance Due" value={money(customer.totalBalanceDue, moneyOptions)} />
        <SummaryCard label="Open Jobs" value={customer.openJobCount || 0} />
        <SummaryCard label="Completed Jobs" value={customer.completedJobCount || 0} />
        <SummaryCard label="Last Activity" value={customer.lastActivityAt ? formatShopDate(customer.lastActivityAt, dateOptions) : '-'} />
      </div>

      <div className="totals customer-contact-grid">
        <span>First Name</span><strong>{customer.firstName || '-'}</strong>
        <span>Last Name</span><strong>{customer.lastName || '-'}</strong>
        <span>Display Name</span><strong>{customer.displayName || '-'}</strong>
        <span>Company</span><strong>{customer.companyName || '-'}</strong>
        <span>Email</span><strong>{customer.email || '-'}</strong>
        <span>Phone</span><strong>{customer.phone || '-'}</strong>
        <span>Secondary Phone</span><strong>{customer.secondaryPhone || '-'}</strong>
        <span>Address</span><strong>{formatAddress(customer)}</strong>
        <span>Tax / VAT ID</span><strong>{customer.taxId || '-'}</strong>
        <span>Status</span><strong>{customer.isActive ? 'Active' : 'Inactive'}</strong>
        <span>Source</span><strong>{customer.source || '-'}</strong>
        <span>External Ref</span><strong>{customer.externalRef || '-'}</strong>
      </div>

      <SectionTitle title="Job History" />
      {renderJobHistory(customer.jobHistory || customer.jobs, moneyOptions, dateOptions)}

      <SectionTitle title="Payments" />
      {renderPaymentHistory(customer.payments, moneyOptions, dateOptions)}

      <SectionTitle title="Notes" />
      <p className="customer-notes">{customer.notes || 'No notes yet.'}</p>
    </section>
  );
}

function SummaryCard({ label, value }) {
  return (
    <article className="summary-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function SectionTitle({ title }) {
  return <h3 className="customer-section-title">{title}</h3>;
}

function renderJobHistory(jobs = [], moneyOptions = {}, dateOptions = {}) {
  if (!jobs.length) {
    return <p className="muted-text">No jobs are linked to this customer yet.</p>;
  }

  return (
    <div className="table-wrap">
      <table className="customer-history-table">
        <thead>
          <tr>
            <th>Job</th>
            <th>Date</th>
            <th>Status</th>
            <th>Instrument</th>
            <th>Total</th>
            <th>Paid</th>
            <th>Balance</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
            <tr key={job.id}>
              <td>#{job.jobNumber || 'No number'}</td>
              <td>{formatShopDate(job.dateReceived || job.createdAt || job.updatedAt, dateOptions)}</td>
              <td>{job.status || '-'}</td>
              <td>{[job.guitarBrand, job.model].filter(Boolean).join(' ') || '-'}</td>
              <td>{money(job.totalDue || 0, moneyOptions)}</td>
              <td>{money(job.paidTotal || 0, moneyOptions)}</td>
              <td>{money(job.balanceDue || 0, moneyOptions)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function renderPaymentHistory(payments = [], moneyOptions = {}, dateOptions = {}) {
  if (!payments.length) {
    return <p className="muted-text">No payments recorded for this customer yet.</p>;
  }

  return (
    <div className="table-wrap">
      <table className="customer-history-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Job</th>
            <th>Method</th>
            <th>Amount</th>
            <th>Note</th>
          </tr>
        </thead>
        <tbody>
          {payments.slice(0, 12).map((payment) => (
            <tr key={payment.id}>
              <td>{formatShopDate(payment.date, dateOptions)}</td>
              <td>{payment.jobNumber ? `#${payment.jobNumber}` : '-'}</td>
              <td>{payment.method || '-'}</td>
              <td>{money(payment.amount || 0, moneyOptions)}</td>
              <td>{payment.note || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatAddress(customer) {
  return [
    customer.addressLine1,
    customer.addressLine2,
    [customer.city, customer.region, customer.postalCode].filter(Boolean).join(', '),
    customer.country
  ].filter(Boolean).join(' | ') || '-';
}
