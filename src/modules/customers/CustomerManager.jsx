import { useState } from 'react';
import CustomerForm from './CustomerForm.jsx';
import CustomerLookup from './CustomerLookup.jsx';

export default function CustomerManager({ customers = [], jobs = [], canWrite = true, onCustomerSaved, onNotice }) {
  const [query, setQuery] = useState('');
  const customersWithJobs = customers.map((customer) => ({
    ...customer,
    jobs: jobs.filter((job) => (
      job.customerId === customer.id ||
      (!job.customerId && (
        (customer.phone && job.phone === customer.phone) ||
        (customer.email && job.email === customer.email) ||
        (customer.displayName && job.customerName === customer.displayName)
      ))
    ))
  }));

  return (
    <section className="customer-module">
      <CustomerForm
        customers={customersWithJobs}
        canWrite={canWrite}
        onCustomerSaved={onCustomerSaved}
        onNotice={onNotice}
      />
      <CustomerLookup
        customers={customersWithJobs}
        query={query}
        onQueryChange={setQuery}
      />
    </section>
  );
}
