import { useEffect, useMemo, useState } from 'react';
import { money } from '../../shared/utils/money';
import { getCurrentShopId, getShopMoneyOptions, getShopSettings, normalizeShippingLabelSettings } from '../shops/shopConfig';
import {
  adjustPart,
  createPartImageObjectUrl,
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
  updateVendor,
  uploadPartImage
} from './inventoryService';
import useUnsavedChanges from '../../hooks/useUnsavedChanges';
import InventoryHistoryTab from './InventoryHistoryTab.jsx';
import InventoryLabelsTab from './InventoryLabelsTab.jsx';
import InventoryPartEditor from './InventoryPartEditor.jsx';
import InventoryPartsList from './InventoryPartsList.jsx';
import InventoryPurchaseOrdersList from './InventoryPurchaseOrdersList.jsx';
import InventoryVendorsTab from './InventoryVendorsTab.jsx';
import {
  formatInventoryDate as formatDate,
  formatInventoryStatus as formatStatusLabel
} from './inventoryFormatting.js';
import {
  PURCHASE_UNIT_OPTIONS,
  purchaseConversionSummary,
  purchaseUnitLabel
} from './purchaseUnits';
import { purchaseOrderTotals, remainingForPurchaseOrderItem } from './purchaseOrderCalculations.js';

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
  purchaseUnit: 'each',
  unitsPerPurchaseUnit: '1',
  unitCost: '',
  retailPrice: '',
  quantityOnHand: '0',
  reorderPoint: '0',
  desiredStockLevel: '0',
  location: '',
  specialOrder: false,
  isActive: true
};

const emptyVendorForm = {
  name: '',
  contactName: '',
  email: '',
  phone: '',
  website: '',
  onlineOnly: false,
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  postalCode: '',
  country: 'US',
  notes: '',
  isActive: true
};

const emptyPurchaseOrderItem = {
  partId: '',
  description: '',
  vendorSku: '',
  quantityOrdered: '1',
  purchaseUnit: 'each',
  unitsPerPurchaseUnit: '1',
  unitCost: ''
};

const emptyPurchaseOrderForm = {
  vendorId: '',
  status: 'draft',
  orderedAt: '',
  expectedAt: '',
  shippingCost: '',
  addShippingToCost: false,
  notes: '',
  items: [{ ...emptyPurchaseOrderItem }]
};

const purchaseOrderStatuses = ['draft', 'ordered', 'partially_received', 'received', 'cancelled'];
const purchaseOrderFilterOptions = ['all', ...purchaseOrderStatuses];

function mergePresetOptions(...optionSources) {
  const seen = new Set();
  const options = [];
  for (const source of optionSources) {
    const values = Array.isArray(source) ? source : [source];
    for (const value of values) {
      const label = String(value || '').trim();
      const key = label.toLowerCase();
      if (!label || seen.has(key)) {
        continue;
      }
      seen.add(key);
      options.push(label);
    }
  }
  return options.sort((left, right) => left.localeCompare(right));
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
  const [partImageFile, setPartImageFile] = useState(null);
  const [partImagePreviewUrl, setPartImagePreviewUrl] = useState('');
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
  const shopSettings = getShopSettings();
  const shippingLabelSettings = normalizeShippingLabelSettings(shopSettings.shippingLabelSettings);

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
  const categoryOptions = useMemo(
    () => mergePresetOptions(
      shopSettings.inventoryCategoryPresets,
      parts.map((part) => part.category),
      partForm.category
    ),
    [shopSettings.inventoryCategoryPresets, parts, partForm.category]
  );
  const locationOptions = useMemo(
    () => mergePresetOptions(
      shopSettings.inventoryLocationPresets,
      parts.map((part) => part.location),
      partForm.location
    ),
    [shopSettings.inventoryLocationPresets, parts, partForm.location]
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

  useEffect(() => {
    let objectUrl = '';
    let isCancelled = false;

    if (!selectedPart?.imagePath) {
      setPartImagePreviewUrl('');
      return undefined;
    }

    createPartImageObjectUrl(selectedPart.imagePath)
      .then((url) => {
        if (isCancelled) {
          if (url) {
            URL.revokeObjectURL(url);
          }
          return;
        }
        objectUrl = url;
        setPartImagePreviewUrl(url);
      })
      .catch((error) => {
        console.error('Part image preview failed.', error);
        setPartImagePreviewUrl('');
      });

    return () => {
      isCancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [selectedPart?.imagePath]);

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
      purchaseUnit: part.purchaseUnit || 'each',
      unitsPerPurchaseUnit: String(part.unitsPerPurchaseUnit || 1),
      unitCost: String(part.unitCost ?? ''),
      retailPrice: String(part.retailPrice ?? ''),
      quantityOnHand: String(part.quantityOnHand ?? 0),
      reorderPoint: String(part.reorderPoint ?? 0),
      desiredStockLevel: String(part.desiredStockLevel ?? 0),
      location: part.location || '',
      specialOrder: part.specialOrder === true,
      isActive: part.isActive !== false
    });
    setPartImageFile(null);
    setReceiveForm({
      quantity: '1',
      cost: String(Number(part.unitCost || 0) * Number(part.unitsPerPurchaseUnit || 1)),
      note: ''
    });
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
    setPartImageFile(null);
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
      let savedPart = selectedPart
        ? await updatePart(selectedPart.id, partForm)
        : await createPart(shopId, partForm);
      if (partImageFile) {
        savedPart = await uploadPartImage(savedPart, partImageFile);
      }
      onNotice?.({ type: 'success', message: selectedPart ? 'Part updated.' : 'Part created.' });
      setPartImageFile(null);
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

  function handlePartImageChange(event) {
    const file = event.target.files?.[0] || null;
    setPartImageFile(file);
    if (file) {
      markDirty();
      setSaveStatus('unsaved');
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
      onNotice?.({ type: 'success', message: 'Barcode generated.' });
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
      onlineOnly: vendor.onlineOnly === true,
      addressLine1: vendor.addressLine1 || '',
      addressLine2: vendor.addressLine2 || '',
      city: vendor.city || '',
      state: vendor.state || '',
      postalCode: vendor.postalCode || '',
      country: vendor.country || 'US',
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
          const unitsPerPurchaseUnit = matchedPart?.unitsPerPurchaseUnit || 1;
          const inventoryUnitCost = matchedPart?.lastCost ?? matchedPart?.unitCost;
          return {
            ...item,
            partId: value,
            description: matchedPart?.name || item.description,
            vendorSku: matchedPart?.vendorSku || item.vendorSku,
            purchaseUnit: matchedPart?.purchaseUnit || 'each',
            unitsPerPurchaseUnit: String(unitsPerPurchaseUnit),
            unitCost: inventoryUnitCost === null || inventoryUnitCost === undefined
              ? item.unitCost
              : String(Number(inventoryUnitCost) * unitsPerPurchaseUnit)
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
    const shippingCost = Number(purchaseOrderForm.shippingCost || 0);
    if (!Number.isFinite(shippingCost) || shippingCost < 0) {
      onNotice?.({ type: 'error', message: 'Shipping cost cannot be negative.' });
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

  function closePurchaseOrderDetail() {
    setSelectedPurchaseOrderId('');
    setPurchaseReceiveQuantities({});
    setPurchaseReceiveCosts({});
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
      onNotice?.({ type: 'success', message: `Received ${result?.receivedUnits || 'stock'} inventory unit(s).` });
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
      <InventoryPartsList
        parts={parts}
        selectedPartId={selectedPartId}
        selectedLabelPartIds={selectedLabelPartIds}
        search={search}
        showInactive={showInactive}
        lowStockOnly={lowStockOnly}
        isLoading={isLoading}
        moneyOptions={moneyOptions}
        onSearchChange={setSearch}
        onShowInactiveChange={setShowInactive}
        onLowStockOnlyChange={setLowStockOnly}
        onSearch={handleSearch}
        onSelectPart={selectPart}
        onToggleLabelPart={toggleLabelPart}
        onSelectVisibleLabelParts={selectVisibleLabelParts}
        onClearLabelParts={() => setSelectedLabelPartIds([])}
        onPreviewLabels={() => setActiveTab('labels')}
      >
          <InventoryPartEditor
            selectedPart={selectedPart}
            partForm={partForm}
            vendors={vendors}
            vendorsById={vendorsById}
            categoryOptions={categoryOptions}
            locationOptions={locationOptions}
            canWrite={canWrite}
            isSaving={isSaving}
            isDirty={isDirty}
            saveStatus={saveStatus}
            partImagePreviewUrl={partImagePreviewUrl}
            partImageFile={partImageFile}
            receiveForm={receiveForm}
            adjustForm={adjustForm}
            moneyOptions={moneyOptions}
            onPartFormChange={updatePartForm}
            onPartImageChange={handlePartImageChange}
            onSavePart={savePart}
            onGenerateBarcodeCode={handleGenerateBarcodeCode}
            onResetPart={() => resetForm()}
            onDeactivatePart={handleDeactivate}
            onReceiveFormChange={(field, value) => setReceiveForm((current) => ({ ...current, [field]: value }))}
            onReceive={handleReceive}
            onAdjustFormChange={(field, value) => setAdjustForm((current) => ({ ...current, [field]: value }))}
            onAdjust={handleAdjust}
          />
      </InventoryPartsList>
    );
  }

  function renderPurchaseOrdersTab() {
    return (
      <InventoryPurchaseOrdersList
        purchaseOrders={filteredPurchaseOrders}
        selectedPurchaseOrderId={selectedPurchaseOrderId}
        statusFilter={poStatusFilter}
        statusOptions={purchaseOrderFilterOptions}
        vendorsById={vendorsById}
        moneyOptions={moneyOptions}
        onStatusFilterChange={setPoStatusFilter}
        onSelectPurchaseOrder={selectPurchaseOrder}
      >
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
              <label>Shipping Cost<input disabled={!canWrite} type="number" min="0" step="0.01" value={purchaseOrderForm.shippingCost} onChange={(event) => setPurchaseOrderForm((current) => ({ ...current, shippingCost: event.target.value }))} /></label>
              <label>Notes<input disabled={!canWrite} value={purchaseOrderForm.notes} onChange={(event) => setPurchaseOrderForm((current) => ({ ...current, notes: event.target.value }))} /></label>
            </div>
            <label className="table-checkbox">
              <input
                disabled={!canWrite}
                type="checkbox"
                checked={purchaseOrderForm.addShippingToCost}
                onChange={(event) => setPurchaseOrderForm((current) => ({ ...current, addShippingToCost: event.target.checked }))}
              />
              Add shipping to cost
            </label>
            <p className="muted-text">Use this for inbound vendor shipping. Customer/outbound shipping is planned separately.</p>

            <div className="inventory-subsection">
              <div className="editor-heading">
                <h4>Items</h4>
                {canWrite && <button type="button" onClick={addPurchaseOrderItem}>Add Item</button>}
              </div>
              <p className="muted-text">Choose an existing part, or leave the selector on Create new inventory part. New PO items are added to inventory with quantity 0 until received.</p>
              {purchaseOrderForm.items.map((item, index) => (
                <div className="purchase-order-item-block" key={`${index}-${item.partId || 'manual'}`}>
                  <div className="purchase-order-item-row">
                    <select disabled={!canWrite} value={item.partId} onChange={(event) => updatePurchaseOrderItem(index, 'partId', event.target.value)}>
                      <option value="">Create new inventory part</option>
                      {parts.filter((part) => part.isActive).map((part) => (
                        <option key={part.id} value={part.id}>{part.name}</option>
                      ))}
                    </select>
                    <input disabled={!canWrite} placeholder="Description" value={item.description} onChange={(event) => updatePurchaseOrderItem(index, 'description', event.target.value)} />
                    <input disabled={!canWrite} placeholder="Vendor UPC" value={item.vendorSku} onChange={(event) => updatePurchaseOrderItem(index, 'vendorSku', event.target.value)} />
                    <input aria-label="Purchase quantity" disabled={!canWrite} type="number" min="1" step="1" placeholder="Purchase qty" value={item.quantityOrdered} onChange={(event) => updatePurchaseOrderItem(index, 'quantityOrdered', event.target.value)} />
                    <select aria-label="Purchase unit" disabled={!canWrite || Boolean(item.partId)} value={item.purchaseUnit} onChange={(event) => updatePurchaseOrderItem(index, 'purchaseUnit', event.target.value)}>
                      {PURCHASE_UNIT_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                    <input aria-label="Units per purchase unit" disabled={!canWrite || Boolean(item.partId)} type="number" min="1" max="999999" step="1" placeholder="Units each" value={item.unitsPerPurchaseUnit} onChange={(event) => updatePurchaseOrderItem(index, 'unitsPerPurchaseUnit', event.target.value)} />
                    <input aria-label="Cost per purchase unit" disabled={!canWrite} type="number" min="0" step="0.01" placeholder={`Cost per ${purchaseUnitLabel(item.purchaseUnit)}`} value={item.unitCost} onChange={(event) => updatePurchaseOrderItem(index, 'unitCost', event.target.value)} />
                    {canWrite && <button type="button" onClick={() => removePurchaseOrderItem(index)}>Remove</button>}
                  </div>
                  <small className="purchase-conversion-summary">{purchaseConversionSummary(item.quantityOrdered || 0, item.purchaseUnit, item.unitsPerPurchaseUnit)}</small>
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
                <div className="mode-actions no-print">
                  <span className={`status-pill ${selectedPurchaseOrder.status === 'received' ? 'success' : selectedPurchaseOrder.status === 'cancelled' ? 'muted' : 'warning'}`}>{formatStatusLabel(selectedPurchaseOrder.status)}</span>
                  <button type="button" onClick={closePurchaseOrderDetail}>Close Detail</button>
                </div>
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
                      <span>Purchase units ordered <strong>{totals.ordered}</strong></span>
                      <span>Purchase units received <strong>{totals.received}</strong></span>
                      <span>Purchase units remaining <strong>{totals.remaining}</strong></span>
                      <span>Inventory units ordered <strong>{totals.inventoryOrdered}</strong></span>
                      <span>Inventory units received <strong>{totals.inventoryReceived}</strong></span>
                      <span>Inventory units remaining <strong>{totals.inventoryRemaining}</strong></span>
                      <span>Item subtotal <strong>{money(totals.itemSubtotal, moneyOptions)}</strong></span>
                      <span>Shipping cost <strong>{money(totals.shippingCost, moneyOptions)}</strong></span>
                      <span>Estimated total <strong>{money(totals.estimatedTotal, moneyOptions)}</strong></span>
                      <span>Add shipping to cost <strong>{selectedPurchaseOrder.addShippingToCost ? 'Yes' : 'No'}</strong></span>
                      <span>Received subtotal <strong>{money(totals.receivedSubtotal, moneyOptions)}</strong></span>
                      <span>Allocated shipping <strong>{money(totals.allocatedShipping, moneyOptions)}</strong></span>
                      <span>Landed received total <strong>{money(totals.landedReceivedTotal, moneyOptions)}</strong></span>
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
                    const remaining = remainingForPurchaseOrderItem(item);
                  return (
                    <div className="receive-item-row" key={item.id}>
                      <span>
                        <strong>{item.description}</strong>
                        <small>{item.vendorSku || 'No vendor UPC'} - ordered {item.quantityOrdered} - received {item.quantityReceived} - remaining {remaining} {purchaseUnitLabel(item.purchaseUnit, remaining)}</small>
                        <small>{purchaseConversionSummary(item.quantityOrdered, item.purchaseUnit, item.unitsPerPurchaseUnit)}</small>
                        {Number(purchaseReceiveQuantities[item.id] || 0) > 0 && (
                          <small>Receiving: {purchaseConversionSummary(purchaseReceiveQuantities[item.id], item.purchaseUnit, item.unitsPerPurchaseUnit)}</small>
                        )}
                      </span>
                      <input
                        disabled={!canWrite || remaining <= 0 || selectedPurchaseOrder.status === 'cancelled'}
                        type="number"
                        min="0"
                        max={remaining}
                        step="1"
                        aria-label={`Receive purchase quantity in ${purchaseUnitLabel(item.purchaseUnit, 2)}`}
                        placeholder={`Receive ${purchaseUnitLabel(item.purchaseUnit, 2)}`}
                        value={purchaseReceiveQuantities[item.id] ?? ''}
                        onChange={(event) => setPurchaseReceiveQuantities((current) => ({ ...current, [item.id]: event.target.value }))}
                      />
                      <input
                        disabled={!canWrite || remaining <= 0 || selectedPurchaseOrder.status === 'cancelled'}
                        type="number"
                        min="0"
                        step="0.01"
                        aria-label={`Cost per ${purchaseUnitLabel(item.purchaseUnit)}`}
                        placeholder={`Cost per ${purchaseUnitLabel(item.purchaseUnit)}`}
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
      </InventoryPurchaseOrdersList>
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
      {activeTab === 'vendors' && (
        <InventoryVendorsTab
          vendors={vendors}
          selectedVendorId={selectedVendorId}
          selectedVendor={selectedVendor}
          vendorForm={vendorForm}
          setVendorForm={setVendorForm}
          canWrite={canWrite}
          isSaving={isSaving}
          onSelectVendor={loadVendorIntoForm}
          onResetVendor={resetVendorForm}
          onSaveVendor={saveVendor}
        />
      )}
      {activeTab === 'purchase-orders' && renderPurchaseOrdersTab()}
      {activeTab === 'history' && (
        <InventoryHistoryTab
          selectedPart={selectedPart}
          partPurchaseHistory={partPurchaseHistory}
          purchaseHistory={purchaseHistory}
          partMovements={partMovements}
          moneyOptions={moneyOptions}
        />
      )}
      {activeTab === 'labels' && (
        <InventoryLabelsTab
          selectedLabelParts={selectedLabelParts}
          labelPreset={shippingLabelSettings.preset}
          onSelectParts={() => setActiveTab('parts')}
          onPrintLabels={printBarcodeLabels}
        />
      )}
    </section>
  );
}
