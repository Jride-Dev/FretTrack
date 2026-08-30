import { useCallback, useEffect, useRef, useState } from 'react';
import { getAssignableShopMembers } from '../modules/jobs/teamAssignmentService.js';
import { getSelectedShop } from '../modules/shops/shopConfig.js';
import { getErrorMessage } from './appRuntimeHelpers.js';

export default function useAssignableMembers(shopId) {
  const [members, setMembers] = useState([]);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const requestIdRef = useRef(0);

  const refresh = useCallback(async (requestedShopId = shopId) => {
    if (requestedShopId && getSelectedShop().shopId !== requestedShopId) {
      return null;
    }

    const requestId = ++requestIdRef.current;
    if (!requestedShopId) {
      setMembers([]);
      setError('');
      setIsLoading(false);
      return [];
    }

    setIsLoading(true);
    setError('');
    try {
      const loadedMembers = await getAssignableShopMembers(requestedShopId);
      if (requestId !== requestIdRef.current || getSelectedShop().shopId !== requestedShopId) {
        return null;
      }
      setMembers(loadedMembers);
      return loadedMembers;
    } catch (loadError) {
      if (requestId !== requestIdRef.current || getSelectedShop().shopId !== requestedShopId) {
        return null;
      }
      console.error('Assignable shop members failed to load.', loadError);
      setMembers([]);
      setError(getErrorMessage(loadError, 'Unable to load active shop members.'));
      return [];
    } finally {
      if (requestId === requestIdRef.current && getSelectedShop().shopId === requestedShopId) {
        setIsLoading(false);
      }
    }
  }, [shopId]);

  useEffect(() => {
    refresh(shopId);
  }, [refresh, shopId]);

  return { members, error, isLoading, refresh };
}
