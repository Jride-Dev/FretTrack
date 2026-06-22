import { hasSupabaseConfig, supabase } from '../../shared/lib/supabaseClient';
import { buildJobAccountingSnapshot } from '../accounting/accountingSelectors';
import {
  listParts,
  listPurchaseHistory,
  listPurchaseOrders,
  listVendors
} from '../inventory/inventoryService';
import { getJobPriorityLabel, normalizeJobPriority } from '../jobs/jobPriority';
import { listScheduleEvents } from '../scheduling/schedulingService';

const CLOSED_JOB_STATUSES = new Set(['completed', 'complete', 'picked up', 'picked-up', 'closed', 'cancelled', 'canceled']);
const UPCOMING_SCHEDULE_DAYS = 30;
const RECENT_LIMIT = 50;

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

export async function loadAdvancedOperationalReportData({ shopId = '' } = {}) {
  if (!shopId || !hasSupabaseConfig || !supabase) {
    return {
      parts: [],
      vendors: [],
      purchaseOrders: [],
      purchaseHistory: [],
      scheduleEvents: [],
      jobEvents: []
    };
  }

  const now = new Date();
  const scheduleEnd = new Date(now);
  scheduleEnd.setDate(scheduleEnd.getDate() + UPCOMING_SCHEDULE_DAYS);

  const [
    parts,
    vendors,
    purchaseOrders,
    purchaseHistory,
    scheduleEvents,
    jobEvents
  ] = await Promise.all([
    listParts(shopId, { activeOnly: false }),
    listVendors(shopId, { activeOnly: false }),
    listPurchaseOrders(shopId),
    listPurchaseHistory({ shopId }),
    listScheduleEvents(shopId, now.toISOString(), scheduleEnd.toISOString()),
    listRecentWorkLogEvents(shopId)
  ]);

  return {
    parts,
    vendors,
    purchaseOrders,
    purchaseHistory: purchaseHistory.slice(0, RECENT_LIMIT),
    scheduleEvents,
    jobEvents
  };
}

export function buildAdvancedOperationalReport({
  jobs = [],
  parts = [],
  vendors = [],
  purchaseOrders = [],
  purchaseHistory = [],
  scheduleEvents = [],
  jobEvents = [],
  shopId = '',
  now = new Date()
} = {}) {
  const scopedJobs = jobs.filter((job) => matchesShop(job, shopId));
  const openJobs = scopedJobs.filter((job) => !isClosedJob(job));
  const today = startOfDay(now);
  const jobsById = new Map(scopedJobs.map((job) => [job.id, job]));
  const vendorsById = new Map(vendors.map((vendor) => [vendor.id, vendor]));
  const partsById = new Map(parts.map((part) => [part.id, part]));
  const readyForPickup = openJobs.filter(isReadyForPickup).map((job) => buildJobRow(job, today));
  const waitingOnParts = openJobs.filter(isWaitingOnParts).map((job) => buildJobRow(job, today));
  const waitingOnCustomer = openJobs.filter(isWaitingOnCustomer).map((job) => buildJobRow(job, today));
  const overdueJobs = openJobs
    .filter((job) => getDaysOverdue(job, today) > 0)
    .map((job) => buildJobRow(job, today))
    .sort((a, b) => b.daysOverdue - a.daysOverdue || compareDates(a.promiseDate, b.promiseDate));
  const highPriorityJobs = openJobs
    .filter((job) => normalizeJobPriority(job.priority || job.techDetails?.priority) === 'high')
    .map((job) => buildJobRow(job, today));
  const lowStockParts = parts
    .filter((part) => part.isActive !== false)
    .map((part) => buildLowStockPartRow(part, vendorsById))
    .filter((part) => part.onHand <= part.desiredStockLevel)
    .sort((a, b) => (a.onHand - a.desiredStockLevel) - (b.onHand - b.desiredStockLevel) || a.name.localeCompare(b.name));
  const openPurchaseOrders = purchaseOrders
    .filter((order) => !['received', 'cancelled', 'canceled'].includes(normalizeStatus(order.status)))
    .map((order) => buildPurchaseOrderRow(order, vendorsById));
  const upcomingScheduleEvents = scheduleEvents
    .filter((event) => !['completed', 'cancelled', 'canceled', 'missed'].includes(normalizeStatus(event.status)))
    .map((event) => buildScheduleRow(event, jobsById))
    .sort((a, b) => compareDates(a.startsAt, b.startsAt))
    .slice(0, RECENT_LIMIT);

  return {
    overview: {
      openJobs: openJobs.length,
      readyForPickup: readyForPickup.length,
      waitingOnParts: waitingOnParts.length,
      waitingOnCustomer: waitingOnCustomer.length,
      overdueJobs: overdueJobs.length,
      highPriorityJobs: highPriorityJobs.length,
      lowStockParts: lowStockParts.length,
      openPurchaseOrders: openPurchaseOrders.length,
      upcomingScheduleEvents: upcomingScheduleEvents.length
    },
    jobsByStatus: buildJobsByStatus(scopedJobs),
    priorityReport: buildPriorityReport(openJobs, today),
    overdueJobs,
    readyForPickup,
    waitingOnParts,
    waitingOnCustomer,
    jobAging: openJobs
      .map((job) => buildJobRow(job, today))
      .sort((a, b) => b.ageDays - a.ageDays || compareDates(a.dateReceived, b.dateReceived))
      .slice(0, RECENT_LIMIT),
    recentWorkActivity: buildRecentWorkActivity({ jobs: scopedJobs, jobEvents, jobsById }).slice(0, RECENT_LIMIT),
    lowStockParts: lowStockParts.slice(0, RECENT_LIMIT),
    purchaseOrders: openPurchaseOrders.slice(0, RECENT_LIMIT),
    purchaseHistory: purchaseHistory
      .map((row) => buildPurchaseHistoryRow(row, partsById, vendorsById))
      .sort((a, b) => compareDates(b.receivedAt, a.receivedAt))
      .slice(0, RECENT_LIMIT),
    upcomingScheduleEvents
  };
}

async function listRecentWorkLogEvents(shopId) {
  const { data, error } = await supabase
    .from('job_events')
    .select('id, shop_id, job_id, event_type, event_label, event_note, event_data, created_by, created_at')
    .eq('shop_id', shopId)
    .eq('event_type', 'work_log_added')
    .order('created_at', { ascending: false })
    .limit(RECENT_LIMIT);

  if (error) {
    throw error;
  }

  return (data || []).map((event) => ({
    id: event.id,
    shopId: event.shop_id,
    jobId: event.job_id,
    eventType: event.event_type,
    eventLabel: event.event_label,
    eventNote: event.event_note || '',
    eventData: event.event_data || {},
    createdAt: event.created_at,
    createdBy: event.created_by || ''
  }));
}

function matchesShop(row = {}, shopId = '') {
  return !shopId || row.shopId === shopId || row.shop_id === shopId;
}

function isClosedJob(job = {}) {
  return CLOSED_JOB_STATUSES.has(normalizeStatus(job.status));
}

function isReadyForPickup(job = {}) {
  const status = normalizeStatus(job.status);
  return !isClosedJob(job) && status.includes('ready') && status.includes('pickup');
}

function isWaitingOnParts(job = {}) {
  const status = normalizeStatus(job.status);
  return !isClosedJob(job) && status.includes('waiting') && status.includes('part');
}

function isWaitingOnCustomer(job = {}) {
  const status = normalizeStatus(job.status);
  return !isClosedJob(job) && status.includes('customer') && (
    status.includes('waiting') || status.includes('approval') || status.includes('estimate')
  );
}

function normalizeStatus(status = '') {
  return String(status || '').trim().toLowerCase().replace(/_/g, ' ');
}

function buildJobsByStatus(jobs) {
  const counts = new Map();
  jobs.forEach((job) => {
    const label = String(job.status || 'No Status').trim() || 'No Status';
    counts.set(label, (counts.get(label) || 0) + 1);
  });
  return Array.from(counts.entries())
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count || a.status.localeCompare(b.status));
}

function buildPriorityReport(jobs, today) {
  const priorities = ['high', 'medium', 'regular'];
  return priorities.map((priority) => {
    const priorityJobs = jobs
      .filter((job) => normalizeJobPriority(job.priority || job.techDetails?.priority) === priority)
      .map((job) => buildJobRow(job, today))
      .sort((a, b) => compareDates(a.promiseDate || a.dateReceived, b.promiseDate || b.dateReceived));
    return {
      priority,
      label: getJobPriorityLabel(priority),
      count: priorityJobs.length,
      jobs: priorityJobs.slice(0, 8)
    };
  });
}

function buildJobRow(job, today) {
  const priority = normalizeJobPriority(job.priority || job.techDetails?.priority);
  return {
    id: job.id,
    jobNumber: job.jobNumber || job.job_number || 'No number',
    customerName: job.customerName || job.customer_name || 'Unknown customer',
    instrument: formatInstrument(job),
    status: job.status || 'No Status',
    priority,
    priorityLabel: getJobPriorityLabel(priority),
    promiseDate: job.promiseDate || job.promise_date || job.promisedDate || job.dueDate || job.techDetails?.dueDate || '',
    dateReceived: job.dateReceived || job.date_received || job.createdAt || job.created_at || '',
    daysOverdue: getDaysOverdue(job, today),
    ageDays: getAgeDays(job, today)
  };
}

function formatInstrument(job = {}) {
  return [job.guitarBrand || job.guitar_brand, job.model].filter(Boolean).join(' ')
    || job.instrumentType
    || job.techDetails?.instrumentType
    || 'Instrument';
}

function getDaysOverdue(job, today) {
  const promiseDate = parseDate(job.promiseDate || job.promise_date || job.promisedDate || job.dueDate || job.techDetails?.dueDate);
  if (!promiseDate || promiseDate >= today) {
    return 0;
  }
  return Math.floor((today.getTime() - promiseDate.getTime()) / 86400000);
}

function getAgeDays(job, today) {
  const receivedDate = parseDate(job.dateReceived || job.date_received || job.createdAt || job.created_at);
  if (!receivedDate || receivedDate > today) {
    return 0;
  }
  return Math.floor((today.getTime() - receivedDate.getTime()) / 86400000);
}

function buildLowStockPartRow(part, vendorsById) {
  const desiredStockLevel = Number(part.desiredStockLevel ?? part.desired_stock_level ?? 0) || 0;
  const vendorId = part.vendorId || part.vendor_id || '';
  return {
    id: part.id,
    name: part.name || 'Unnamed part',
    onHand: Number(part.quantityOnHand ?? part.quantity_on_hand ?? 0) || 0,
    desiredStockLevel,
    vendorName: vendorsById.get(vendorId)?.name || part.supplier || '',
    location: part.location || '',
    barcodeLabel: part.barcodeLabel || (part.barcodeCode || part.barcode_code ? `FT-PART-${part.barcodeCode || part.barcode_code}` : '')
  };
}

function buildPurchaseOrderRow(order, vendorsById) {
  const totals = summarizePurchaseOrder(order);
  return {
    id: order.id,
    poNumber: order.poNumber || order.po_number || 'No PO #',
    vendorName: vendorsById.get(order.vendorId || order.vendor_id || '')?.name || '',
    status: order.status || 'draft',
    orderedQty: totals.orderedQty,
    receivedQty: totals.receivedQty,
    remainingQty: totals.remainingQty,
    estimatedTotal: totals.estimatedTotal,
    shippingCost: Number(order.shippingCost ?? order.shipping_cost ?? 0) || 0
  };
}

function summarizePurchaseOrder(order = {}) {
  const items = order.items || [];
  return items.reduce((summary, item) => {
    const ordered = Number(item.quantityOrdered ?? item.quantity_ordered ?? 0) || 0;
    const received = Number(item.quantityReceived ?? item.quantity_received ?? 0) || 0;
    const unitCost = Number(item.unitCost ?? item.unit_cost ?? 0) || 0;
    summary.orderedQty += ordered;
    summary.receivedQty += received;
    summary.remainingQty += Math.max(ordered - received, 0);
    summary.estimatedTotal += ordered * unitCost;
    return summary;
  }, {
    orderedQty: 0,
    receivedQty: 0,
    remainingQty: 0,
    estimatedTotal: Number(order.shippingCost ?? order.shipping_cost ?? 0) || 0
  });
}

function buildPurchaseHistoryRow(row, partsById, vendorsById) {
  const part = partsById.get(row.partId || row.part_id || '') || {};
  const vendorId = row.vendorId || row.vendor_id || part.vendorId || '';
  const quantity = Number(row.quantityReceived ?? row.quantity_received ?? 0) || 0;
  const unitCost = Number(row.baseUnitCost ?? row.unitCost ?? row.unit_cost ?? 0) || 0;
  const shippingAllocated = Number(row.shippingAllocated ?? row.shipping_allocated ?? 0) || 0;
  const landedUnitCost = Number(row.landedUnitCost ?? row.landed_unit_cost ?? unitCost) || 0;
  return {
    id: row.id,
    receivedAt: row.receivedAt || row.received_at || row.createdAt || row.created_at || '',
    partName: row.partName || part.name || row.description || 'Inventory item',
    vendorName: row.vendorName || vendorsById.get(vendorId)?.name || '',
    quantity,
    unitCost,
    shippingAllocated,
    landedUnitCost,
    totalLandedCost: Number(row.totalLandedCost ?? row.totalCost ?? quantity * landedUnitCost) || 0,
    poNumber: row.poNumber || row.po_number || ''
  };
}

function buildScheduleRow(event, jobsById) {
  const job = jobsById.get(event.jobId || event.job_id || '') || {};
  return {
    id: event.id,
    jobId: event.jobId || event.job_id || '',
    startsAt: event.startsAt || event.starts_at || '',
    eventType: event.eventType || event.event_type || 'other',
    title: event.title || 'Scheduled work',
    status: event.status || 'scheduled',
    jobNumber: job.jobNumber || job.job_number || '',
    jobLabel: job.id ? `${job.jobNumber || 'Job'} - ${job.customerName || job.customer_name || 'Customer'}` : ''
  };
}

function buildRecentWorkActivity({ jobs, jobEvents, jobsById }) {
  const rows = [];
  const seen = new Set();

  jobEvents.forEach((event) => {
    const key = event.id || `${event.jobId}-${event.createdAt}-${event.eventNote}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    const job = jobsById.get(event.jobId) || {};
    rows.push({
      id: key,
      jobId: event.jobId || '',
      jobNumber: job.jobNumber || 'No number',
      customerName: job.customerName || 'Unknown customer',
      note: event.eventNote || 'Work log added',
      createdAt: event.createdAt || ''
    });
  });

  jobs.forEach((job) => {
    (job.workLog || []).forEach((entry) => {
      const key = entry.id || `${job.id}-${entry.createdAt || entry.timestamp}-${entry.entry || entry.text}`;
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      rows.push({
        id: key,
        jobId: job.id,
        jobNumber: job.jobNumber || 'No number',
        customerName: job.customerName || 'Unknown customer',
        note: entry.entry || entry.text || '',
        createdAt: entry.createdAt || entry.timestamp || ''
      });
    });
  });

  return rows.sort((a, b) => compareDates(b.createdAt, a.createdAt));
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
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : startOfDay(value);
  }
  const dateOnlyMatch = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnlyMatch) {
    return new Date(Number(dateOnlyMatch[1]), Number(dateOnlyMatch[2]) - 1, Number(dateOnlyMatch[3]));
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : startOfDay(date);
}

function startOfDay(value) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function compareDates(a, b) {
  const dateA = parseDate(a);
  const dateB = parseDate(b);
  if (!dateA && !dateB) {
    return 0;
  }
  if (!dateA) {
    return 1;
  }
  if (!dateB) {
    return -1;
  }
  return dateA.getTime() - dateB.getTime();
}
