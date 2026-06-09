import { buildJobAccountingSnapshot } from '../accounting/accountingSelectors';

const CLOSED_JOB_STATUSES = new Set(['completed', 'picked up', 'closed']);

export function buildAdvancedReportMetrics({
  jobs = [],
  customers = [],
  parts = [],
  shopId = '',
  shopProfile = null,
  now = new Date()
} = {}) {
  const scopedJobs = jobs.filter((job) => matchesShop(job, shopId));
  const scopedCustomers = customers.filter((customer) => matchesShop(customer, shopId));
  const scopedParts = parts.filter((part) => matchesShop(part, shopId));
  const accountingJobs = scopedJobs.map((job) => buildJobAccountingSnapshot(job, {
    currencyCode: shopProfile?.currencyCode,
    locale: shopProfile?.locale,
    taxLabel: shopProfile?.taxLabel,
    dateFormat: shopProfile?.dateFormat,
    lengthUnit: shopProfile?.lengthUnit
  }));
  const paymentEvents = accountingJobs.flatMap((job) => job.paymentEvents || []);
  const closedJobs = scopedJobs.filter(isClosedJob);
  const openJobs = scopedJobs.filter((job) => !isClosedJob(job));

  return {
    revenue: {
      thisMonth: sumPaymentsInRange(paymentEvents, monthRange(now)),
      lastMonth: sumPaymentsInRange(paymentEvents, previousMonthRange(now)),
      yearToDate: sumPaymentsInRange(paymentEvents, yearToDateRange(now))
    },
    jobs: {
      openJobs: openJobs.length,
      completedJobs: closedJobs.length,
      averageCompletionTimeDays: averageCompletionTimeDays(closedJobs)
    },
    customers: {
      totalCustomers: scopedCustomers.length,
      newCustomersThisMonth: scopedCustomers.filter((customer) => isDateInRange(customer.createdAt || customer.created_at, monthRange(now))).length,
      repeatCustomers: countRepeatCustomers(scopedJobs)
    },
    inventory: {
      lowStockCount: scopedParts.filter((part) => part.isActive !== false && Number(part.quantityOnHand ?? part.quantity_on_hand ?? 0) <= Number(part.reorderPoint ?? part.reorder_point ?? 0)).length,
      totalParts: scopedParts.length,
      inventoryValueEstimate: scopedParts.reduce((total, part) => {
        const quantity = Number(part.quantityOnHand ?? part.quantity_on_hand ?? 0) || 0;
        const unitCost = Number(part.unitCost ?? part.unit_cost ?? 0) || 0;
        return total + quantity * unitCost;
      }, 0)
    }
  };
}

function matchesShop(row = {}, shopId = '') {
  return !shopId || row.shopId === shopId || row.shop_id === shopId;
}

function isClosedJob(job = {}) {
  return CLOSED_JOB_STATUSES.has(String(job.status || '').trim().toLowerCase());
}

function sumPaymentsInRange(paymentEvents, range) {
  return paymentEvents
    .filter((event) => event.type === 'payment' && isDateInRange(event.date, range))
    .reduce((total, event) => total + (Number(event.amount) || 0), 0);
}

function averageCompletionTimeDays(jobs) {
  const durations = jobs
    .map((job) => {
      const start = parseDate(job.dateReceived || job.date_received || job.createdAt || job.created_at);
      const end = parseDate(job.completedAt || job.completed_at || job.pickedUpAt || job.picked_up_at || job.updatedAt || job.updated_at);
      if (!start || !end || end < start) {
        return null;
      }
      return (end.getTime() - start.getTime()) / 86400000;
    })
    .filter((value) => Number.isFinite(value));

  if (!durations.length) {
    return null;
  }

  return durations.reduce((total, value) => total + value, 0) / durations.length;
}

function countRepeatCustomers(jobs) {
  const jobCounts = new Map();
  jobs.forEach((job) => {
    const customerKey = job.customerId || job.customer_id || normalizeCustomerName(job.customerName || job.customer_name);
    if (!customerKey) {
      return;
    }
    jobCounts.set(customerKey, (jobCounts.get(customerKey) || 0) + 1);
  });
  return Array.from(jobCounts.values()).filter((count) => count > 1).length;
}

function normalizeCustomerName(value) {
  return String(value || '').trim().toLowerCase();
}

function monthRange(date) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

function previousMonthRange(date) {
  const start = new Date(date.getFullYear(), date.getMonth() - 1, 1);
  const end = new Date(date.getFullYear(), date.getMonth(), 0, 23, 59, 59, 999);
  return { start, end };
}

function yearToDateRange(date) {
  return {
    start: new Date(date.getFullYear(), 0, 1),
    end: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999)
  };
}

function isDateInRange(value, range) {
  const date = parseDate(value);
  if (!date) {
    return false;
  }
  return date >= range.start && date <= range.end;
}

function parseDate(value) {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
