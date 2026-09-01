import { useEffect, useMemo, useState } from 'react';
import {
  adjustPart,
  createPart,
  createPartImageObjectUrl,
  deactivatePart,
  fixMissingPartBarcodeCode,
  getPart,
  receivePart,
  updatePart,
  uploadPartImage
} from './inventoryService';
import { EMPTY_PART_FORM } from './inventoryPageDefaults.js';
import { withAuthoritativeStockFields } from './inventoryStockForm.js';

export default function useInventoryPartController({
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
}) {
  const [partForm, setPartForm] = useState(EMPTY_PART_FORM);
  const [partImageFile, setPartImageFile] = useState(null);
  const [partImagePreviewUrl, setPartImagePreviewUrl] = useState('');
  const [receiveForm, setReceiveForm] = useState({ quantity: '1', cost: '', note: '' });
  const [adjustForm, setAdjustForm] = useState({ quantityDelta: '0', note: '' });
  const [selectedLabelPartIds, setSelectedLabelPartIds] = useState([]);
  const [isPrintingLabels, setIsPrintingLabels] = useState(false);

  const selectedPart = useMemo(
    () => parts.find((part) => part.id === selectedPartId) || null,
    [parts, selectedPartId]
  );
  const selectedLabelParts = useMemo(
    () => selectedLabelPartIds
      .map((partId) => parts.find((part) => part.id === partId))
      .filter(Boolean),
    [parts, selectedLabelPartIds]
  );

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

  async function refreshPartsAfterStockMutation(updatedPart = null) {
    const loadedParts = await loadPartsOnly(filters);
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
      purchaseUnitCost: String(part.purchaseUnitCost ?? ''),
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
    setPartForm(EMPTY_PART_FORM);
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
      const loadedParts = await loadPartsOnly(filters);
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
      await refreshPartHistory(selectedPart.id);
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
      const loadedParts = await loadPartsOnly(filters);
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
    setSelectedLabelPartIds((current) => checked
      ? (current.includes(partId) ? current : [...current, partId])
      : current.filter((id) => id !== partId));
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
      await loadPartsOnly(filters);
    } catch (error) {
      console.error('Deactivate part failed.', error);
      onNotice?.({ type: 'error', message: error.message || 'Unable to deactivate part.' });
    } finally {
      setIsSaving(false);
    }
  }

  return {
    adjustForm,
    handleAdjust,
    handleDeactivate,
    handleGenerateBarcodeCode,
    handlePartImageChange,
    handleReceive,
    loadPartIntoForm,
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
  };
}
