export default function CustomerDetail({ customer }) {
  if (!customer) {
    return null;
  }

  return (
    <section className="panel customer-detail">
      <h2>{customer.displayName}</h2>
      <div className="totals">
        <span>Type</span><strong>{customer.customerType}</strong>
        <span>Email</span><strong>{customer.email || '-'}</strong>
        <span>Phone</span><strong>{customer.phone || '-'}</strong>
        <span>Source</span><strong>{customer.source || '-'}</strong>
      </div>
    </section>
  );
}
