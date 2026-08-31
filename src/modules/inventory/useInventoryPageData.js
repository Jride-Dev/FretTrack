import { useCallback, useEffect, useRef, useState } from 'react';
import {
  listPartMovements,
  listPartPurchaseHistory,
  listParts,
  listPurchaseHistory,
  listPurchaseOrders,
  listVendors
} from './inventoryService';

export default function useInventoryPageData({ filters, onNotice, selectedPartId, shopId }) {
  const [parts, setParts] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [partMovements, setPartMovements] = useState([]);
  const [partPurchaseHistory, setPartPurchaseHistory] = useState([]);
  const [purchaseHistory, setPurchaseHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const filtersRef = useRef(filters);
  const noticeRef = useRef(onNotice);
  const partHistoryRequestRef = useRef(0);
  filtersRef.current = filters;
  noticeRef.current = onNotice;

  const loadInventoryPage = useCallback(async (partFilters = filtersRef.current) => {
    setIsLoading(true);
    try {
      const [loadedParts, loadedVendors, loadedOrders, loadedHistory] = await Promise.all([
        listParts(shopId, partFilters),
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
  }, [shopId]);

  const loadPartsOnly = useCallback(async (partFilters = filtersRef.current) => {
    setIsLoading(true);
    try {
      const loadedParts = await listParts(shopId, partFilters);
      setParts(loadedParts);
      return loadedParts;
    } finally {
      setIsLoading(false);
    }
  }, [shopId]);

  const refreshPurchasingData = useCallback(async () => {
    const [loadedVendors, loadedOrders, loadedHistory] = await Promise.all([
      listVendors(shopId, { activeOnly: false }),
      listPurchaseOrders(shopId),
      listPurchaseHistory({ shopId })
    ]);
    setVendors(loadedVendors);
    setPurchaseOrders(loadedOrders);
    setPurchaseHistory(loadedHistory);
    return { loadedVendors, loadedOrders, loadedHistory };
  }, [shopId]);

  const refreshPartHistory = useCallback(async (partId) => {
    const requestId = partHistoryRequestRef.current + 1;
    partHistoryRequestRef.current = requestId;
    if (!partId) {
      setPartMovements([]);
      setPartPurchaseHistory([]);
      return { movements: [], purchaseRows: [] };
    }
    let movements;
    let purchaseRows;
    try {
      [movements, purchaseRows] = await Promise.all([
        listPartMovements(partId),
        listPartPurchaseHistory(partId)
      ]);
    } catch (error) {
      if (partHistoryRequestRef.current === requestId) {
        setPartMovements([]);
        setPartPurchaseHistory([]);
      }
      throw error;
    }
    if (partHistoryRequestRef.current !== requestId) {
      return { movements, purchaseRows };
    }
    setPartMovements(movements);
    setPartPurchaseHistory(purchaseRows);
    return { movements, purchaseRows };
  }, []);

  useEffect(() => {
    loadInventoryPage().catch((error) => {
      console.error('Inventory load failed.', error);
      noticeRef.current?.({ type: 'error', message: error.message || 'Unable to load inventory.' });
    });
  }, [loadInventoryPage]);

  useEffect(() => {
    refreshPartHistory(selectedPartId)
      .catch((error) => {
        console.error('Part history load failed.', error);
      });
  }, [refreshPartHistory, selectedPartId]);

  return {
    isLoading,
    loadInventoryPage,
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
  };
}
