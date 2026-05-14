import { normalizeCustomer, normalizeEmail, normalizePhone, normalizeText } from './customerNormalize';

export function findDuplicateCustomer(customers, candidate) {
  return findDuplicateCustomers(customers, candidate)[0] || null;
}

export function findDuplicateCustomers(customers = [], candidate = {}) {
  const normalizedCandidate = normalizeCustomer(candidate);

  return customers
    .map(normalizeCustomer)
    .filter((customer) => isDuplicateCustomer(customer, normalizedCandidate));
}

export function isDuplicateCustomer(customer, candidate) {
  const current = normalizeCustomer(customer);
  const next = normalizeCustomer(candidate);
  const sameShop = current.shopId && next.shopId && current.shopId === next.shopId;
  if (!sameShop) return false;

  const emailMatch = current.emailNormalized && next.emailNormalized && current.emailNormalized === next.emailNormalized;
  const phoneMatch = current.phoneNormalized && next.phoneNormalized && current.phoneNormalized === next.phoneNormalized;
  const namePhoneMatch = (
    normalizeText(current.displayName) &&
    normalizeText(current.displayName) === normalizeText(next.displayName) &&
    current.phoneNormalized &&
    current.phoneNormalized === next.phoneNormalized
  );
  const companyEmailMatch = (
    normalizeText(current.companyName) &&
    normalizeText(current.companyName) === normalizeText(next.companyName) &&
    current.emailNormalized &&
    current.emailNormalized === next.emailNormalized
  );

  return emailMatch || phoneMatch || namePhoneMatch || companyEmailMatch;
}

export function buildCustomerDuplicateKey(customer = {}) {
  const normalizedCustomer = normalizeCustomer(customer);
  return [
    normalizedCustomer.shopId,
    normalizeEmail(normalizedCustomer.email),
    normalizePhone(normalizedCustomer.phone),
    normalizeText(normalizedCustomer.displayName),
    normalizeText(normalizedCustomer.companyName)
  ].join('|');
}

export function customersFromJobs(jobs = [], shopId = '') {
  const grouped = new Map();

  jobs.forEach((job) => {
    const customer = normalizeCustomer({
      id: job.customerId || job.customer_id || undefined,
      shopId: job.shopId || job.shop_id || shopId,
      firstName: job.customerFirstName || '',
      lastName: job.customerLastName || '',
      displayName: job.customerName || '',
      phone: job.phone || '',
      email: job.email || '',
      source: 'work_order',
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      jobs: [job]
    });
    const key = customerIdentityKey(customer);

    if (!key) return;

    if (!grouped.has(key)) {
      grouped.set(key, customer);
      return;
    }

    grouped.get(key).jobs.push(job);
  });

  return Array.from(grouped.values()).map((customer) => ({
    ...customer,
    jobs: customer.jobs.sort(sortJobsNewestFirst)
  }));
}

export function findCustomerMatches(customersOrJobs, query, options = {}) {
  const cleanQuery = normalizeText(query);
  const phoneQuery = normalizePhone(query);

  if (!cleanQuery && !phoneQuery) return [];

  const shopId = options.shopId || inferShopId(customersOrJobs);
  const customers = mergeCustomerLists(
    (customersOrJobs || []).map((item) => item.jobs ? normalizeCustomer(withShop(item, shopId)) : null).filter(Boolean),
    customersFromJobs((customersOrJobs || []).filter((item) => !item.jobs), shopId),
    shopId
  );

  return customers
    .filter((customer) => {
      const name = normalizeText(customer.displayName);
      const company = normalizeText(customer.companyName);
      const firstName = normalizeText(customer.firstName);
      const lastName = normalizeText(customer.lastName);
      const email = normalizeText(customer.email);
      const phone = normalizePhone(customer.phone);

      return (
        name.includes(cleanQuery) ||
        company.includes(cleanQuery) ||
        firstName.includes(cleanQuery) ||
        lastName.includes(cleanQuery) ||
        email.includes(cleanQuery) ||
        (phoneQuery && phone.includes(phoneQuery))
      );
    })
    .sort(sortCustomersNewestFirst);
}

export function mergeCustomerLists(primaryCustomers = [], fallbackCustomers = [], shopId = '') {
  const merged = new Map();

  [...primaryCustomers, ...fallbackCustomers].forEach((customer) => {
    const normalizedCustomer = normalizeCustomer(withShop(customer, shopId));
    if (shopId && normalizedCustomer.shopId !== shopId) {
      return;
    }

    const key = customerIdentityKey(normalizedCustomer);
    if (!key) return;

    if (!merged.has(key)) {
      merged.set(key, normalizedCustomer);
      return;
    }

    const existing = merged.get(key);
    merged.set(key, {
      ...existing,
      ...normalizedCustomer,
      id: existing.id || normalizedCustomer.id,
      jobs: mergeJobs(existing.jobs, normalizedCustomer.jobs),
      createdAt: earliestDate(existing.createdAt, normalizedCustomer.createdAt),
      updatedAt: latestDate(existing.updatedAt, normalizedCustomer.updatedAt)
    });
  });

  return Array.from(merged.values()).sort(sortCustomersNewestFirst);
}

export function upsertCustomer(customers, customer) {
  const duplicate = findDuplicateCustomer(customers, customer);
  if (!duplicate) {
    return [customer, ...customers];
  }

  return customers.map((current) => (current.id === duplicate.id ? { ...duplicate, ...customer, id: duplicate.id } : current));
}

export function customerIdentityKey(customer) {
  const displayPhoneKey = [normalizeText(customer.displayName), customer.phoneNormalized].filter(Boolean).join('|');
  const companyEmailKey = [normalizeText(customer.companyName), customer.emailNormalized].filter(Boolean).join('|');

  return (
    customer.emailNormalized ||
    customer.phoneNormalized ||
    displayPhoneKey ||
    companyEmailKey ||
    customer.id
  );
}

function withShop(customer = {}, shopId = '') {
  return {
    ...customer,
    shopId: customer.shopId || customer.shop_id || shopId
  };
}

function inferShopId(items = []) {
  const item = (items || []).find((current) => current?.shopId || current?.shop_id);
  return item?.shopId || item?.shop_id || '';
}

function mergeJobs(primaryJobs = [], fallbackJobs = []) {
  const jobs = new Map();
  [...primaryJobs, ...fallbackJobs].forEach((job) => {
    if (job?.id) {
      jobs.set(job.id, job);
    }
  });
  return Array.from(jobs.values()).sort(sortJobsNewestFirst);
}

function sortJobsNewestFirst(a, b) {
  return new Date(b.dateReceived || b.createdAt || 0) - new Date(a.dateReceived || a.createdAt || 0);
}

function sortCustomersNewestFirst(a, b) {
  return new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0);
}

function earliestDate(left, right) {
  if (!left) return right;
  if (!right) return left;
  return new Date(left) < new Date(right) ? left : right;
}

function latestDate(left, right) {
  if (!left) return right;
  if (!right) return left;
  return new Date(left) > new Date(right) ? left : right;
}
