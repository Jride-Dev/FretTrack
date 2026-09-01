import { useMemo, useState } from 'react';
import {
  createPurchaseOrder,
  createVendor,
  listPurchaseOrders,
  receivePurchaseOrderItems,
  updatePurchaseOrderStatus,
  updateVendor
} from './inventoryService';
import {
  EMPTY_PURCHASE_ORDER_FORM,
  EMPTY_PURCHASE_ORDER_ITEM,
  EMPTY_VENDOR_FORM
} from './inventoryPageDefaults.js';
import { preparePurchaseOrderReceiptItems } from './purchaseOrderCalculations.js';

export default function useInventoryPurchasingController({
  canWrite,
  filters,
  loadPartsOnly,
  onNotice,
  parts,
  purchaseOrders,
  refreshPartsAfterStockMutation,
  refreshPurchasingData,
  selectedPurchaseOrderId,
  setIsSaving,
  setPurchaseOrders,
  setSelectedPurchaseOrderId,
  shopId,
  vendors
}) {
  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [vendorForm, setVendorForm] = useState(EMPTY_VENDOR_FORM);
  const [purchaseOrderForm, setPurchaseOrderForm] = useState(EMPTY_PURCHASE_ORDER_FORM);
  const [purchaseReceiveQuantities, setPurchaseReceiveQuantities] = useState({});
  const [purchaseReceiveCosts, setPurchaseReceiveCosts] = useState({});
  const [purchaseReceiveNote, setPurchaseReceiveNote] = useState('');

  const selectedVendor = useMemo(
    () => vendors.find((vendor) => vendor.id === selectedVendorId) || null,
    [selectedVendorId, vendors]
  );
  const selectedPurchaseOrder = useMemo(
    () => purchaseOrders.find((order) => order.id === selectedPurchaseOrderId) || null,
    [purchaseOrders, selectedPurchaseOrderId]
  );
  const vendorsById = useMemo(
    () => new Map(vendors.map((vendor) => [vendor.id, vendor])),
    [vendors]
  );

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
    setVendorForm(EMPTY_VENDOR_FORM);
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
          const purchaseUnitCost = matchedPart?.purchaseUnitCost;
          return {
            ...item,
            partId: value,
            description: matchedPart?.name || item.description,
            vendorSku: matchedPart?.vendorSku || item.vendorSku,
            purchaseUnit: matchedPart?.purchaseUnit || 'each',
            unitsPerPurchaseUnit: String(unitsPerPurchaseUnit),
            unitCost: purchaseUnitCost !== null && purchaseUnitCost !== undefined
              ? String(purchaseUnitCost)
              : inventoryUnitCost === null || inventoryUnitCost === undefined
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
      setPurchaseOrderForm(EMPTY_PURCHASE_ORDER_FORM);
      const [{ loadedOrders }] = await Promise.all([
        refreshPurchasingData(),
        loadPartsOnly(filters)
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
      items: [...current.items, { ...EMPTY_PURCHASE_ORDER_ITEM }]
    }));
  }

  function removePurchaseOrderItem(index) {
    setPurchaseOrderForm((current) => {
      const remainingItems = current.items.filter((_, itemIndex) => itemIndex !== index);
      return {
        ...current,
        items: remainingItems.length ? remainingItems : [{ ...EMPTY_PURCHASE_ORDER_ITEM }]
      };
    });
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

  return {
    addPurchaseOrderItem,
    closePurchaseOrderDetail,
    handlePurchaseOrderStatus,
    handlePurchaseReceive,
    loadVendorIntoForm,
    purchaseOrderForm,
    purchaseReceiveCosts,
    purchaseReceiveNote,
    purchaseReceiveQuantities,
    removePurchaseOrderItem,
    resetVendorForm,
    savePurchaseOrder,
    saveVendor,
    selectPurchaseOrder,
    selectedPurchaseOrder,
    selectedVendor,
    selectedVendorId,
    setPurchaseOrderForm,
    setPurchaseReceiveCosts,
    setPurchaseReceiveNote,
    setPurchaseReceiveQuantities,
    setVendorForm,
    updatePurchaseOrderItem,
    vendorForm,
    vendorsById
  };
}
