import { useState } from 'react';
import {
  addPartToJob,
  listParts as listInventoryParts,
  removeJobPart,
  updateInventoryJobPartQuantity
} from '../inventory/inventoryService.js';
import {
  buildAddInventoryPartJob,
  buildAddManualPartPatch,
  buildRemoveInventoryPartJob,
  buildRemoveManualPartPatch,
  buildUpdateInventoryPartQuantityJob,
  buildUpdateManualPartPatch
} from './jobDetailFormatting.js';

const EMPTY_PART = { name: '', quantity: '1', cost: '', retail: '' };

export default function useJobInventoryParts({
  canWrite,
  draftJob,
  isDirty,
  onRefresh,
  parts,
  patchJob,
  refreshTimelineEvents,
  saveDraftNow,
  setDraftJob,
  setIsDirty
}) {
  const [part, setPart] = useState(EMPTY_PART);
  const [inventorySearch, setInventorySearch] = useState('');
  const [inventoryParts, setInventoryParts] = useState([]);
  const [isInventoryLoading, setIsInventoryLoading] = useState(false);

  function addPart(event) {
    event.preventDefault();
    if (!canWrite || !part.name.trim()) {
      return;
    }
    patchJob(buildAddManualPartPatch(draftJob, parts, part, crypto.randomUUID()));
    setPart(EMPTY_PART);
  }

  async function searchInventoryParts(event) {
    event.preventDefault();
    setIsInventoryLoading(true);
    try {
      setInventoryParts(await listInventoryParts(draftJob.shopId, {
        search: inventorySearch,
        activeOnly: true
      }));
    } catch (error) {
      console.error('Inventory search failed.', error);
      window.alert(error.message || 'Inventory search failed.');
    } finally {
      setIsInventoryLoading(false);
    }
  }

  async function addInventoryPart(inventoryPart, quantity = 1) {
    if (!canWrite) {
      return;
    }
    const requestedQuantity = Math.max(Number(quantity || 1), 1);
    if (inventoryPart.quantityOnHand < requestedQuantity) {
      const confirmed = window.confirm(`${inventoryPart.name} only has ${inventoryPart.quantityOnHand} on hand. Add ${requestedQuantity} anyway?`);
      if (!confirmed) {
        return;
      }
    }

    let jobForInventory = draftJob;
    if (isDirty) {
      try {
        jobForInventory = (await saveDraftNow()) || draftJob;
      } catch (error) {
        window.alert(error.message || 'Save the job before adding inventory.');
        return;
      }
    }

    try {
      const jobPart = await addPartToJob(jobForInventory.id, inventoryPart.id, requestedQuantity);
      const nextJob = buildAddInventoryPartJob(jobForInventory, jobPart);
      setDraftJob(nextJob);
      setIsDirty(false);
      refreshTimelineEvents();
      if (onRefresh) {
        await onRefresh();
      }
      setInventoryParts((current) => current.map((partRow) => (
        partRow.id === inventoryPart.id
          ? { ...partRow, quantityOnHand: partRow.quantityOnHand - requestedQuantity }
          : partRow
      )));
    } catch (error) {
      console.error('Add inventory part failed.', error);
      window.alert(error.message || 'Unable to add inventory part.');
    }
  }

  async function updatePart(partId, field, value) {
    if (!canWrite) {
      return;
    }
    const editedPart = parts.find((row) => row.id === partId);
    if (field === 'quantity' && editedPart?.partId) {
      const requestedQuantity = Math.max(Number(value || 1), 1);
      if (requestedQuantity > Number(editedPart.quantity || 1)) {
        const additionalQuantity = requestedQuantity - Number(editedPart.quantity || 1);
        const inventoryPart = inventoryParts.find((row) => row.id === editedPart.partId);
        if (inventoryPart && inventoryPart.quantityOnHand < additionalQuantity) {
          const confirmed = window.confirm(`${editedPart.name} only has ${inventoryPart.quantityOnHand} additional on hand. Save quantity ${requestedQuantity} anyway?`);
          if (!confirmed) {
            return;
          }
        }
      }

      if (isDirty) {
        try {
          await saveDraftNow();
        } catch (error) {
          window.alert(error.message || 'Save the job before changing inventory quantity.');
          return;
        }
      }

      try {
        const updatedJobPart = await updateInventoryJobPartQuantity(partId, requestedQuantity);
        setDraftJob((current) => buildUpdateInventoryPartQuantityJob(current, parts, partId, updatedJobPart));
        setIsDirty(false);
        setInventoryParts((current) => current.map((row) => (
          row.id === editedPart.partId
            ? { ...row, quantityOnHand: row.quantityOnHand - (requestedQuantity - Number(editedPart.quantity || 1)) }
            : row
        )));
        refreshTimelineEvents();
        if (onRefresh) {
          await onRefresh();
        }
      } catch (error) {
        console.error('Inventory quantity update failed.', error);
        window.alert(error.message || 'Unable to update inventory quantity.');
      }
      return;
    }

    patchJob(buildUpdateManualPartPatch(draftJob, parts, partId, field, value));
  }

  async function removePart(partId) {
    if (!canWrite) {
      return;
    }
    const removedPart = parts.find((row) => row.id === partId);
    if (removedPart?.partId) {
      const confirmed = window.confirm(`Remove ${removedPart.name} from this job and return it to inventory?`);
      if (!confirmed) {
        return;
      }
      if (isDirty) {
        try {
          await saveDraftNow();
        } catch (error) {
          window.alert(error.message || 'Save the job before removing inventory.');
          return;
        }
      }
      try {
        await removeJobPart(partId);
        const nextJob = buildRemoveInventoryPartJob(draftJob, parts, partId);
        setDraftJob(nextJob);
        setIsDirty(false);
        refreshTimelineEvents();
        if (onRefresh) {
          await onRefresh();
        }
      } catch (error) {
        console.error('Remove inventory part failed.', error);
        window.alert(error.message || 'Unable to remove inventory part.');
      }
      return;
    }

    patchJob(buildRemoveManualPartPatch(draftJob, parts, partId));
  }

  return {
    addInventoryPart,
    addPart,
    inventoryParts,
    inventorySearch,
    isInventoryLoading,
    part,
    removePart,
    searchInventoryParts,
    setInventorySearch,
    setPart,
    updatePart
  };
}
