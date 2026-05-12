export function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

export function normalizePhone(value) {
  return String(value || '').replace(/\D/g, '');
}

export function combineCustomerName(firstName = '', lastName = '') {
  return [firstName, lastName].map((part) => String(part || '').trim()).filter(Boolean).join(' ');
}

export function splitCustomerName(customerName = '') {
  const parts = String(customerName || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) {
    return {
      customerFirstName: parts[0] || '',
      customerLastName: ''
    };
  }

  return {
    customerFirstName: parts[0],
    customerLastName: parts.slice(1).join(' ')
  };
}

export function findCustomerMatches(jobs, query) {
  const cleanQuery = normalizeText(query);
  const phoneQuery = normalizePhone(query);

  if (!cleanQuery && !phoneQuery) return [];

  const matches = jobs.filter((job) => {
    const name = normalizeText(job.customerName);
    const firstName = normalizeText(job.customerFirstName);
    const lastName = normalizeText(job.customerLastName);
    const email = normalizeText(job.email);
    const phone = normalizePhone(job.phone);

    return (
      name.includes(cleanQuery) ||
      firstName.includes(cleanQuery) ||
      lastName.includes(cleanQuery) ||
      email.includes(cleanQuery) ||
      (phoneQuery && phone.includes(phoneQuery))
    );
  });

  const grouped = new Map();

  matches.forEach((job) => {
    const key =
      normalizePhone(job.phone) ||
      normalizeText(job.email) ||
      normalizeText(job.customerName);

    if (!grouped.has(key)) {
      grouped.set(key, {
        customerFirstName: job.customerFirstName || '',
        customerLastName: job.customerLastName || '',
        customerName: job.customerName || '',
        phone: job.phone || '',
        email: job.email || '',
        jobs: []
      });
    }

    grouped.get(key).jobs.push(job);
  });

  return Array.from(grouped.values()).map((customer) => ({
    ...customer,
    jobs: customer.jobs.sort((a, b) => {
      return new Date(b.dateReceived || b.createdAt || 0) - new Date(a.dateReceived || a.createdAt || 0);
    })
  }));
}
