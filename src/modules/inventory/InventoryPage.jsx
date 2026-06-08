import { useEffect, useMemo, useState } from 'react';
import { money } from '../../shared/utils/money';
import { getCurrentShopId, getShopMoneyOptions } from '../shops/shopConfig';
import { adjustPart, createPart, deactivatePart, listParts, receivePart, updatePart } from './inventoryService';
import useUnsavedChanges from '../../hooks/useUnsavedChanges';
import UnsavedChangesBadge from '../../shared/components/UnsavedChangesBadge.jsx';

const emptyPartForm = {
  sku: '',
  name: '',
  description: '',
  category: '',
  supplier: '',
  manufacturer: '',
  partNumber: '',
  unitCost: '',
  retailPrice: '',
  quantityOnHand: '0',
  reorderPoint: '0',
  location: '',
  isActive: true
};

export default function InventoryPage({ canWrite = true, shopId = getCurrentShopId(), onNotice, onDirtyChange }) {
  const [parts, setParts] = useState([]);
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [selectedPartId, setSelectedPartId] = useState('');
  const [partForm, setPartForm] = useState(emptyPartForm);
  const [receiveForm, setReceiveForm] = useState({ quantity: '1', cost: '', note: '' });
  const [adjustForm, setAdjustForm] = useState({ quantityDelta: '0', note: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { isDirty, markDirty, markClean, confirmIfDirty } = useUnsavedChanges();
  const [saveStatus, setSaveStatus] = useState('saved');
  const moneyOptions = getShopMoneyOptions();

  const selectedPart = useMemo(
    () => parts.find((part) => part.id === selectedPartId) || null,
    [parts, selectedPartId]
  );

  useEffect(() => {
    loadParts().catch((error) => {
      console.error('Inventory load failed.', error);
      onNotice?.({ type: 'error', message: error.message || 'Unable to load inventory.' });
    });
  }, [shopId]);

  useEffect(() => {
    onDirtyChange?.(isDirty);
    return () => onDirtyChange?.(false);
  }, [isDirty, onDirtyChange]);

  async function loadParts(filters = { search, activeOnly: !showInactive, lowStockOnly }) {
    setIsLoading(true);
    try {
      const loadedParts = await listParts(shopId, filters);
      setParts(loadedParts);
      return loadedParts;
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSearch(event) {
    event.preventDefault();
    await loadParts({ search, activeOnly: !showInactive, lowStockOnly });
  }

  function updatePartForm(field, value) {
    setPartForm((current) => ({ ...current, [field]: value }));
    markDirty();
    setSaveStatus('unsaved');
  }

  function loadPartIntoForm(part) {
    setSelectedPartId(part.id);
    setPartForm({
      sku: part.sku || '',
      name: part.name || '',
      description: part.description || '',
      category: part.category || '',
      supplier: part.supplier || '',
      manufacturer: part.manufacturer || '',
      partNumber: part.partNumber || '',
      unitCost: String(part.unitCost ?? ''),
      retailPrice: String(part.retailPrice ?? ''),
      quantityOnHand: String(part.quantityOnHand ?? 0),
      reorderPoint: String(part.reorderPoint ?? 0),
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
      const loadedParts = await loadParts({ search, activeOnly: !showInactive, lowStockOnly });
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
    setIsSaving(true);
    try {
      await receivePart(selectedPart.id, receiveForm.quantity, receiveForm.cost, receiveForm.note);
      onNotice?.({ type: 'success', message: 'Stock received.' });
      setReceiveForm({ quantity: '1', cost: receiveForm.cost, note: '' });
      await loadParts({ search, activeOnly: !showInactive, lowStockOnly });
    } catch (error) {
      console.error('Receive stock failed.', error);
      onNotice?.({ type: 'error', message: error.message || 'Unable to receive stock.' });
    } finally {
      setIsSaving(false);
    }
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
      await loadParts({ search, activeOnly: !showInactive, lowStockOnly });
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
      await loadParts({ search, activeOnly: !showInactive, lowStockOnly });
    } catch (error) {
      console.error('Deactivate part failed.', error);
      onNotice?.({ type: 'error', message: error.message || 'Unable to deactivate part.' });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="panel inventory-page">
      <div className="section-header">
        <div>
          <h2>Inventory</h2>
          <p className="muted-text">Shop-scoped parts catalog, stock counts, receiving, and job-ready retail pricing.</p>
        </div>
        {canWrite && <button type="button" onClick={() => resetForm()}>Add Part</button>}
      </div>

      <form className="row-form inventory-search" onSubmit={handleSearch}>
        <input
          placeholder="Search name, SKU, category, or supplier"
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

      <div className="inventory-layout">
        <div className="inventory-table-wrap">
          <table>
            <thead>
              <tr>
                <th>SKU</th>
                <th>Name</th>
                <th>Category</th>
                <th>On hand</th>
                <th>Reorder</th>
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
                    <td>{part.sku || '-'}</td>
                    <td><strong>{part.name}</strong></td>
                    <td>{part.category || '-'}</td>
                    <td>{part.quantityOnHand}</td>
                    <td>{part.reorderPoint}</td>
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
                  <td colSpan="8">{isLoading ? 'Loading parts...' : 'No parts found.'}</td>
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
              <label>SKU<input disabled={!canWrite} value={partForm.sku} onChange={(event) => updatePartForm('sku', event.target.value)} /></label>
              <label>Name<input disabled={!canWrite} value={partForm.name} onChange={(event) => updatePartForm('name', event.target.value)} required /></label>
              <label>Description<input disabled={!canWrite} value={partForm.description} onChange={(event) => updatePartForm('description', event.target.value)} /></label>
              <label>Category<input disabled={!canWrite} value={partForm.category} onChange={(event) => updatePartForm('category', event.target.value)} /></label>
              <label>Supplier<input disabled={!canWrite} value={partForm.supplier} onChange={(event) => updatePartForm('supplier', event.target.value)} /></label>
              <label>Manufacturer<input disabled={!canWrite} value={partForm.manufacturer} onChange={(event) => updatePartForm('manufacturer', event.target.value)} /></label>
              <label>Part number<input disabled={!canWrite} value={partForm.partNumber} onChange={(event) => updatePartForm('partNumber', event.target.value)} /></label>
              {canWrite && <label>Unit cost<input type="number" min="0" step="0.01" value={partForm.unitCost} onChange={(event) => updatePartForm('unitCost', event.target.value)} /></label>}
              <label>Retail price<input disabled={!canWrite} type="number" min="0" step="0.01" value={partForm.retailPrice} onChange={(event) => updatePartForm('retailPrice', event.target.value)} /></label>
              <label>Quantity on hand<input disabled={!canWrite} type="number" step="1" value={partForm.quantityOnHand} onChange={(event) => updatePartForm('quantityOnHand', event.target.value)} /></label>
              <label>Reorder point<input disabled={!canWrite} type="number" min="0" step="1" value={partForm.reorderPoint} onChange={(event) => updatePartForm('reorderPoint', event.target.value)} /></label>
              <label>Location<input disabled={!canWrite} value={partForm.location} onChange={(event) => updatePartForm('location', event.target.value)} /></label>
            </div>
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
    </section>
  );
}
