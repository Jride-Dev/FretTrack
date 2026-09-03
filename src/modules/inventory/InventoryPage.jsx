import { useEffect, useMemo, useState } from 'react';
import { getCurrentShopId, getShopMoneyOptions, getShopSettings, normalizeShippingLabelSettings } from '../shops/shopConfig';
import useUnsavedChanges from '../../hooks/useUnsavedChanges';
import InventoryHistoryTab from './InventoryHistoryTab.jsx';
import InventoryLabelsTab from './InventoryLabelsTab.jsx';
import InventoryPartEditor from './InventoryPartEditor.jsx';
import InventoryPartsList from './InventoryPartsList.jsx';
import InventoryPurchaseOrderEditor from './InventoryPurchaseOrderEditor.jsx';
import InventoryPurchaseOrdersList from './InventoryPurchaseOrdersList.jsx';
import InventoryVendorsTab from './InventoryVendorsTab.jsx';
import WorkspacePageHeader from '../../shared/components/WorkspacePageHeader.jsx';
import {
  PURCHASE_ORDER_FILTER_OPTIONS,
  PURCHASE_ORDER_STATUSES,
  mergeInventoryPresetOptions
} from './inventoryPageDefaults.js';
import useInventoryPageData from './useInventoryPageData.js';
import useInventoryPartController from './useInventoryPartController.js';
import useInventoryPurchasingController from './useInventoryPurchasingController.js';

export default function InventoryPage({ canWrite = true, shopId = getCurrentShopId(), onNotice, onDirtyChange }) {
  const [activeTab, setActiveTab] = useState('parts');
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [poStatusFilter, setPoStatusFilter] = useState('all');
  const [selectedPartId, setSelectedPartId] = useState('');
  const [selectedPurchaseOrderId, setSelectedPurchaseOrderId] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState('saved');
  const { isDirty, markDirty, markClean, confirmIfDirty } = useUnsavedChanges();
  const moneyOptions = getShopMoneyOptions();
  const shopSettings = getShopSettings();
  const shippingLabelSettings = normalizeShippingLabelSettings(shopSettings.shippingLabelSettings);
  const filters = useMemo(() => ({
    search,
    activeOnly: !showInactive,
    lowStockOnly
  }), [lowStockOnly, search, showInactive]);

  const inventoryData = useInventoryPageData({
    filters,
    onNotice,
    selectedPartId,
    shopId
  });
  const {
    isLoading,
    loadPartsOnly,
    partMovements,
    partPurchaseHistory,
    parts,
    purchaseHistory,
    purchaseOrders,
    refreshPartHistory,
    refreshPurchasingData,
    setPurchaseOrders,
    vendors
  } = inventoryData;

  const partController = useInventoryPartController({
    canWrite,
    confirmIfDirty,
    filters,
    loadPartsOnly,
    markClean,
    markDirty,
    onNotice,
    parts,
    refreshPartHistory,
    refreshPurchasingData,
    selectedPartId,
    setIsSaving,
    setSaveStatus,
    setSelectedPartId,
    shopId
  });
  const {
    adjustForm,
    handleAdjust,
    handleDeactivate,
    handleGenerateBarcodeCode,
    handlePartImageChange,
    handleReceive,
    partForm,
    partImageFile,
    partImagePreviewUrl,
    printBarcodeLabels,
    receiveForm,
    refreshPartsAfterStockMutation,
    resetForm,
    savePart,
    selectPart,
    selectVisibleLabelParts,
    selectedLabelPartIds,
    selectedLabelParts,
    selectedPart,
    setAdjustForm,
    setReceiveForm,
    setSelectedLabelPartIds,
    toggleLabelPart,
    updatePartForm
  } = partController;

  const purchasingController = useInventoryPurchasingController({
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
  });
  const {
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
  } = purchasingController;

  const selectedPurchaseOrders = useMemo(
    () => poStatusFilter === 'all'
      ? purchaseOrders
      : purchaseOrders.filter((order) => order.status === poStatusFilter),
    [poStatusFilter, purchaseOrders]
  );
  const categoryOptions = useMemo(
    () => mergeInventoryPresetOptions(
      shopSettings.inventoryCategoryPresets,
      parts.map((part) => part.category),
      partForm.category
    ),
    [partForm.category, parts, shopSettings.inventoryCategoryPresets]
  );
  const locationOptions = useMemo(
    () => mergeInventoryPresetOptions(
      shopSettings.inventoryLocationPresets,
      parts.map((part) => part.location),
      partForm.location
    ),
    [partForm.location, parts, shopSettings.inventoryLocationPresets]
  );

  useEffect(() => {
    onDirtyChange?.(isDirty);
    return () => onDirtyChange?.(false);
  }, [isDirty, onDirtyChange]);

  async function handleSearch(event) {
    event.preventDefault();
    await loadPartsOnly(filters);
  }

  return (
    <section className="panel inventory-page">
      <WorkspacePageHeader
        eyebrow="Parts & purchasing"
        title="Inventory"
        description="Shop-scoped parts, vendors, purchase orders, receiving, barcode identity, and job-ready retail pricing."
        actions={canWrite && activeTab === 'parts' ? <button type="button" className="primary-action" onClick={() => resetForm()}>Add Part</button> : null}
      />

      <InventoryTabs activeTab={activeTab} onSelectTab={setActiveTab} />
      {activeTab === 'parts' && (
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
      )}
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
      {activeTab === 'purchase-orders' && (
        <InventoryPurchaseOrdersList
          purchaseOrders={selectedPurchaseOrders}
          selectedPurchaseOrderId={selectedPurchaseOrderId}
          statusFilter={poStatusFilter}
          statusOptions={PURCHASE_ORDER_FILTER_OPTIONS}
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
            statusOptions={PURCHASE_ORDER_STATUSES}
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
      )}
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

function InventoryTabs({ activeTab, onSelectTab }) {
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
          onClick={() => onSelectTab(tab)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
