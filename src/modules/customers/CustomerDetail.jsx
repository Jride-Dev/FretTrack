import { money } from '../../shared/utils/money';
import { formatShopDate } from '../../shared/utils/dateFormat';
import { getCustomerTypeLabel } from './customerTypes';
import CustomerLoyaltyCard from '../loyalty/CustomerLoyaltyCard.jsx';
import WorkspacePageHeader from '../../shared/components/WorkspacePageHeader.jsx';
import WorkspaceSection from '../../shared/components/WorkspaceSection.jsx';
import CustomerConversationPanel from '../messaging/CustomerConversationPanel.jsx';

export default function CustomerDetail({
  customer,
  canWrite = true,
  loyaltyProgramEnabled = false,
  serviceRemindersEnabled = false,
  dateOptions = {},
  moneyOptions = {},
  onCreateJob,
  onEditCustomer,
  shopId = '',
  onNotice
}) {
  if (!customer) {
    return (
      <section className="panel customer-detail">
        <WorkspaceSection
          title="Customer profile"
          description="Select a customer to review their contact details, account activity, jobs, and payments."
        >
          <p className="empty-state">Choose a customer from the directory to open their profile.</p>
        </WorkspaceSection>
      </section>
    );
  }

  return (
    <section className="panel customer-detail">
      <WorkspacePageHeader
        eyebrow="Customer profile"
        title={customer.displayName}
        description={`${getCustomerTypeLabel(customer.customerType)}${customer.companyName ? ` · ${customer.companyName}` : ''}${!customer.isActive ? ' · Inactive' : ''}`}
        actions={(
          <div className="mode-actions no-print customer-detail-actions">
            {canWrite && onEditCustomer && <button type="button" onClick={() => onEditCustomer(customer)}>Edit Profile</button>}
            {canWrite && onCreateJob && <button type="button" className="primary-action" onClick={() => onCreateJob(customer)}>Create Job</button>}
          </div>
        )}
      />

      <WorkspaceSection title="Account overview" description="Work volume and billing position across this customer’s history.">
        <div className="customer-summary-grid">
          <SummaryCard label="Total Billed" value={money(customer.totalBilled, moneyOptions)} />
          <SummaryCard label="Total Paid" value={money(customer.totalPaid, moneyOptions)} />
          <SummaryCard label="Balance Due" value={money(customer.totalBalanceDue, moneyOptions)} />
          <SummaryCard label="Open Jobs" value={customer.openJobCount || 0} />
          <SummaryCard label="Completed Jobs" value={customer.completedJobCount || 0} />
          <SummaryCard label="Last Activity" value={customer.lastActivityAt ? formatShopDate(customer.lastActivityAt, dateOptions) : '-'} />
        </div>
      </WorkspaceSection>

      <WorkspaceSection title="Contact & account" description="Identity, contact preferences, and imported account references.">
        <div className="totals customer-contact-grid">
          <span>First Name</span><strong>{customer.firstName || '-'}</strong>
          <span>Last Name</span><strong>{customer.lastName || '-'}</strong>
          <span>Display Name</span><strong>{customer.displayName || '-'}</strong>
          <span>Company</span><strong>{customer.companyName || '-'}</strong>
          <span>Email</span><strong>{customer.email || '-'}</strong>
          {serviceRemindersEnabled && <><span>Service Reminders</span><strong>{customer.serviceReminderOptIn ? 'Opted in' : 'Not opted in'}</strong></>}
          <span>Phone</span><strong>{customer.phone || '-'}</strong>
          <span>Secondary Phone</span><strong>{customer.secondaryPhone || '-'}</strong>
          <span>Address</span><strong>{formatAddress(customer)}</strong>
          <span>Tax / VAT ID</span><strong>{customer.taxId || '-'}</strong>
          <span>Status</span><strong>{customer.isActive ? 'Active' : 'Inactive'}</strong>
          <span>Source</span><strong>{customer.source || '-'}</strong>
          <span>External Ref</span><strong>{customer.externalRef || '-'}</strong>
        </div>
      </WorkspaceSection>

      {loyaltyProgramEnabled && (
        <CustomerLoyaltyCard customerId={customer.id} canWrite={canWrite} dateOptions={dateOptions} onNotice={onNotice} />
      )}

      <WorkspaceSection title="Job history" description="Every work order linked to this customer record.">
        {renderJobHistory(customer.jobHistory || customer.jobs, moneyOptions, dateOptions)}
      </WorkspaceSection>

      <WorkspaceSection title="Payments" description="The latest payment, refund, and void activity across linked work orders.">
        {renderPaymentHistory(customer.payments, moneyOptions, dateOptions)}
      </WorkspaceSection>

      <CustomerConversationPanel
        customer={customer}
        shopId={shopId}
        canWrite={canWrite}
        dateOptions={dateOptions}
        onNotice={onNotice}
      />

      <WorkspaceSection title="Notes" description="Shop-only context retained with this customer profile.">
        <p className="customer-notes">{customer.notes || 'No notes yet.'}</p>
      </WorkspaceSection>
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
            <th>Type</th>
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
              <td>{payment.type === 'refund' ? 'Refund' : payment.type === 'void' ? 'Payment Void' : 'Payment'}</td>
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
