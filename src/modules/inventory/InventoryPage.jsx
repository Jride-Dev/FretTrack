import { useEffect, useMemo, useState } from 'react';
import { money } from '../../shared/utils/money';
import { getCurrentShopId, getShopMoneyOptions } from '../shops/shopConfig';
import {
  adjustPart,
  createPart,
  createPurchaseOrder,
  createVendor,
  deactivatePart,
  fixMissingPartBarcodeCode,
  listPartMovements,
  listPartPurchaseHistory,
  listParts,
  listPurchaseHistory,
  listPurchaseOrders,
  listVendors,
  receivePart,
  receivePurchaseOrderItems,
  updatePart,
  updatePurchaseOrderStatus,
  updateVendor
} from './inventoryService';
import useUnsavedChanges from '../../hooks/useUnsavedChanges';
import UnsavedChangesBadge from '../../shared/components/UnsavedChangesBadge.jsx';
import BarcodeLabelSheet from './BarcodeLabelSheet.jsx';

const emptyPartForm = {
  vendorId: '',
  sku: '',
  name: '',
  description: '',
  category: '',
  supplier: '',
  vendorSku: '',
  barcodeCode: '',
  manufacturer: '',
  partNumber: '',
  unitCost: '',
  retailPrice: '',
  quantityOnHand: '0',
  reorderPoint: '0',
  desiredStockLevel: '0',
  location: '',
  isActive: true
};

const emptyVendorForm = {
  name: '',
  contactName: '',
  email: '',
  phone: '',
  website: '',
  notes: '',
  isActive: true
};

const emptyPurchaseOrderItem = {
  partId: '',
  description: '',
  vendorSku: '',
  quantityOrdered: '1',
  unitCost: ''
};

const emptyPurchaseOrderForm = {
  vendorId: '',
  status: 'draft',
  orderedAt: '',
  expectedAt: '',
  notes: '',
  items: [{ ...emptyPurchaseOrderItem }]
};

const purchaseOrderStatuses = ['draft', 'ordered', 'partially_received', 'received', 'cancelled'];
const purchaseOrderFilterOptions = ['all', ...purchaseOrderStatuses];

function formatStatusLabel(status = '') {
  return status
    .split('_')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ') || 'Draft';
}

function formatDate(value) {
  if (!value) {
    return '-';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString();
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

function getBarcodeLabel(part) {
  return part?.barcodeCode ? `FT-PART-${part.barcodeCode}` : '-';
}

function remainingForItem(item) {
  return Math.max(Number(item.quantityOrdered || 0) - Number(item.quantityReceived || 0), 0);
}

function purchaseOrderTotals(order) {
  const items = order?.items || [];
  return items.reduce((totals, item) => {
    const ordered = Number(item.quantityOrdered || 0);
    const received = Number(item.quantityReceived || 0);
    const cost = Number(item.unitCost || 0);
    totals.lineCount += 1;
    totals.ordered += ordered;
    totals.received += received;
    totals.remaining += Math.max(ordered - received, 0);
    totals.estimatedCost += ordered * cost;
    return totals;
  }, {
    lineCount: 0,
    ordered: 0,
    received: 0,
    remaining: 0,
    estimatedCost: 0
  });
}

export default function InventoryPage({ canWrite = true, shopId = getCurrentShopId(), onNotice, onDirtyChange }) {
  const [activeTab, setActiveTab] = useState('parts');
  const [parts, setParts] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [poStatusFilter, setPoStatusFilter] = useState('all');
  const [selectedPartId, setSelectedPartId] = useState('');
  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [selectedPurchaseOrderId, setSelectedPurchaseOrderId] = useState('');
  const [selectedLabelPartIds, setSelectedLabelPartIds] = useState([]);
  const [partForm, setPartForm] = useState(emptyPartForm);
  const [vendorForm, setVendorForm] = useState(emptyVendorForm);
  const [purchaseOrderForm, setPurchaseOrderForm] = useState(emptyPurchaseOrderForm);
  const [receiveForm, setReceiveForm] = useState({ quantity: '1', cost: '', note: '' });
  const [adjustForm, setAdjustForm] = useState({ quantityDelta: '0', note: '' });
  const [purchaseReceiveQuantities, setPurchaseReceiveQuantities] = useState({});
  const [purchaseReceiveCosts, setPurchaseReceiveCosts] = useState({});
  const [purchaseReceiveNote, setPurchaseReceiveNote] = useState('');
  const [partMovements, setPartMovements] = useState([]);
  const [partPurchaseHistory, setPartPurchaseHistory] = useState([]);
  const [purchaseHistory, setPurchaseHistory] = useState([]);
  const [isPrintingLabels, setIsPrintingLabels] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { isDirty, markDirty, markClean, confirmIfDirty } = useUnsavedChanges();
  const [saveStatus, setSaveStatus] = useState('saved');
  const moneyOptions = getShopMoneyOptions();

  const selectedPart = useMemo(
    () => parts.find((part) => part.id === selectedPartId) || null,
    [parts, selectedPartId]
  );
  const selectedVendor = useMemo(
    () => vendors.find((vendor) => vendor.id === selectedVendorId) || null,
    [vendors, selectedVendorId]
  );
  const selectedPurchaseOrder = useMemo(
    () => purchaseOrders.find((order) => order.id === selectedPurchaseOrderId) || null,
    [purchaseOrders, selectedPurchaseOrderId]
  );
  const vendorsById = useMemo(
    () => new Map(vendors.map((vendor) => [vendor.id, vendor])),
    [vendors]
  );
  const selectedLabelParts = useMemo(
    () => selectedLabelPartIds
      .map((partId) => parts.find((part) => part.id === partId))
      .filter(Boolean),
    [parts, selectedLabelPartIds]
  );
  const filteredPurchaseOrders = useMemo(
    () => poStatusFilter === 'all'
      ? purchaseOrders
      : purchaseOrders.filter((order) => order.status === poStatusFilter),
    [purchaseOrders, poStatusFilter]
  );

  useEffect(() => {
    loadInventoryPage().catch((error) => {
      console.error('Inventory load failed.', error);
      onNotice?.({ type: 'error', message: error.message || 'Unable to load inventory.' });
    });
  }, [shopId]);

  useEffect(() => {
    onDirtyChange?.(isDirty);
    return () => onDirtyChange?.(false);
  }, [isDirty, onDirtyChange]);

  useEffect(() => {
    if (!selectedPartId) {
      setPartMovements([]);
      setPartPurchaseHistory([]);
      return;
    }

    Promise.all([
      listPartMovements(selectedPartId),
      listPartPurchaseHistory(selectedPartId)
    ])
      .then(([movements, purchaseHistory]) => {
        setPartMovements(movements);
        setPartPurchaseHistory(purchaseHistory);
      })
      .catch((error) => {
        console.error('Part history load failed.', error);
        setPartMovements([]);
        setPartPurchaseHistory([]);
      });
  }, [selectedPartId]);

  useEffect(() => {
    if (!isPrintingLabels) {
      return undefined;
    }

    document.body.classList.add('barcode-label-printing');
    const handleAfterPrint = () => {
      document.body.classList.remove('barcode-label-printing');
      setIsPrintingLabels(false);
    };

    window.addEventListener('afterprint', handleAfterPrint);
    return () => {
      window.removeEventListener('afterprint', handleAfterPrint);
      document.body.classList.remove('barcode-label-printing');
    };
  }, [isPrintingLabels]);

  async function loadInventoryPage() {
    setIsLoading(true);
    try {
      const [loadedParts, loadedVendors, loadedOrders, loadedHistory] = await Promise.all([
        listParts(shopId, { search, activeOnly: !showInactive, lowStockOnly }),
        listVendors(shopId, { activeOnly: false }),
        listPurchaseOrders(shopId),
        listPurchaseHistory({ shopId })
      ]);
      setParts(loadedParts);
      setVendors(loadedVendors);
      setPurchaseOrders(loadedOrders);
      setPurchaseHistory(loadedHistory);
      return { loadedParts, loadedVendors, loadedOrders, loadedHistory };
    } finally {
      setIsLoading(false);
    }
  }

  async function loadPartsOnly(filters = { search, activeOnly: !showInactive, lowStockOnly }) {
    setIsLoading(true);
    try {
      const loadedParts = await listParts(shopId, filters);
      setParts(loadedParts);
      return loadedParts;
    } finally {
      setIsLoading(false);
    }
  }

  async function refreshPurchasingData() {
    const [loadedVendors, loadedOrders, loadedHistory] = await Promise.all([
      listVendors(shopId, { activeOnly: false }),
      listPurchaseOrders(shopId),
      listPurchaseHistory({ shopId })
    ]);
    setVendors(loadedVendors);
    setPurchaseOrders(loadedOrders);
    setPurchaseHistory(loadedHistory);
    return { loadedVendors, loadedOrders, loadedHistory };
  }

  async function handleSearch(event) {
    event.preventDefault();
    await loadPartsOnly({ search, activeOnly: !showInactive, lowStockOnly });
  }

  function updatePartForm(field, value) {
    setPartForm((current) => ({ ...current, [field]: value }));
    markDirty();
    setSaveStatus('unsaved');
  }

  function loadPartIntoForm(part) {
    setSelectedPartId(part.id);
    setPartForm({
      vendorId: part.vendorId || '',
      sku: part.sku || '',
      name: part.name || '',
      description: part.description || '',
      category: part.category || '',
      supplier: part.supplier || '',
      vendorSku: part.vendorSku || '',
      barcodeCode: part.barcodeCode || '',
      manufacturer: part.manufacturer || '',
      partNumber: part.partNumber || '',
      unitCost: String(part.unitCost ?? ''),
      retailPrice: String(part.retailPrice ?? ''),
      quantityOnHand: String(part.quantityOnHand ?? 0),
      reorderPoint: String(part.reorderPoint ?? 0),
      desiredStockLevel: String(part.desiredStockLevel ?? 0),
      location: part.location || '',
      isActive: part.isActive !== false
    });
    setReceiveForm({ quantity: '1', cost: String(part.unitCost ?? ''), note: '' });
    setAdjustForm({ quantityDelta: '0', note: '' });
    markClean();
    setSaveStatus('saved');
  }

  function selectPart(part, options = {}) {
    if (!options.skipDirtyGuard && !confirmIfDirty()) {
      return;
    }

    loadPartIntoForm(part);
  }

  function resetForm(options = {}) {
    if (!options.skipDirtyGuard && !confirmIfDirty()) {
      return;
    }

    setSelectedPartId('');
    setPartForm(emptyPartForm);
    setReceiveForm({ quantity: '1', cost: '', note: '' });
    setAdjustForm({ quantityDelta: '0', note: '' });
    markClean();
    setSaveStatus('saved');
  }

  async function savePart(event) {
    event.preventDefault();
    if (!canWrite) {
      return;
    }
    if (!partForm.name.trim()) {
      onNotice?.({ type: 'error', message: 'Part name is required.' });
      return;
    }

    setIsSaving(true);
    setSaveStatus('saving');
    try {
      const savedPart = selectedPart
        ? await updatePart(selectedPart.id, partForm)
        : await createPart(shopId, partForm);
      onNotice?.({ type: 'success', message: selectedPart ? 'Part updated.' : 'Part created.' });
      markClean();
      setSaveStatus('saved');
      resetForm({ skipDirtyGuard: true });
      const loadedParts = await loadPartsOnly({ search, activeOnly: !showInactive, lowStockOnly });
      const nextPart = loadedParts.find((part) => part.id === savedPart.id);
      if (nextPart) {
        selectPart(nextPart, { skipDirtyGuard: true });
      }
    } catch (error) {
      console.error('Inventory save failed.', error);
      markDirty();
      setSaveStatus('error');
      onNotice?.({ type: 'error', message: error.message || 'Unable to save part.' });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleReceive(event) {
    event.preventDefault();
    if (!canWrite || !selectedPart) {
      return;
    }
    const receiveQuantity = Number.parseInt(receiveForm.quantity, 10);
    const receiveCost = receiveForm.cost === '' ? null : Number(receiveForm.cost);
    if (!Number.isFinite(receiveQuantity) || receiveQuantity < 1) {
      onNotice?.({ type: 'error', message: 'Receive quantity must be at least 1.' });
      return;
    }
    if (receiveCost !== null && (!Number.isFinite(receiveCost) || receiveCost < 0)) {
      onNotice?.({ type: 'error', message: 'Unit cost cannot be negative.' });
      return;
    }
    setIsSaving(true);
    try {
      await receivePart(selectedPart.id, receiveForm.quantity, receiveForm.cost, receiveForm.note);
      onNotice?.({ type: 'success', message: 'Stock received.' });
      setReceiveForm({ quantity: '1', cost: receiveForm.cost, note: '' });
      await Promise.all([
        loadPartsOnly({ search, activeOnly: !showInactive, lowStockOnly }),
        refreshPurchasingData()
      ]);
      const [movements, purchaseRows] = await Promise.all([
        listPartMovements(selectedPart.id),
        listPartPurchaseHistory(selectedPart.id)
      ]);
      setPartMovements(movements);
      setPartPurchaseHistory(purchaseRows);
    } catch (error) {
      console.error('Receive stock failed.', error);
      onNotice?.({ type: 'error', message: error.message || 'Unable to receive stock.' });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleGenerateBarcodeCode() {
    if (!canWrite || !selectedPart) {
      return;
    }

    setIsSaving(true);
    try {
      const updatedPart = await fixMissingPartBarcodeCode(selectedPart);
      onNotice?.({ type: 'success', message: 'Barcode code generated.' });
      const loadedParts = await loadPartsOnly({ search, activeOnly: !showInactive, lowStockOnly });
      const nextPart = loadedParts.find((part) => part.id === updatedPart.id);
      if (nextPart) {
        selectPart(nextPart, { skipDirtyGuard: true });
      }
    } catch (error) {
      console.error('Generate barcode code failed.', error);
      onNotice?.({ type: 'error', message: error.message || 'Unable to generate barcode code.' });
    } finally {
      setIsSaving(false);
    }
  }

  function toggleLabelPart(partId, checked) {
    setSelectedLabelPartIds((current) => {
      if (checked) {
        return current.includes(partId) ? current : [...current, partId];
      }
      return current.filter((id) => id !== partId);
    });
  }

  function selectVisibleLabelParts() {
    setSelectedLabelPartIds(parts.filter((part) => part.barcodeCode).map((part) => part.id));
  }

  function printBarcodeLabels() {
    if (!selectedLabelParts.length) {
      onNotice?.({ type: 'error', message: 'Select at least one part with a barcode code.' });
      return;
    }
    setIsPrintingLabels(true);
    window.setTimeout(() => window.print(), 80);
  }

  async function handleAdjust(event) {
    event.preventDefault();
    if (!canWrite || !selectedPart) {
      return;
    }
    setIsSaving(true);
    try {
      await adjustPart(selectedPart.id, adjustForm.quantityDelta, adjustForm.note);
      onNotice?.({ type: 'success', message: 'Stock adjusted.' });
      setAdjustForm({ quantityDelta: '0', note: '' });
      await loadPartsOnly({ search, activeOnly: !showInactive, lowStockOnly });
    } catch (error) {
      console.error('Adjust stock failed.', error);
      onNotice?.({ type: 'error', message: error.message || 'Unable to adjust stock.' });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeactivate() {
    if (!canWrite || !selectedPart) {
      return;
    }
    const confirmed = window.confirm(`Deactivate ${selectedPart.name}?`);
    if (!confirmed) {
      return;
    }
    setIsSaving(true);
    try {
      await deactivatePart(selectedPart.id);
      onNotice?.({ type: 'success', message: 'Part deactivated.' });
      resetForm({ skipDirtyGuard: true });
      await loadPartsOnly({ search, activeOnly: !showInactive, lowStockOnly });
    } catch (error) {
      console.error('Deactivate part failed.', error);
      onNotice?.({ type: 'error', message: error.message || 'Unable to deactivate part.' });
    } finally {
      setIsSaving(false);
    }
  }

  function loadVendorIntoForm(vendor) {
    setSelectedVendorId(vendor.id);
    setVendorForm({
      name: vendor.name || '',
      contactName: vendor.contactName || '',
      email: vendor.email || '',
      phone: vendor.phone || '',
      website: vendor.website || '',
      notes: vendor.notes || '',
      isActive: vendor.isActive !== false
    });
  }

  function resetVendorForm() {
    setSelectedVendorId('');
    setVendorForm(emptyVendorForm);
  }

  function updatePurchaseOrderItem(index, field, value) {
    setPurchaseOrderForm((current) => {
      const items = current.items.map((item, itemIndex) => {
        if (itemIndex !== index) {
          return item;
        }
        if (field === 'partId') {
          const matchedPart = parts.find((part) => part.id === value);
          return {
            ...item,
            partId: value,
            description: matchedPart?.name || item.description,
            vendorSku: matchedPart?.vendorSku || item.vendorSku,
            unitCost: matchedPart?.lastCost ?? matchedPart?.unitCost ?? item.unitCost
          };
        }
        return { ...item, [field]: value };
      });
      return { ...current, items };
    });
  }

  async function saveVendor(event) {
    event.preventDefault();
    if (!canWrite) {
      return;
    }
    setIsSaving(true);
    try {
      const savedVendor = selectedVendor
        ? await updateVendor(selectedVendor.id, { ...vendorForm, shopId })
        : await createVendor(shopId, vendorForm);
      onNotice?.({ type: 'success', message: selectedVendor ? 'Vendor updated.' : 'Vendor created.' });
      resetVendorForm();
      const { loadedVendors } = await refreshPurchasingData();
      const nextVendor = loadedVendors.find((vendor) => vendor.id === savedVendor.id);
      if (nextVendor) {
        loadVendorIntoForm(nextVendor);
      }
    } catch (error) {
      console.error('Vendor save failed.', error);
      onNotice?.({ type: 'error', message: error.message || 'Unable to save vendor.' });
    } finally {
      setIsSaving(false);
    }
  }

  async function savePurchaseOrder(event) {
    event.preventDefault();
    if (!canWrite) {
      return;
    }
    setIsSaving(true);
    try {
      const savedOrder = await createPurchaseOrder(shopId, purchaseOrderForm);
      onNotice?.({ type: 'success', message: 'Purchase order created.' });
      setPurchaseOrderForm(emptyPurchaseOrderForm);
      const [{ loadedOrders }] = await Promise.all([
        refreshPurchasingData(),
        loadPartsOnly({ search, activeOnly: !showInactive, lowStockOnly })
      ]);
      setSelectedPurchaseOrderId(savedOrder.id);
      const nextOrder = loadedOrders.find((order) => order.id === savedOrder.id);
      if (nextOrder) {
        preparePurchaseReceiveForm(nextOrder);
      }
    } catch (error) {
      console.error('Purchase order save failed.', error);
      onNotice?.({ type: 'error', message: error.message || 'Unable to create purchase order.' });
    } finally {
      setIsSaving(false);
    }
  }

  function addPurchaseOrderItem() {
    setPurchaseOrderForm((current) => ({
      ...current,
      items: [...current.items, { ...emptyPurchaseOrderItem }]
    }));
  }

  function removePurchaseOrderItem(index) {
    setPurchaseOrderForm((current) => ({
      ...current,
      items: current.items.filter((_, itemIndex) => itemIndex !== index).length
        ? current.items.filter((_, itemIndex) => itemIndex !== index)
        : [{ ...emptyPurchaseOrderItem }]
    }));
  }

  function preparePurchaseReceiveForm(order) {
    const quantityMap = {};
    const costMap = {};
    for (const item of order.items || []) {
      quantityMap[item.id] = '';
      costMap[item.id] = String(item.unitCost ?? '');
    }
    setPurchaseReceiveQuantities(quantityMap);
    setPurchaseReceiveCosts(costMap);
    setPurchaseReceiveNote('');
  }

  function selectPurchaseOrder(order) {
    setSelectedPurchaseOrderId(order.id);
    preparePurchaseReceiveForm(order);
  }

  async function handlePurchaseOrderStatus(status) {
    if (!canWrite || !selectedPurchaseOrder) {
      return;
    }
    setIsSaving(true);
    try {
      await updatePurchaseOrderStatus(selectedPurchaseOrder.id, status);
      onNotice?.({ type: 'success', message: 'Purchase order status updated.' });
      await refreshPurchasingData();
    } catch (error) {
      console.error('Purchase order status update failed.', error);
      onNotice?.({ type: 'error', message: error.message || 'Unable to update purchase order status.' });
    } finally {
      setIsSaving(false);
    }
  }

  async function handlePurchaseReceive(event) {
    event.preventDefault();
    if (!canWrite || !selectedPurchaseOrder) {
      return;
    }
    const receiptItems = (selectedPurchaseOrder.items || [])
      .map((item) => ({
        purchaseOrderItemId: item.id,
        quantityReceived: purchaseReceiveQuantities[item.id],
        unitCost: purchaseReceiveCosts[item.id] || item.unitCost
      }))
      .filter((item) => Number(item.quantityReceived || 0) > 0);

    if (!receiptItems.length) {
      onNotice?.({ type: 'error', message: 'Enter a received quantity for at least one item.' });
      return;
    }

    const invalidReceipt = receiptItems.find((receiptItem) => {
      const sourceItem = selectedPurchaseOrder.items.find((item) => item.id === receiptItem.purchaseOrderItemId);
      const quantity = Number(receiptItem.quantityReceived || 0);
      const cost = Number(receiptItem.unitCost || 0);
      return !sourceItem
        || quantity < 1
        || quantity > remainingForItem(sourceItem)
        || !Number.isFinite(cost)
        || cost < 0;
    });

    if (invalidReceipt) {
      onNotice?.({ type: 'error', message: 'Receipt quantities must be positive and cannot exceed the remaining ordered quantity.' });
      return;
    }

    setIsSaving(true);
    try {
      const result = await receivePurchaseOrderItems(selectedPurchaseOrder.id, receiptItems, purchaseReceiveNote);
      onNotice?.({ type: 'success', message: `Received ${result?.receivedUnits || 'stock'} unit(s).` });
      await Promise.all([
        loadPartsOnly({ search, activeOnly: !showInactive, lowStockOnly }),
        refreshPurchasingData()
      ]);
      const refreshedOrder = (await listPurchaseOrders(shopId)).find((order) => order.id === selectedPurchaseOrder.id);
      if (refreshedOrder) {
        setPurchaseOrders((current) => current.map((order) => (order.id === refreshedOrder.id ? refreshedOrder : order)));
        preparePurchaseReceiveForm(refreshedOrder);
      }
    } catch (error) {
      console.error('Purchase order receive failed.', error);
      onNotice?.({ type: 'error', message: error.message || 'Unable to receive purchase order.' });
    } finally {
      setIsSaving(false);
    }
  }

  function renderTabs() {
    return (
      <div className="inventory-tabs" role="tablist" aria-label="Inventory sections">
        {[
          ['parts', 'Parts'],
          ['vendors', 'Vendors'],
          ['purchase-orders', 'Purchase Orders'],
          ['history', 'Purchase History'],
          ['labels', 'Barcode Labels']
        ].map(([tab, label]) => (
          <button
            key={tab}
            type="button"
            className={activeTab === tab ? 'active' : ''}
            onClick={() => setActiveTab(tab)}
          >
            {label}
          </button>
        ))}
      </div>
    );
  }

  function renderPartsTab() {
    return (
      <>
        <form className="row-form inventory-search" onSubmit={handleSearch}>
          <input
            placeholder="Search name, SKU, barcode, vendor SKU, category, or supplier"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <label className="table-checkbox">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(event) => setShowInactive(event.target.checked)}
            />
            Show inactive
          </label>
          <label className="table-checkbox">
            <input
              type="checkbox"
              checked={lowStockOnly}
              onChange={(event) => setLowStockOnly(event.target.checked)}
            />
            Low stock only
          </label>
          <button type="submit" disabled={isLoading}>{isLoading ? 'Searching...' : 'Search'}</button>
        </form>

        <div className="inventory-label-toolbar">
          <span>{selectedLabelPartIds.length} label part{selectedLabelPartIds.length === 1 ? '' : 's'} selected</span>
          <button type="button" onClick={selectVisibleLabelParts}>Select visible with barcodes</button>
          <button type="button" onClick={() => setSelectedLabelPartIds([])}>Clear labels</button>
          <button type="button" className="primary-action" onClick={() => setActiveTab('labels')}>Preview Labels</button>
        </div>

        <div className="inventory-layout">
          <div className="inventory-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Label</th>
                  <th>SKU</th>
                  <th>Name</th>
                  <th>Barcode</th>
                  <th>On hand</th>
                  <th>Reorder</th>
                  <th>Desired</th>
                  <th>Retail</th>
                  <th>Location</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {parts.map((part) => {
                  const isLowStock = part.quantityOnHand <= part.reorderPoint;
                  return (
                    <tr
                      key={part.id}
                      className={`${selectedPartId === part.id ? 'selected-row' : ''}${part.isActive ? '' : ' inactive-row'}`}
                      onClick={() => selectPart(part)}
                    >
                      <td onClick={(event) => event.stopPropagation()}>
                        <input
                          aria-label={`Select ${part.name} barcode label`}
                          disabled={!part.barcodeCode}
                          type="checkbox"
                          checked={selectedLabelPartIds.includes(part.id)}
                          onChange={(event) => toggleLabelPart(part.id, event.target.checked)}
                        />
                      </td>
                      <td>{part.sku || '-'}</td>
                      <td><strong>{part.name}</strong></td>
                      <td><code>{getBarcodeLabel(part)}</code></td>
                      <td>{part.quantityOnHand}</td>
                      <td>{part.reorderPoint}</td>
                      <td>{part.desiredStockLevel}</td>
                      <td>{money(part.retailPrice, moneyOptions)}</td>
                      <td>{part.location || '-'}</td>
                      <td>
                        <span className={`status-pill ${part.isActive ? (isLowStock ? 'warning' : 'success') : 'muted'}`}>
                          {part.isActive ? (isLowStock ? 'Low stock' : 'Active') : 'Inactive'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {!parts.length && (
                  <tr>
                    <td colSpan="10">{isLoading ? 'Loading parts...' : 'No parts found.'}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="inventory-editor">
            <form onSubmit={savePart}>
              <div className="editor-heading">
                <h3>{selectedPart ? 'Edit Part' : 'Add Part'}</h3>
                {(isDirty || saveStatus === 'saving' || saveStatus === 'error') && (
                  <UnsavedChangesBadge
                    state={saveStatus}
                    reminder={isDirty ? 'Remember to save before leaving.' : ''}
                  />
                )}
              </div>
              <div className="form-grid">
                <label>Vendor
                  <select disabled={!canWrite} value={partForm.vendorId} onChange={(event) => updatePartForm('vendorId', event.target.value)}>
                    <option value="">No vendor</option>
                    {vendors.map((vendor) => (
                      <option key={vendor.id} value={vendor.id}>{vendor.name}</option>
                    ))}
                  </select>
                </label>
                <label>SKU<input disabled={!canWrite} value={partForm.sku} onChange={(event) => updatePartForm('sku', event.target.value)} /></label>
                <label>Name<input disabled={!canWrite} value={partForm.name} onChange={(event) => updatePartForm('name', event.target.value)} required /></label>
                <label>Description<input disabled={!canWrite} value={partForm.description} onChange={(event) => updatePartForm('description', event.target.value)} /></label>
                <label>Category<input disabled={!canWrite} value={partForm.category} onChange={(event) => updatePartForm('category', event.target.value)} /></label>
                <label>Supplier<input disabled={!canWrite} value={partForm.supplier} onChange={(event) => updatePartForm('supplier', event.target.value)} /></label>
                <label>Vendor SKU<input disabled={!canWrite} value={partForm.vendorSku} onChange={(event) => updatePartForm('vendorSku', event.target.value)} /></label>
                <label>Barcode code<input disabled={!canWrite} value={partForm.barcodeCode} onChange={(event) => updatePartForm('barcodeCode', event.target.value)} /></label>
                <label>Manufacturer<input disabled={!canWrite} value={partForm.manufacturer} onChange={(event) => updatePartForm('manufacturer', event.target.value)} /></label>
                <label>Part number<input disabled={!canWrite} value={partForm.partNumber} onChange={(event) => updatePartForm('partNumber', event.target.value)} /></label>
                {canWrite && <label>Unit cost<input type="number" min="0" step="0.01" value={partForm.unitCost} onChange={(event) => updatePartForm('unitCost', event.target.value)} /></label>}
                <label>Retail price<input disabled={!canWrite} type="number" min="0" step="0.01" value={partForm.retailPrice} onChange={(event) => updatePartForm('retailPrice', event.target.value)} /></label>
                <label>Quantity on hand<input disabled={!canWrite} type="number" step="1" value={partForm.quantityOnHand} onChange={(event) => updatePartForm('quantityOnHand', event.target.value)} /></label>
                <label>Reorder point<input disabled={!canWrite} type="number" min="0" step="1" value={partForm.reorderPoint} onChange={(event) => updatePartForm('reorderPoint', event.target.value)} /></label>
                <label>Desired stock<input disabled={!canWrite} type="number" min="0" step="1" value={partForm.desiredStockLevel} onChange={(event) => updatePartForm('desiredStockLevel', event.target.value)} /></label>
                <label>Location<input disabled={!canWrite} value={partForm.location} onChange={(event) => updatePartForm('location', event.target.value)} /></label>
              </div>
              {selectedPart && (
                <div className="inventory-meta-grid">
                  <span>Barcode label <strong><code>{getBarcodeLabel(selectedPart)}</code></strong></span>
                  <span>Vendor <strong>{vendorsById.get(selectedPart.vendorId)?.name || '-'}</strong></span>
                  <span>Vendor SKU <strong>{selectedPart.vendorSku || '-'}</strong></span>
                  <span>Location <strong>{selectedPart.location || '-'}</strong></span>
                  <span>On hand <strong>{selectedPart.quantityOnHand}</strong></span>
                  <span>Reorder point <strong>{selectedPart.reorderPoint}</strong></span>
                  <span>Desired stock <strong>{selectedPart.desiredStockLevel}</strong></span>
                  <span>Last cost <strong>{selectedPart.lastCost === null ? '-' : money(selectedPart.lastCost, moneyOptions)}</strong></span>
                  <span>Average cost <strong>{selectedPart.averageCost === null ? '-' : money(selectedPart.averageCost, moneyOptions)}</strong></span>
                </div>
              )}
              {selectedPart && !selectedPart.barcodeCode && canWrite && (
                <div className="mode-actions">
                  <button type="button" onClick={handleGenerateBarcodeCode} disabled={isSaving}>Generate Barcode Code</button>
                </div>
              )}
              <label className="table-checkbox">
                <input
                  disabled={!canWrite}
                  type="checkbox"
                  checked={partForm.isActive}
                  onChange={(event) => updatePartForm('isActive', event.target.checked)}
                />
                Active
              </label>
              {canWrite && (
                <div className="mode-actions">
                  <button type="submit" className="primary-action" disabled={isSaving}>{isSaving ? 'Saving...' : 'Save Part'}</button>
                  {selectedPart && <button type="button" onClick={handleDeactivate} disabled={isSaving}>Deactivate</button>}
                </div>
              )}
            </form>

            {selectedPart && canWrite && (
              <div className="inventory-stock-actions">
                <form onSubmit={handleReceive}>
                  <h3>Receive Stock</h3>
                  <div className="row-form">
                    <input type="number" min="1" step="1" placeholder="Qty" value={receiveForm.quantity} onChange={(event) => setReceiveForm((current) => ({ ...current, quantity: event.target.value }))} />
                    <input type="number" min="0" step="0.01" placeholder="Unit cost" value={receiveForm.cost} onChange={(event) => setReceiveForm((current) => ({ ...current, cost: event.target.value }))} />
                    <input placeholder="Note" value={receiveForm.note} onChange={(event) => setReceiveForm((current) => ({ ...current, note: event.target.value }))} />
                    <button type="submit" disabled={isSaving}>Receive</button>
                  </div>
                </form>
                <form onSubmit={handleAdjust}>
                  <h3>Adjust Stock</h3>
                  <div className="row-form">
                    <input type="number" step="1" placeholder="+/- Qty" value={adjustForm.quantityDelta} onChange={(event) => setAdjustForm((current) => ({ ...current, quantityDelta: event.target.value }))} />
                    <input placeholder="Reason" value={adjustForm.note} onChange={(event) => setAdjustForm((current) => ({ ...current, note: event.target.value }))} />
                    <button type="submit" disabled={isSaving}>Adjust</button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      </>
    );
  }

  function renderVendorsTab() {
    return (
      <div className="inventory-layout">
        <div className="inventory-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Contact</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {vendors.map((vendor) => (
                <tr
                  key={vendor.id}
                  className={`${selectedVendorId === vendor.id ? 'selected-row' : ''}${vendor.isActive ? '' : ' inactive-row'}`}
                  onClick={() => loadVendorIntoForm(vendor)}
                >
                  <td><strong>{vendor.name}</strong></td>
                  <td>{vendor.contactName || '-'}</td>
                  <td>{vendor.email || '-'}</td>
                  <td>{vendor.phone || '-'}</td>
                  <td><span className={`status-pill ${vendor.isActive ? 'success' : 'muted'}`}>{vendor.isActive ? 'Active' : 'Inactive'}</span></td>
                </tr>
              ))}
              {!vendors.length && (
                <tr><td colSpan="5">No vendors yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="inventory-editor">
          <form onSubmit={saveVendor}>
            <div className="editor-heading">
              <h3>{selectedVendor ? 'Edit Vendor' : 'Add Vendor'}</h3>
              {canWrite && <button type="button" onClick={resetVendorForm}>New Vendor</button>}
            </div>
            <div className="form-grid">
              <label>Name<input disabled={!canWrite} required value={vendorForm.name} onChange={(event) => setVendorForm((current) => ({ ...current, name: event.target.value }))} /></label>
              <label>Contact<input disabled={!canWrite} value={vendorForm.contactName} onChange={(event) => setVendorForm((current) => ({ ...current, contactName: event.target.value }))} /></label>
              <label>Email<input disabled={!canWrite} type="email" value={vendorForm.email} onChange={(event) => setVendorForm((current) => ({ ...current, email: event.target.value }))} /></label>
              <label>Phone<input disabled={!canWrite} value={vendorForm.phone} onChange={(event) => setVendorForm((current) => ({ ...current, phone: event.target.value }))} /></label>
              <label>Website<input disabled={!canWrite} value={vendorForm.website} onChange={(event) => setVendorForm((current) => ({ ...current, website: event.target.value }))} /></label>
              <label>Notes<input disabled={!canWrite} value={vendorForm.notes} onChange={(event) => setVendorForm((current) => ({ ...current, notes: event.target.value }))} /></label>
            </div>
            <label className="table-checkbox">
              <input
                disabled={!canWrite}
                type="checkbox"
                checked={vendorForm.isActive}
                onChange={(event) => setVendorForm((current) => ({ ...current, isActive: event.target.checked }))}
              />
              Active
            </label>
            {canWrite && (
              <div className="mode-actions">
                <button type="submit" className="primary-action" disabled={isSaving}>{isSaving ? 'Saving...' : 'Save Vendor'}</button>
              </div>
            )}
          </form>
        </div>
      </div>
    );
  }

  function renderPurchaseOrdersTab() {
    return (
      <div className="inventory-layout inventory-layout-wide">
        <div className="inventory-table-wrap">
          <div className="inventory-label-toolbar">
            <label>Filter
              <select value={poStatusFilter} onChange={(event) => setPoStatusFilter(event.target.value)}>
                {purchaseOrderFilterOptions.map((status) => (
                  <option key={status} value={status}>{status === 'all' ? 'All' : formatStatusLabel(status)}</option>
                ))}
              </select>
            </label>
          </div>
          <table>
            <thead>
              <tr>
                <th>PO</th>
                <th>Vendor</th>
                <th>Status</th>
                <th>Ordered</th>
                <th>Expected</th>
                <th>Received</th>
                <th>Lines</th>
                <th>Qty</th>
                <th>Remaining</th>
                <th>Est. Cost</th>
                <th>Receipts</th>
              </tr>
            </thead>
            <tbody>
              {filteredPurchaseOrders.map((order) => {
                const totals = purchaseOrderTotals(order);
                return (
                  <tr
                    key={order.id}
                    className={selectedPurchaseOrderId === order.id ? 'selected-row' : ''}
                    onClick={() => selectPurchaseOrder(order)}
                  >
                    <td><strong>{order.poNumber}</strong></td>
                    <td>{vendorsById.get(order.vendorId)?.name || '-'}</td>
                    <td><span className={`status-pill ${order.status === 'received' ? 'success' : order.status === 'cancelled' ? 'muted' : 'warning'}`}>{formatStatusLabel(order.status)}</span></td>
                    <td>{formatDate(order.orderedAt)}</td>
                    <td>{formatDate(order.expectedAt)}</td>
                    <td>{formatDate(order.latestReceivedAt)}</td>
                    <td>{totals.lineCount}</td>
                    <td>{totals.received} / {totals.ordered}</td>
                    <td>{totals.remaining}</td>
                    <td>{money(totals.estimatedCost, moneyOptions)}</td>
                    <td>{order.receiptCount || 0}</td>
                  </tr>
                );
              })}
              {!filteredPurchaseOrders.length && (
                <tr><td colSpan="11">No purchase orders found.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="inventory-editor">
          <form onSubmit={savePurchaseOrder}>
            <h3>New Purchase Order</h3>
            <div className="form-grid">
              <label>Vendor
                <select disabled={!canWrite} value={purchaseOrderForm.vendorId} onChange={(event) => setPurchaseOrderForm((current) => ({ ...current, vendorId: event.target.value }))}>
                  <option value="">No vendor</option>
                  {vendors.filter((vendor) => vendor.isActive).map((vendor) => (
                    <option key={vendor.id} value={vendor.id}>{vendor.name}</option>
                  ))}
                </select>
              </label>
              <label>Status
                <select disabled={!canWrite} value={purchaseOrderForm.status} onChange={(event) => setPurchaseOrderForm((current) => ({ ...current, status: event.target.value }))}>
                  {purchaseOrderStatuses.map((status) => (
                    <option key={status} value={status}>{formatStatusLabel(status)}</option>
                  ))}
                </select>
              </label>
              <label>Ordered<input disabled={!canWrite} type="date" value={purchaseOrderForm.orderedAt} onChange={(event) => setPurchaseOrderForm((current) => ({ ...current, orderedAt: event.target.value }))} /></label>
              <label>Expected<input disabled={!canWrite} type="date" value={purchaseOrderForm.expectedAt} onChange={(event) => setPurchaseOrderForm((current) => ({ ...current, expectedAt: event.target.value }))} /></label>
              <label>Notes<input disabled={!canWrite} value={purchaseOrderForm.notes} onChange={(event) => setPurchaseOrderForm((current) => ({ ...current, notes: event.target.value }))} /></label>
            </div>

            <div className="inventory-subsection">
              <div className="editor-heading">
                <h4>Items</h4>
                {canWrite && <button type="button" onClick={addPurchaseOrderItem}>Add Item</button>}
              </div>
              <p className="muted-text">Choose an existing part, or leave the selector on Create new inventory part. New PO items are added to inventory with quantity 0 until received.</p>
              {purchaseOrderForm.items.map((item, index) => (
                <div className="purchase-order-item-row" key={`${index}-${item.partId || 'manual'}`}>
                  <select disabled={!canWrite} value={item.partId} onChange={(event) => updatePurchaseOrderItem(index, 'partId', event.target.value)}>
                    <option value="">Create new inventory part</option>
                    {parts.filter((part) => part.isActive).map((part) => (
                      <option key={part.id} value={part.id}>{part.name}</option>
                    ))}
                  </select>
                  <input disabled={!canWrite} placeholder="Description" value={item.description} onChange={(event) => updatePurchaseOrderItem(index, 'description', event.target.value)} />
                  <input disabled={!canWrite} placeholder="Vendor SKU" value={item.vendorSku} onChange={(event) => updatePurchaseOrderItem(index, 'vendorSku', event.target.value)} />
                  <input disabled={!canWrite} type="number" min="1" step="1" placeholder="Qty" value={item.quantityOrdered} onChange={(event) => updatePurchaseOrderItem(index, 'quantityOrdered', event.target.value)} />
                  <input disabled={!canWrite} type="number" min="0" step="0.01" placeholder="Unit cost" value={item.unitCost} onChange={(event) => updatePurchaseOrderItem(index, 'unitCost', event.target.value)} />
                  {canWrite && <button type="button" onClick={() => removePurchaseOrderItem(index)}>Remove</button>}
                </div>
              ))}
            </div>
            {canWrite && (
              <div className="mode-actions">
                <button type="submit" className="primary-action" disabled={isSaving}>{isSaving ? 'Saving...' : 'Create PO'}</button>
              </div>
            )}
          </form>

          {selectedPurchaseOrder && (
            <form className="inventory-stock-actions" onSubmit={handlePurchaseReceive}>
              <div className="editor-heading">
                <h3>Receive {selectedPurchaseOrder.poNumber}</h3>
                <span className={`status-pill ${selectedPurchaseOrder.status === 'received' ? 'success' : selectedPurchaseOrder.status === 'cancelled' ? 'muted' : 'warning'}`}>{formatStatusLabel(selectedPurchaseOrder.status)}</span>
              </div>
              <div className="inventory-meta-grid">
                {(() => {
                  const totals = purchaseOrderTotals(selectedPurchaseOrder);
                  return (
                    <>
                      <span>Vendor <strong>{vendorsById.get(selectedPurchaseOrder.vendorId)?.name || '-'}</strong></span>
                      <span>Ordered <strong>{formatDate(selectedPurchaseOrder.orderedAt)}</strong></span>
                      <span>Expected <strong>{formatDate(selectedPurchaseOrder.expectedAt)}</strong></span>
                      <span>Received <strong>{formatDate(selectedPurchaseOrder.latestReceivedAt)}</strong></span>
                      <span>Line count <strong>{totals.lineCount}</strong></span>
                      <span>Ordered qty <strong>{totals.ordered}</strong></span>
                      <span>Received qty <strong>{totals.received}</strong></span>
                      <span>Remaining qty <strong>{totals.remaining}</strong></span>
                      <span>Estimated cost <strong>{money(totals.estimatedCost, moneyOptions)}</strong></span>
                    </>
                  );
                })()}
              </div>
              {canWrite && (
                <div className="mode-actions">
                  <button type="button" onClick={() => handlePurchaseOrderStatus('ordered')} disabled={isSaving || selectedPurchaseOrder.status === 'cancelled' || selectedPurchaseOrder.status === 'received'}>Mark Ordered</button>
                  <button type="button" onClick={() => handlePurchaseOrderStatus('cancelled')} disabled={isSaving || selectedPurchaseOrder.status === 'cancelled' || selectedPurchaseOrder.status === 'received'}>Cancel PO</button>
                </div>
              )}
              <div className="inventory-receive-list">
                {(selectedPurchaseOrder.items || []).map((item) => {
                  const remaining = remainingForItem(item);
                  return (
                    <div className="receive-item-row" key={item.id}>
                      <span>
                        <strong>{item.description}</strong>
                        <small>{item.vendorSku || 'No vendor SKU'} - ordered {item.quantityOrdered} - received {item.quantityReceived} - remaining {remaining}</small>
                      </span>
                      <input
                        disabled={!canWrite || remaining <= 0 || selectedPurchaseOrder.status === 'cancelled'}
                        type="number"
                        min="0"
                        max={remaining}
                        step="1"
                        placeholder="Receive"
                        value={purchaseReceiveQuantities[item.id] ?? ''}
                        onChange={(event) => setPurchaseReceiveQuantities((current) => ({ ...current, [item.id]: event.target.value }))}
                      />
                      <input
                        disabled={!canWrite || remaining <= 0 || selectedPurchaseOrder.status === 'cancelled'}
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Unit cost"
                        value={purchaseReceiveCosts[item.id] ?? ''}
                        onChange={(event) => setPurchaseReceiveCosts((current) => ({ ...current, [item.id]: event.target.value }))}
                      />
                    </div>
                  );
                })}
              </div>
              <input disabled={!canWrite} placeholder="Receipt note" value={purchaseReceiveNote} onChange={(event) => setPurchaseReceiveNote(event.target.value)} />
              {canWrite && (
                <div className="mode-actions">
                  <button type="submit" className="primary-action" disabled={isSaving || selectedPurchaseOrder.status === 'cancelled'}>{isSaving ? 'Receiving...' : 'Receive Selected'}</button>
                </div>
              )}
            </form>
          )}
        </div>
      </div>
    );
  }

  function renderHistoryTab() {
    return (
      <div className="inventory-history-grid">
        <section className="inventory-editor">
          <h3>{selectedPart ? `Purchase History: ${selectedPart.name}` : 'Purchase History'}</h3>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Part</th>
                <th>Vendor</th>
                <th>PO</th>
                <th>Receipt</th>
                <th>Qty</th>
                <th>Unit Cost</th>
                <th>Total</th>
                <th>Received By</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {(selectedPart ? partPurchaseHistory : purchaseHistory).map((row) => (
                <tr key={row.id}>
                  <td>{formatDateTime(row.receivedAt)}</td>
                  <td>{row.partName || row.description || '-'}</td>
                  <td>{row.vendorName || '-'}</td>
                  <td>{row.poNumber || 'Manual'}</td>
                  <td>{row.receiptNumber || '-'}</td>
                  <td>{row.quantityReceived}</td>
                  <td>{money(row.unitCost, moneyOptions)}</td>
                  <td>{money(row.totalCost ?? row.quantityReceived * row.unitCost, moneyOptions)}</td>
                  <td>{row.receivedBy ? `${row.receivedBy.slice(0, 8)}...` : '-'}</td>
                  <td>{row.receiptNotes || '-'}</td>
                </tr>
              ))}
              {!(selectedPart ? partPurchaseHistory : purchaseHistory).length && (
                <tr><td colSpan="10">No purchase receipts yet.</td></tr>
              )}
            </tbody>
          </table>
        </section>

        <section className="inventory-editor">
          {selectedPart ? (
            <>
              <h3>Stock Movements: {selectedPart.name}</h3>
              <table>
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Qty</th>
                    <th>Cost</th>
                    <th>Note</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {partMovements.map((movement) => (
                    <tr key={movement.id}>
                      <td>{formatStatusLabel(movement.movementType)}</td>
                      <td>{movement.quantity}</td>
                      <td>{movement.unitCost === null ? '-' : money(movement.unitCost, moneyOptions)}</td>
                      <td>{movement.note || '-'}</td>
                      <td>{formatDateTime(movement.createdAt)}</td>
                    </tr>
                  ))}
                  {!partMovements.length && (
                    <tr><td colSpan="5">No stock movements yet.</td></tr>
                  )}
                </tbody>
              </table>
            </>
          ) : (
            <p className="muted-text">Select a part from the Parts tab to view stock movement history for that specific item.</p>
          )}
        </section>
      </div>
    );
  }

  function renderLabelsTab() {
    return (
      <div className="inventory-label-panel">
        <section className="inventory-editor">
          <div className="editor-heading">
            <h3>Barcode Labels</h3>
            <div className="mode-actions">
              <button type="button" onClick={() => setActiveTab('parts')}>Select Parts</button>
              <button type="button" onClick={printBarcodeLabels} className="primary-action" disabled={!selectedLabelParts.length}>Print Labels</button>
            </div>
          </div>
          <p className="muted-text">Labels use stable barcode identity only. Prices, quantities, and other mutable stock data are not encoded.</p>
          <BarcodeLabelSheet parts={selectedLabelParts} />
        </section>
      </div>
    );
  }

  return (
    <section className="panel inventory-page">
      <div className="section-header">
        <div>
          <h2>Inventory</h2>
          <p className="muted-text">Shop-scoped parts, vendors, purchase orders, receiving, barcode identity, and job-ready retail pricing.</p>
        </div>
        {canWrite && activeTab === 'parts' && <button type="button" onClick={() => resetForm()}>Add Part</button>}
      </div>

      {renderTabs()}
      {activeTab === 'parts' && renderPartsTab()}
      {activeTab === 'vendors' && renderVendorsTab()}
      {activeTab === 'purchase-orders' && renderPurchaseOrdersTab()}
      {activeTab === 'history' && renderHistoryTab()}
      {activeTab === 'labels' && renderLabelsTab()}
    </section>
  );
}
