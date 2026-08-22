import { useEffect, useMemo, useRef, useState } from 'react';
import { money } from '../../shared/utils/money.js';
import { getShopMoneyOptions } from '../shops/shopConfig.js';
import {
  createSpecialistPurchaseOrder,
  fulfillSpecialistPurchaseOrderItem,
  listJobPurchaseOrders,
  listParts,
  listVendors
} from './inventoryService.js';
import { PURCHASE_UNIT_OPTIONS, purchaseConversionSummary } from './purchaseUnits.js';

function newForm() {
  return {
    keyboardPartRequestId: '',
    vendorId: '',
    partId: '',
    description: '',
    vendorSku: '',
    quantityOrdered: 1,
    jobQuantity: 1,
    purchaseUnit: 'each',
    unitsPerPurchaseUnit: 1,
    unitCost: '',
    retailPrice: '',
    expectedAt: '',
    notes: ''
  };
}

function statusLabel(value) {
  return String(value || 'draft').replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function SpecialistPurchasingPanel({
  job,
  canWrite = false,
  keyboardPartRequests = [],
  shopProfile = null,
  onInventoryPartAdded,
  onPurchasingChanged,
  onOpenInventory,
  onNotice
}) {
  const [parts, setParts] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [orders, setOrders] = useState([]);
  const [form, setForm] = useState(newForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const submitLockRef = useRef(false);
  const requestKeyRef = useRef(crypto.randomUUID());
  const moneyOptions = getShopMoneyOptions(shopProfile || undefined);
  const vendorsById = useMemo(() => new Map(vendors.map((vendor) => [vendor.id, vendor])), [vendors]);
  const partsById = useMemo(() => new Map(parts.map((part) => [part.id, part])), [parts]);
  const openKeyboardRequests = keyboardPartRequests.filter((request) => (
    !request.jobPartId && !['installed', 'not_needed', 'ordered', 'received'].includes(request.requestStatus)
  ));

  async function load() {
    if (!job?.id || !job?.shopId) return;
    setIsLoading(true);
    setLoadError('');
    try {
      const [nextParts, nextVendors, nextOrders] = await Promise.all([
        listParts(job.shopId, { activeOnly: true }),
        listVendors(job.shopId, { activeOnly: true }),
        listJobPurchaseOrders(job.id)
      ]);
      setParts(nextParts);
      setVendors(nextVendors);
      setOrders(nextOrders);
    } catch (error) {
      setLoadError(error.message || 'Unable to load job purchasing.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    setForm(newForm());
    requestKeyRef.current = crypto.randomUUID();
    load();
  }, [job?.id]);

  function updateForm(name, value) {
    setForm((current) => {
      const next = { ...current, [name]: value };
      if (name === 'partId') {
        const part = partsById.get(value);
        if (part) {
          next.description = part.name;
          next.vendorSku = part.vendorSku;
          next.purchaseUnit = part.purchaseUnit;
          next.unitsPerPurchaseUnit = part.unitsPerPurchaseUnit;
          next.retailPrice = part.retailPrice;
          if (part.vendorId) next.vendorId = part.vendorId;
        }
      }
      if (name === 'keyboardPartRequestId') {
        const request = keyboardPartRequests.find((item) => item.id === value);
        if (request) {
          next.description = request.requestedPart;
          next.jobQuantity = request.quantity;
          next.partId = request.inventoryPartId || '';
          const part = partsById.get(request.inventoryPartId);
          if (part) {
            next.vendorSku = part.vendorSku;
            next.purchaseUnit = part.purchaseUnit;
            next.unitsPerPurchaseUnit = part.unitsPerPurchaseUnit;
            next.retailPrice = part.retailPrice;
            if (part.vendorId) next.vendorId = part.vendorId;
          }
        }
      }
      return next;
    });
  }

  async function createOrder(event) {
    event.preventDefault();
    if (submitLockRef.current) return;
    if (!form.vendorId) {
      onNotice?.({ type: 'error', message: 'Choose a vendor before creating the purchase order.' });
      return;
    }
    if (!form.partId && !form.description.trim()) {
      onNotice?.({ type: 'error', message: 'Choose an inventory part or enter the part that needs ordering.' });
      return;
    }

    submitLockRef.current = true;
    setIsSaving(true);
    try {
      const result = await createSpecialistPurchaseOrder(job.id, {
        ...form,
        requestKey: requestKeyRef.current
      });
      requestKeyRef.current = crypto.randomUUID();
      setForm(newForm());
      await Promise.all([load(), onPurchasingChanged?.()]);
      onNotice?.({
        type: 'success',
        message: `${result.purchaseOrder.poNumber || 'Purchase order'} is linked to work order ${job.jobNumber || ''}.`
      });
    } catch (error) {
      onNotice?.({ type: 'error', message: error.message || 'Unable to create the linked purchase order.' });
    } finally {
      submitLockRef.current = false;
      setIsSaving(false);
    }
  }

  async function addReceivedItem(item) {
    if (submitLockRef.current) return;
    submitLockRef.current = true;
    setIsSaving(true);
    try {
      const jobPart = await fulfillSpecialistPurchaseOrderItem(item.id);
      onInventoryPartAdded?.(jobPart);
      await Promise.all([load(), onPurchasingChanged?.()]);
      onNotice?.({ type: 'success', message: `${item.description} was added to Parts & Payments.` });
    } catch (error) {
      onNotice?.({ type: 'error', message: error.message || 'Unable to add the received part to this work order.' });
    } finally {
      submitLockRef.current = false;
      setIsSaving(false);
    }
  }

  return (
    <section className="panel specialist-purchasing-panel">
      <div className="editor-heading">
        <div>
          <h3>Parts Purchasing</h3>
          <p className="muted-text">Order against this work order, receive through Inventory, then add only the required quantity to customer billing.</p>
        </div>
        <div className="mode-actions no-print">
          <button type="button" className="button-tertiary" onClick={load} disabled={isLoading || isSaving}>Reload</button>
          <button type="button" className="button-tertiary" onClick={onOpenInventory}>Open Inventory & Receiving</button>
        </div>
      </div>

      {loadError && <p className="form-error" role="alert">{loadError}</p>}
      {!vendors.length && !isLoading && (
        <p className="empty-state">Add at least one active vendor in Inventory before creating a linked purchase order.</p>
      )}

      <form onSubmit={createOrder}>
        <div className="form-grid specialist-purchasing-grid">
          {keyboardPartRequests.length > 0 && (
            <label className="wide">Keyboard Parts Request
              <select value={form.keyboardPartRequestId} onChange={(event) => updateForm('keyboardPartRequestId', event.target.value)} disabled={!canWrite || isSaving}>
                <option value="">Order an unlinked part</option>
                {openKeyboardRequests.map((request) => (
                  <option key={request.id} value={request.id}>{request.requestedPart} × {request.quantity}</option>
                ))}
              </select>
            </label>
          )}
          <label>Vendor
            <select value={form.vendorId} onChange={(event) => updateForm('vendorId', event.target.value)} disabled={!canWrite || isSaving}>
              <option value="">Choose vendor</option>
              {vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}
            </select>
          </label>
          <label>Inventory Part
            <select value={form.partId} onChange={(event) => updateForm('partId', event.target.value)} disabled={!canWrite || isSaving}>
              <option value="">Create new inventory part</option>
              {parts.map((part) => <option key={part.id} value={part.id}>{part.name} ({part.quantityOnHand} on hand)</option>)}
            </select>
          </label>
          <label className="wide">Part / Description
            <input value={form.description} onChange={(event) => updateForm('description', event.target.value)} disabled={!canWrite || isSaving || Boolean(form.partId)} placeholder="6L6 matched pair, key contact strip…" />
          </label>
          <label>Vendor SKU
            <input value={form.vendorSku} onChange={(event) => updateForm('vendorSku', event.target.value)} disabled={!canWrite || isSaving} />
          </label>
          <label>Purchase Quantity
            <input type="number" min="1" max="999999" step="1" value={form.quantityOrdered} onChange={(event) => updateForm('quantityOrdered', event.target.value)} disabled={!canWrite || isSaving} />
          </label>
          <label>Purchase Unit
            <select value={form.purchaseUnit} onChange={(event) => updateForm('purchaseUnit', event.target.value)} disabled={!canWrite || isSaving || Boolean(form.partId)}>
              {PURCHASE_UNIT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label>Units per Purchase Unit
            <input type="number" min="1" max="999999" step="1" value={form.unitsPerPurchaseUnit} onChange={(event) => updateForm('unitsPerPurchaseUnit', event.target.value)} disabled={!canWrite || isSaving || Boolean(form.partId)} />
          </label>
          <label>Quantity for This Job
            <input type="number" min="1" max="999999" step="1" value={form.jobQuantity} onChange={(event) => updateForm('jobQuantity', event.target.value)} disabled={!canWrite || isSaving || Boolean(form.keyboardPartRequestId)} />
          </label>
          <label>Cost per Purchase Unit
            <input type="number" min="0" step="0.01" value={form.unitCost} onChange={(event) => updateForm('unitCost', event.target.value)} disabled={!canWrite || isSaving} />
          </label>
          <label>Customer Price per Unit
            <input type="number" min="0" step="0.01" value={form.retailPrice} onChange={(event) => updateForm('retailPrice', event.target.value)} disabled={!canWrite || isSaving || Boolean(form.partId)} />
          </label>
          <label>Expected
            <input type="date" value={form.expectedAt} onChange={(event) => updateForm('expectedAt', event.target.value)} disabled={!canWrite || isSaving} />
          </label>
          <label className="wide">PO Note
            <input value={form.notes} onChange={(event) => updateForm('notes', event.target.value)} disabled={!canWrite || isSaving} placeholder={`For work order ${job.jobNumber || ''}`} />
          </label>
        </div>
        <p className="muted-text">{purchaseConversionSummary(form.quantityOrdered, form.purchaseUnit, form.unitsPerPurchaseUnit)}. {form.jobQuantity || 0} will be reserved for this work order after receipt.</p>
        {canWrite && <button type="submit" disabled={isSaving || isLoading || !vendors.length}>{isSaving ? 'Working…' : 'Create Linked Purchase Order'}</button>}
      </form>

      <div className="specialist-purchase-orders">
        <h4>Linked Orders</h4>
        {!orders.length && !isLoading && <p className="empty-state">No purchase orders are linked to this work order.</p>}
        {orders.flatMap((order) => order.items.map((item) => (
          <div className="specialist-purchase-order" key={item.id}>
            <div>
              <strong>{order.poNumber} · {item.description}</strong>
              <span>{vendorsById.get(order.vendorId)?.name || 'Unknown vendor'} · {statusLabel(order.status)}</span>
              <span>Ordered {item.quantityOrdered}; received {item.quantityReceived}; job quantity {item.jobQuantity}</span>
              <span>{money(item.unitCost, moneyOptions)} per {item.purchaseUnit}</span>
            </div>
            {item.jobPartId
              ? <span className="status-pill success">Added to billing</span>
              : item.quantityReceived > 0 && order.status !== 'cancelled' && (
                <button type="button" onClick={() => addReceivedItem(item)} disabled={!canWrite || isSaving}>Add to Parts & Payments</button>
              )}
          </div>
        )))}
      </div>
    </section>
  );
}
