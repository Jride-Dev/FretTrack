import { useEffect, useMemo, useState } from 'react';
import { money } from '../../shared/utils/money';
import { listPurchaseOrders, listVendors } from '../inventory/inventoryService';
import { getCurrentShopId, getShopMoneyOptions } from '../shops/shopConfig';
import {
  SHIPMENT_DIRECTIONS,
  SHIPMENT_STATUSES,
  SHIPPING_ITEM_DISPOSITIONS,
  SHIPPING_ITEM_TYPES,
  addCustodyNote,
  createShippingRecord,
  listShippingDashboardRecords,
  updateShippingRecord
} from './shippingService';

const emptyShippingForm = {
  direction: 'customer_outbound',
  status: 'pending_arrival',
  fulfillmentMethod: 'ship',
  jobId: '',
  customerId: '',
  vendorId: '',
  purchaseOrderId: '',
  itemDescription: '',
  itemType: 'instrument',
  itemQuantity: '1',
  itemDisposition: 'hold_quarantine',
  carrier: '',
  serviceLevel: '',
  trackingNumber: '',
  trackingUrl: '',
  labelReference: '',
  labelUrl: '',
  declaredValue: '',
  insuranceRequired: false,
  signatureRequired: false,
  shippingCost: '',
  shippingCharge: '',
  assignedLocation: '',
  assignedCategory: '',
  receivedCondition: '',
  conditionNotes: '',
  packingNotes: '',
  customerNotified: false,
  notes: ''
};

const dashboardGroups = [
  {
    id: 'pending-arrival',
    title: 'Pending Arrival',
    statuses: ['pending_arrival']
  },
  {
    id: 'arrived',
    title: 'Arrived / Needs Check-In',
    statuses: ['arrived', 'checked_in', 'triage']
  },
  {
    id: 'bench',
    title: 'At Bench',
    statuses: ['at_bench']
  },
  {
    id: 'ready',
    title: 'Ready to Ship',
    statuses: ['ready_to_pack', 'packed', 'ready_to_ship']
  },
  {
    id: 'transit',
    title: 'In Transit',
    statuses: ['in_transit', 'delivered', 'returned']
  },
  {
    id: 'exceptions',
    title: 'Exceptions',
    statuses: ['delayed', 'exception', 'cancelled']
  }
];

function formatLabel(value = '') {
  return String(value || '')
    .split('_')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ') || '-';
}

function formatDateTime(value) {
  if (!value) {
    return '-';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
}

function getJobLabel(job) {
  if (!job) {
    return '';
  }

  const number = job.jobNumber || job.job_number || job.id?.slice?.(0, 8) || 'Job';
  const instrument = [job.brand, job.model, job.instrumentType || job.instrument_type || job.instrument].filter(Boolean).join(' ');
  return instrument ? `${number} - ${instrument}` : number;
}

function getCustomerName(customer) {
  return customer?.displayName
    || customer?.display_name
    || customer?.name
    || [customer?.firstName || customer?.first_name, customer?.lastName || customer?.last_name].filter(Boolean).join(' ')
    || '';
}

function mergePresetOptions(...sources) {
  const seen = new Set();
  const values = [];
  for (const source of sources) {
    const entries = Array.isArray(source) ? source : [source];
    for (const entry of entries) {
      const label = String(entry || '').trim();
      const key = label.toLowerCase();
      if (!label || seen.has(key)) {
        continue;
      }
      seen.add(key);
      values.push(label);
    }
  }
  return values.sort((left, right) => left.localeCompare(right));
}

export default function ShippingDashboard({
  canWrite = true,
  customers = [],
  jobs = [],
  shopId = getCurrentShopId(),
  shopProfile,
  onNotice
}) {
  const [records, setRecords] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [shippingForm, setShippingForm] = useState(emptyShippingForm);
  const [statusUpdates, setStatusUpdates] = useState({});
  const [custodyNotes, setCustodyNotes] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const moneyOptions = getShopMoneyOptions(shopProfile || undefined);

  const jobsById = useMemo(() => new Map(jobs.map((job) => [job.id, job])), [jobs]);
  const customersById = useMemo(() => new Map(customers.map((customer) => [customer.id, customer])), [customers]);
  const vendorsById = useMemo(() => new Map(vendors.map((vendor) => [vendor.id, vendor])), [vendors]);
  const purchaseOrdersById = useMemo(() => new Map(purchaseOrders.map((order) => [order.id, order])), [purchaseOrders]);
  const locationOptions = useMemo(
    () => mergePresetOptions(
      shopProfile?.inventoryLocationPresets,
      records.map((record) => record.assignedLocation),
      records.flatMap((record) => record.items.map((item) => item.assignedLocation)),
      shippingForm.assignedLocation
    ),
    [records, shippingForm.assignedLocation, shopProfile?.inventoryLocationPresets]
  );
  const categoryOptions = useMemo(
    () => mergePresetOptions(
      shopProfile?.inventoryCategoryPresets,
      records.map((record) => record.assignedCategory),
      records.flatMap((record) => record.items.map((item) => item.assignedCategory)),
      shippingForm.assignedCategory
    ),
    [records, shippingForm.assignedCategory, shopProfile?.inventoryCategoryPresets]
  );

  useEffect(() => {
    loadShippingDashboard().catch((error) => {
      console.error('Shipping dashboard load failed.', error);
      onNotice?.({ type: 'error', message: error.message || 'Unable to load shipping dashboard.' });
    });
  }, [shopId]);

  async function loadShippingDashboard() {
    setIsLoading(true);
    try {
      const [loadedRecords, loadedVendors, loadedOrders] = await Promise.all([
        listShippingDashboardRecords(shopId),
        listVendors(shopId, { activeOnly: false }),
        listPurchaseOrders(shopId)
      ]);
      setRecords(loadedRecords);
      setVendors(loadedVendors);
      setPurchaseOrders(loadedOrders);
      setStatusUpdates(Object.fromEntries(loadedRecords.map((record) => [record.id, record.status])));
      return loadedRecords;
    } finally {
      setIsLoading(false);
    }
  }

  function updateShippingForm(field, value) {
    setShippingForm((current) => ({ ...current, [field]: value }));
  }

  function handleJobChange(jobId) {
    const job = jobsById.get(jobId);
    updateShippingForm('jobId', jobId);
    if (job?.customerId || job?.customer_id) {
      updateShippingForm('customerId', job.customerId || job.customer_id);
    }
    if (job && !shippingForm.itemDescription) {
      updateShippingForm('itemDescription', getJobLabel(job));
    }
  }

  function handlePurchaseOrderChange(purchaseOrderId) {
    const order = purchaseOrdersById.get(purchaseOrderId);
    updateShippingForm('purchaseOrderId', purchaseOrderId);
    if (order?.vendorId) {
      updateShippingForm('vendorId', order.vendorId);
    }
  }

  async function saveShippingRecord(event) {
    event.preventDefault();
    if (!canWrite) {
      return;
    }
    if (!shippingForm.itemDescription.trim()) {
      onNotice?.({ type: 'error', message: 'Enter an item, package, or instrument description first.' });
      return;
    }

    setIsSaving(true);
    try {
      await createShippingRecord({
        ...shippingForm,
        items: [{
          description: shippingForm.itemDescription,
          itemType: shippingForm.itemType,
          quantity: shippingForm.itemQuantity,
          disposition: shippingForm.itemDisposition,
          jobId: shippingForm.jobId,
          customerId: shippingForm.customerId,
          vendorId: shippingForm.vendorId,
          purchaseOrderId: shippingForm.purchaseOrderId,
          assignedLocation: shippingForm.assignedLocation,
          assignedCategory: shippingForm.assignedCategory,
          receivedCondition: shippingForm.receivedCondition,
          conditionNotes: shippingForm.conditionNotes
        }]
      }, shopId);
      setShippingForm(emptyShippingForm);
      await loadShippingDashboard();
      onNotice?.({ type: 'success', message: 'Shipping / custody record created.' });
    } catch (error) {
      console.error('Create shipping record failed.', error);
      onNotice?.({ type: 'error', message: error.message || 'Unable to create shipping record.' });
    } finally {
      setIsSaving(false);
    }
  }

  async function saveStatus(record) {
    if (!canWrite) {
      return;
    }
    const nextStatus = statusUpdates[record.id] || record.status;
    setIsSaving(true);
    try {
      await updateShippingRecord(record.id, {
        status: nextStatus,
        shippedAt: nextStatus === 'in_transit' && !record.shippedAt ? new Date().toISOString() : record.shippedAt || null,
        deliveredAt: nextStatus === 'delivered' && !record.deliveredAt ? new Date().toISOString() : record.deliveredAt || null
      }, shopId);
      await loadShippingDashboard();
      onNotice?.({ type: 'success', message: 'Shipping status updated.' });
    } catch (error) {
      console.error('Update shipping status failed.', error);
      onNotice?.({ type: 'error', message: error.message || 'Unable to update shipping status.' });
    } finally {
      setIsSaving(false);
    }
  }

  async function saveCustodyNote(record) {
    if (!canWrite) {
      return;
    }
    const note = custodyNotes[record.id] || '';
    if (!note.trim()) {
      return;
    }
    setIsSaving(true);
    try {
      await addCustodyNote(record.id, note, shopId);
      setCustodyNotes((current) => ({ ...current, [record.id]: '' }));
      await loadShippingDashboard();
      onNotice?.({ type: 'success', message: 'Custody note added.' });
    } catch (error) {
      console.error('Add custody note failed.', error);
      onNotice?.({ type: 'error', message: error.message || 'Unable to add custody note.' });
    } finally {
      setIsSaving(false);
    }
  }

  function renderRecord(record) {
    const job = jobsById.get(record.jobId);
    const customer = customersById.get(record.customerId);
    const vendor = vendorsById.get(record.vendorId);
    const purchaseOrder = purchaseOrdersById.get(record.purchaseOrderId);
    const lastEvent = record.custodyEvents[0];
    const itemSummary = record.items.map((item) => `${item.description} x${item.quantity}`).join(', ');

    return (
      <article className="shipping-record-card" key={record.id}>
        <div className="editor-heading">
          <div>
            <h4>{record.shippingReference || 'Shipping record'}</h4>
            <p className="muted-text">{formatLabel(record.direction)} - {formatLabel(record.fulfillmentMethod)}</p>
          </div>
          <span className={`status-pill ${record.status === 'exception' || record.status === 'delayed' ? 'danger' : record.status === 'delivered' ? 'success' : 'warning'}`}>
            {formatLabel(record.status)}
          </span>
        </div>

        <div className="inventory-meta-grid">
          <span>Job <strong>{getJobLabel(job) || '-'}</strong></span>
          <span>Customer <strong>{getCustomerName(customer) || '-'}</strong></span>
          <span>Vendor <strong>{vendor?.name || '-'}</strong></span>
          <span>PO <strong>{purchaseOrder?.poNumber || '-'}</strong></span>
          <span>Item <strong>{itemSummary || '-'}</strong></span>
          <span>Carrier <strong>{record.carrier || '-'}</strong></span>
          <span>Tracking <strong>{record.trackingNumber || '-'}</strong></span>
          <span>Location <strong>{record.assignedLocation || record.items[0]?.assignedLocation || '-'}</strong></span>
          <span>Category <strong>{record.assignedCategory || record.items[0]?.assignedCategory || '-'}</strong></span>
          <span>Declared Value <strong>{record.declaredValue == null ? '-' : money(record.declaredValue, moneyOptions)}</strong></span>
          <span>Insurance <strong>{record.insuranceRequired ? 'Yes' : 'No'}</strong></span>
          <span>Signature <strong>{record.signatureRequired ? 'Yes' : 'No'}</strong></span>
          <span>Customer Notified <strong>{record.customerNotified ? 'Yes' : 'No'}</strong></span>
          <span>Last Event <strong>{lastEvent ? `${lastEvent.eventLabel} ${formatDateTime(lastEvent.createdAt)}` : '-'}</strong></span>
        </div>

        {(record.trackingUrl || record.labelUrl) && (
          <p className="muted-text">
            {record.trackingUrl && <a href={record.trackingUrl} target="_blank" rel="noreferrer">Tracking link</a>}
            {record.trackingUrl && record.labelUrl ? ' · ' : ''}
            {record.labelUrl && <a href={record.labelUrl} target="_blank" rel="noreferrer">Label / document link</a>}
          </p>
        )}

        <div className="shipping-custody-log">
          {record.custodyEvents.slice(0, 4).map((event) => (
            <span key={event.id}>
              <strong>{event.eventLabel}</strong>
              {event.eventNote ? ` - ${event.eventNote}` : ''}
            </span>
          ))}
          {!record.custodyEvents.length && <span>No custody events yet.</span>}
        </div>

        {canWrite && (
          <div className="shipping-record-actions">
            <label>Status
              <select value={statusUpdates[record.id] || record.status} onChange={(event) => setStatusUpdates((current) => ({ ...current, [record.id]: event.target.value }))}>
                {SHIPMENT_STATUSES.map((status) => (
                  <option key={status} value={status}>{formatLabel(status)}</option>
                ))}
              </select>
            </label>
            <button type="button" onClick={() => saveStatus(record)} disabled={isSaving}>Update Status</button>
            <label>Custody Note
              <input value={custodyNotes[record.id] || ''} onChange={(event) => setCustodyNotes((current) => ({ ...current, [record.id]: event.target.value }))} />
            </label>
            <button type="button" onClick={() => saveCustodyNote(record)} disabled={isSaving}>Add Note</button>
          </div>
        )}
      </article>
    );
  }

  return (
    <section className="panel shipping-dashboard-page">
      <div className="section-header">
        <div>
          <h2>Shipping / Receiving / Chain of Custody</h2>
          <p className="muted-text">Manual shipping metadata, inbound receiving records, tracking references, label links, custody events, and operational status. Carrier labels and rates stay in each shop&apos;s own shipping tools.</p>
        </div>
        <button type="button" onClick={loadShippingDashboard} disabled={isLoading}>{isLoading ? 'Refreshing...' : 'Refresh'}</button>
      </div>

      <div className="shipping-dashboard-layout">
        <form className="inventory-editor shipping-record-form" onSubmit={saveShippingRecord}>
          <h3>New Shipping / Custody Record</h3>
          <div className="form-grid">
            <label>Type
              <select disabled={!canWrite} value={shippingForm.direction} onChange={(event) => updateShippingForm('direction', event.target.value)}>
                {SHIPMENT_DIRECTIONS.map((direction) => (
                  <option key={direction} value={direction}>{formatLabel(direction)}</option>
                ))}
              </select>
            </label>
            <label>Status
              <select disabled={!canWrite} value={shippingForm.status} onChange={(event) => updateShippingForm('status', event.target.value)}>
                {SHIPMENT_STATUSES.map((status) => (
                  <option key={status} value={status}>{formatLabel(status)}</option>
                ))}
              </select>
            </label>
            <label>Pickup / Ship
              <select disabled={!canWrite} value={shippingForm.fulfillmentMethod} onChange={(event) => updateShippingForm('fulfillmentMethod', event.target.value)}>
                <option value="ship">Ship</option>
                <option value="pickup">Pickup</option>
              </select>
            </label>
            <label>Job
              <select disabled={!canWrite} value={shippingForm.jobId} onChange={(event) => handleJobChange(event.target.value)}>
                <option value="">No job</option>
                {jobs.map((job) => (
                  <option key={job.id} value={job.id}>{getJobLabel(job)}</option>
                ))}
              </select>
            </label>
            <label>Customer
              <select disabled={!canWrite} value={shippingForm.customerId} onChange={(event) => updateShippingForm('customerId', event.target.value)}>
                <option value="">No customer</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>{getCustomerName(customer) || customer.email || customer.id}</option>
                ))}
              </select>
            </label>
            <label>Vendor
              <select disabled={!canWrite} value={shippingForm.vendorId} onChange={(event) => updateShippingForm('vendorId', event.target.value)}>
                <option value="">No vendor</option>
                {vendors.map((vendor) => (
                  <option key={vendor.id} value={vendor.id}>{vendor.name}</option>
                ))}
              </select>
            </label>
            <label>Purchase Order
              <select disabled={!canWrite} value={shippingForm.purchaseOrderId} onChange={(event) => handlePurchaseOrderChange(event.target.value)}>
                <option value="">No PO</option>
                {purchaseOrders.map((order) => (
                  <option key={order.id} value={order.id}>{order.poNumber}</option>
                ))}
              </select>
            </label>
            <label>Item / Instrument / Package
              <input disabled={!canWrite} value={shippingForm.itemDescription} onChange={(event) => updateShippingForm('itemDescription', event.target.value)} />
            </label>
            <label>Item Type
              <select disabled={!canWrite} value={shippingForm.itemType} onChange={(event) => updateShippingForm('itemType', event.target.value)}>
                {SHIPPING_ITEM_TYPES.map((type) => (
                  <option key={type} value={type}>{formatLabel(type)}</option>
                ))}
              </select>
            </label>
            <label>Qty
              <input disabled={!canWrite} type="number" min="1" step="1" value={shippingForm.itemQuantity} onChange={(event) => updateShippingForm('itemQuantity', event.target.value)} />
            </label>
            <label>Receiving Destination
              <select disabled={!canWrite} value={shippingForm.itemDisposition} onChange={(event) => updateShippingForm('itemDisposition', event.target.value)}>
                {SHIPPING_ITEM_DISPOSITIONS.map((disposition) => (
                  <option key={disposition} value={disposition}>{formatLabel(disposition)}</option>
                ))}
              </select>
            </label>
            <label>Location
              <input disabled={!canWrite} list="shipping-location-options" value={shippingForm.assignedLocation} onChange={(event) => updateShippingForm('assignedLocation', event.target.value)} />
            </label>
            <label>Category
              <input disabled={!canWrite} list="shipping-category-options" value={shippingForm.assignedCategory} onChange={(event) => updateShippingForm('assignedCategory', event.target.value)} />
            </label>
            <label>Carrier
              <input disabled={!canWrite} value={shippingForm.carrier} onChange={(event) => updateShippingForm('carrier', event.target.value)} />
            </label>
            <label>Service
              <input disabled={!canWrite} value={shippingForm.serviceLevel} onChange={(event) => updateShippingForm('serviceLevel', event.target.value)} />
            </label>
            <label>Tracking Number
              <input disabled={!canWrite} value={shippingForm.trackingNumber} onChange={(event) => updateShippingForm('trackingNumber', event.target.value)} />
            </label>
            <label>Tracking URL
              <input disabled={!canWrite} value={shippingForm.trackingUrl} onChange={(event) => updateShippingForm('trackingUrl', event.target.value)} />
            </label>
            <label>Label Reference
              <input disabled={!canWrite} value={shippingForm.labelReference} onChange={(event) => updateShippingForm('labelReference', event.target.value)} />
            </label>
            <label>Label URL / Upload Placeholder
              <input disabled={!canWrite} value={shippingForm.labelUrl} onChange={(event) => updateShippingForm('labelUrl', event.target.value)} />
            </label>
            <label>Declared Value
              <input disabled={!canWrite} type="number" min="0" step="0.01" value={shippingForm.declaredValue} onChange={(event) => updateShippingForm('declaredValue', event.target.value)} />
            </label>
            <label>Shipping Cost
              <input disabled={!canWrite} type="number" min="0" step="0.01" value={shippingForm.shippingCost} onChange={(event) => updateShippingForm('shippingCost', event.target.value)} />
            </label>
            <label>Shipping Charge
              <input disabled={!canWrite} type="number" min="0" step="0.01" value={shippingForm.shippingCharge} onChange={(event) => updateShippingForm('shippingCharge', event.target.value)} />
            </label>
          </div>
          <datalist id="shipping-location-options">
            {locationOptions.map((option) => <option key={option} value={option} />)}
          </datalist>
          <datalist id="shipping-category-options">
            {categoryOptions.map((option) => <option key={option} value={option} />)}
          </datalist>
          <div className="form-grid">
            <label>Received Condition
              <input disabled={!canWrite} value={shippingForm.receivedCondition} onChange={(event) => updateShippingForm('receivedCondition', event.target.value)} />
            </label>
            <label>Condition Notes
              <input disabled={!canWrite} value={shippingForm.conditionNotes} onChange={(event) => updateShippingForm('conditionNotes', event.target.value)} />
            </label>
            <label>Packing Notes
              <input disabled={!canWrite} value={shippingForm.packingNotes} onChange={(event) => updateShippingForm('packingNotes', event.target.value)} />
            </label>
            <label>Internal Notes
              <input disabled={!canWrite} value={shippingForm.notes} onChange={(event) => updateShippingForm('notes', event.target.value)} />
            </label>
          </div>
          <div className="mode-actions">
            <label className="table-checkbox">
              <input disabled={!canWrite} type="checkbox" checked={shippingForm.insuranceRequired} onChange={(event) => updateShippingForm('insuranceRequired', event.target.checked)} />
              Insurance required
            </label>
            <label className="table-checkbox">
              <input disabled={!canWrite} type="checkbox" checked={shippingForm.signatureRequired} onChange={(event) => updateShippingForm('signatureRequired', event.target.checked)} />
              Signature required
            </label>
            <label className="table-checkbox">
              <input disabled={!canWrite} type="checkbox" checked={shippingForm.customerNotified} onChange={(event) => updateShippingForm('customerNotified', event.target.checked)} />
              Customer notified
            </label>
          </div>
          {canWrite ? (
            <div className="mode-actions">
              <button type="submit" className="primary-action" disabled={isSaving}>{isSaving ? 'Saving...' : 'Create Shipping Record'}</button>
            </div>
          ) : (
            <p className="muted-text">Viewer/read-only access can review shipping and custody records but cannot edit them.</p>
          )}
        </form>

        <div className="shipping-dashboard-groups">
          {dashboardGroups.map((group) => {
            const groupRecords = records.filter((record) => group.statuses.includes(record.status));
            return (
              <section className="shipping-dashboard-group" key={group.id}>
                <div className="editor-heading">
                  <h3>{group.title}</h3>
                  <span className="status-pill">{groupRecords.length}</span>
                </div>
                {groupRecords.map(renderRecord)}
                {!groupRecords.length && <p className="muted-text">No records in this stage.</p>}
              </section>
            );
          })}
        </div>
      </div>
    </section>
  );
}
