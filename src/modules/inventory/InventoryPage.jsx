import { useEffect, useMemo, useState } from 'react';
import { getCurrentShopId, getShopMoneyOptions, getShopSettings, normalizeShippingLabelSettings } from '../shops/shopConfig';
import {
  adjustPart,
  createPartImageObjectUrl,
  createPart,
  createPurchaseOrder,
  createVendor,
  deactivatePart,
  fixMissingPartBarcodeCode,
  getPart,
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
import InventoryPurchaseOrderEditor from './InventoryPurchaseOrderEditor.jsx';
import InventoryPurchaseOrdersList from './InventoryPurchaseOrdersList.jsx';
import InventoryVendorsTab from './InventoryVendorsTab.jsx';
import { preparePurchaseOrderReceiptItems } from './purchaseOrderCalculations.js';
import { withAuthoritativeStockFields } from './inventoryStockForm.js';

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

  async function refreshPartsAfterStockMutation(updatedPart = null) {
    const loadedParts = await loadPartsOnly({ search, activeOnly: !showInactive, lowStockOnly });
    if (!selectedPartId) {
      return loadedParts;
    }

    let authoritativePart = updatedPart?.id === selectedPartId
      ? updatedPart
      : loadedParts.find((part) => part.id === selectedPartId);
    if (!authoritativePart) {
      authoritativePart = await getPart(selectedPartId);
    }
    if (authoritativePart) {
      setPartForm((current) => withAuthoritativeStockFields(current, authoritativePart));
    }
    return loadedParts;
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
      const updatedPart = await receivePart(selectedPart.id, receiveForm.quantity, receiveForm.cost, receiveForm.note);
      onNotice?.({ type: 'success', message: 'Stock received.' });
      setReceiveForm({ quantity: '1', cost: receiveForm.cost, note: '' });
      await Promise.all([
        refreshPartsAfterStockMutation(updatedPart),
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
      const updatedPart = await adjustPart(selectedPart.id, adjustForm.quantityDelta, adjustForm.note);
      onNotice?.({ type: 'success', message: 'Stock adjusted.' });
      setAdjustForm({ quantityDelta: '0', note: '' });
      await refreshPartsAfterStockMutation(updatedPart);
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
    const { receiptItems, invalidReceipt } = preparePurchaseOrderReceiptItems(
      selectedPurchaseOrder,
      purchaseReceiveQuantities,
      purchaseReceiveCosts
    );

    if (!receiptItems.length) {
      onNotice?.({ type: 'error', message: 'Enter a received quantity for at least one item.' });
      return;
    }

    if (invalidReceipt) {
      onNotice?.({ type: 'error', message: 'Receipt quantities must be positive and cannot exceed the remaining ordered quantity.' });
      return;
    }

    setIsSaving(true);
    try {
      const result = await receivePurchaseOrderItems(selectedPurchaseOrder.id, receiptItems, purchaseReceiveNote);
      onNotice?.({ type: 'success', message: `Received ${result?.receivedUnits || 'stock'} inventory unit(s).` });
      await Promise.all([
        refreshPartsAfterStockMutation(),
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
        <InventoryPurchaseOrderEditor
          purchaseOrderForm={purchaseOrderForm}
          selectedPurchaseOrder={selectedPurchaseOrder}
          vendors={vendors}
          vendorsById={vendorsById}
          parts={parts}
          statusOptions={purchaseOrderStatuses}
          canWrite={canWrite}
          isSaving={isSaving}
          purchaseReceiveQuantities={purchaseReceiveQuantities}
          purchaseReceiveCosts={purchaseReceiveCosts}
          purchaseReceiveNote={purchaseReceiveNote}
          moneyOptions={moneyOptions}
          onPurchaseOrderFormChange={(field, value) => setPurchaseOrderForm((current) => ({ ...current, [field]: value }))}
          onAddItem={addPurchaseOrderItem}
          onUpdateItem={updatePurchaseOrderItem}
          onRemoveItem={removePurchaseOrderItem}
          onSavePurchaseOrder={savePurchaseOrder}
          onCloseDetail={closePurchaseOrderDetail}
          onStatusChange={handlePurchaseOrderStatus}
          onReceiveQuantityChange={(itemId, value) => setPurchaseReceiveQuantities((current) => ({ ...current, [itemId]: value }))}
          onReceiveCostChange={(itemId, value) => setPurchaseReceiveCosts((current) => ({ ...current, [itemId]: value }))}
          onReceiveNoteChange={setPurchaseReceiveNote}
          onReceive={handlePurchaseReceive}
        />
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
