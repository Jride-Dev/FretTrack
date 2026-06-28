import { supabase, hasSupabaseConfig } from '../../shared/lib/supabaseClient';
import { getCurrentShopId } from '../shops/shopConfig';
import { normalizeCustomer } from './customerNormalize';
import {
  customersFromJobs,
  findDuplicateCustomer,
  mergeCustomerLists,
  upsertCustomer
} from './customerDuplicateDetection';

const STORAGE_KEY = 'frettrack_customers';

export function getLocalCustomers(options = {}) {
  const activeShopId = getActiveShopId(options);
  try {
    return readStoredCustomers()
      .map((customer) => withDefaultShop(customer, activeShopId))
      .map(normalizeCustomer)
      .filter((customer) => customer.shopId === activeShopId);
  } catch {
    return [];
  }
}

export function saveLocalCustomers(customers, options = {}) {
  const activeShopId = getActiveShopId(options);
  try {
    const otherShopCustomers = readStoredCustomers()
      .map((customer) => normalizeCustomer(withDefaultShop(customer, activeShopId)))
      .filter((customer) => customer.shopId !== activeShopId);
    const normalizedCustomers = customers.map((customer) => normalizeCustomer(withDefaultShop(customer, activeShopId)));
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...otherShopCustomers, ...normalizedCustomers]));
  } catch (error) {
    console.error('Local customer save failed.', error);
  }
}

export async function getCustomers(jobs = [], options = {}) {
  const activeShopId = getActiveShopId(options);
  const localCustomers = mergeCustomerLists(getLocalCustomers({ shopId: activeShopId }), customersFromJobs(jobs, activeShopId), activeShopId);

  if (!hasSupabaseConfig || !supabase) {
    saveLocalCustomers(localCustomers, { shopId: activeShopId });
    return localCustomers;
  }

  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('shop_id', activeShopId)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Supabase getCustomers failed. Falling back to local customer records.', error);
    saveLocalCustomers(localCustomers, { shopId: activeShopId });
    return localCustomers;
  }

  const mergedCustomers = mergeCustomerLists((data || []).map(fromDbCustomer), localCustomers, activeShopId);
  saveLocalCustomers(mergedCustomers, { shopId: activeShopId });
  return mergedCustomers;
}

export async function addCustomer(customer, options = {}) {
  const activeShopId = getActiveShopId(options);
  const now = new Date().toISOString();
  const normalizedCustomer = normalizeCustomer({
    ...customer,
    shopId: customer.shopId || activeShopId,
    createdAt: customer.createdAt || now,
    updatedAt: now
  });

  const localCustomers = getLocalCustomers({ shopId: activeShopId });
  saveLocalCustomers(upsertCustomer(localCustomers, normalizedCustomer), { shopId: activeShopId });

  if (!hasSupabaseConfig || !supabase) {
    return normalizedCustomer;
  }

  const { data, error } = await supabase
    .from('customers')
    .upsert(toDbCustomer(normalizedCustomer, activeShopId))
    .select('*')
    .single();

  if (error) {
    console.error('Supabase addCustomer failed. Local copy saved only.', error);
    throw new Error(`Remote customer save failed: ${error.message}. Local copy was saved only on this browser.`);
  }

  const savedCustomer = fromDbCustomer(data);
  saveLocalCustomers(upsertCustomer(localCustomers, savedCustomer), { shopId: activeShopId });
  return savedCustomer;
}

export async function ensureCustomerForJob(job, options = {}) {
  const activeShopId = getActiveShopId(options);
  const customer = normalizeCustomer({
    id: job.customerId || job.customer_id || undefined,
    shopId: job.shopId || job.shop_id || activeShopId,
    firstName: job.customerFirstName || job.customer_first_name || '',
    lastName: job.customerLastName || job.customer_last_name || '',
    displayName: job.customerName || job.customer_name || '',
    phone: job.phone || '',
    email: job.email || '',
    addressLine1: job.addressLine1 || job.address_line1 || job.address || '',
    city: job.city || '',
    region: job.region || job.state || '',
    postalCode: job.postalCode || job.postal_code || job.zipCode || job.zip_code || '',
    source: 'work_order'
  });

  if (!customer.displayName) {
    return null;
  }

  const localCustomers = getLocalCustomers({ shopId: activeShopId });
  const existing = findDuplicateCustomer(localCustomers, customer);
  const customerToSave = {
    ...customer,
    id: existing?.id || customer.id,
    createdAt: existing?.createdAt || customer.createdAt,
    updatedAt: new Date().toISOString()
  };

  try {
    return await addCustomer(customerToSave, { shopId: activeShopId });
  } catch (error) {
    console.warn('Customer link save failed. Job save will continue without a customer_id.', error);
    return null;
  }
}

function readStoredCustomers() {
  return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
}

function withDefaultShop(customer = {}, shopId = getActiveShopId()) {
  return {
    ...customer,
    shopId: customer.shopId || customer.shop_id || shopId
  };
}

function getActiveShopId(options = {}) {
  return options.shopId || getCurrentShopId();
}

function toDbCustomer(customer, shopId = getActiveShopId()) {
  return {
    id: customer.id,
    shop_id: customer.shopId || shopId,
    display_name: customer.displayName,
    first_name: customer.firstName || null,
    last_name: customer.lastName || null,
    company_name: customer.companyName || null,
    customer_type: customer.customerType || 'individual',
    is_active: customer.isActive !== false,
    tax_id: customer.taxId || null,
    email: customer.email || null,
    email_normalized: customer.emailNormalized || null,
    phone: customer.phone || null,
    phone_normalized: customer.phoneNormalized || null,
    secondary_phone: customer.secondaryPhone || null,
    address_line1: customer.addressLine1 || null,
    address_line2: customer.addressLine2 || null,
    city: customer.city || null,
    region: customer.region || null,
    postal_code: customer.postalCode || null,
    country: customer.country || null,
    notes: customer.notes || null,
    source: customer.source || null,
    external_ref: customer.externalRef || null,
    import_source: customer.importSource || null,
    import_batch_id: customer.importBatchId || null,
    created_at: customer.createdAt,
    updated_at: customer.updatedAt
  };
}

function fromDbCustomer(customer) {
  return normalizeCustomer(customer);
}
