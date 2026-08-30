import { useCallback, useRef, useState } from 'react';
import { getCustomers } from '../modules/customers';
import { getJobs } from '../modules/jobs/jobService';
import { sortNewestFirst } from '../modules/jobs/jobSelectors';
import { getSelectedShop } from '../modules/shops/shopConfig';
import { hasSupabaseConfig } from '../shared/lib/supabaseClient';

export default function useJobWorkspaceData({ shopId }) {
  const [jobs, setJobs] = useState([]);
  const [jobsReadyShopId, setJobsReadyShopId] = useState('');
  const [customers, setCustomers] = useState([]);
  const jobsRequestIdRef = useRef(0);
  const customersRequestIdRef = useRef(0);

  const refreshJobs = useCallback(async (targetShopId = shopId || getSelectedShop().shopId) => {
    const requestedShopId = targetShopId || (hasSupabaseConfig ? '' : 'local');
    const selectedShopId = getSelectedShop().shopId || (hasSupabaseConfig ? '' : 'local');
    if (selectedShopId !== requestedShopId) {
      return null;
    }
    const requestId = ++jobsRequestIdRef.current;
    const loadedJobs = await getJobs();
    const activeShopId = getSelectedShop().shopId || (hasSupabaseConfig ? '' : 'local');
    if (requestId !== jobsRequestIdRef.current || activeShopId !== requestedShopId) {
      return null;
    }
    const sortedJobs = sortNewestFirst(loadedJobs);
    setJobs(sortedJobs);
    setJobsReadyShopId(requestedShopId);
    return sortedJobs;
  }, [shopId]);

  const refreshCustomers = useCallback(async (
    sourceJobs = jobs,
    targetShopId = shopId || getSelectedShop().shopId
  ) => {
    if (!Array.isArray(sourceJobs)) {
      return null;
    }
    const requestedShopId = targetShopId || (hasSupabaseConfig ? '' : 'local');
    const selectedShopId = getSelectedShop().shopId || (hasSupabaseConfig ? '' : 'local');
    if (selectedShopId !== requestedShopId) {
      return null;
    }
    const requestId = ++customersRequestIdRef.current;
    const loadedCustomers = await getCustomers(sourceJobs);
    const activeShopId = getSelectedShop().shopId || (hasSupabaseConfig ? '' : 'local');
    if (requestId !== customersRequestIdRef.current || activeShopId !== requestedShopId) {
      return null;
    }
    setCustomers(loadedCustomers);
    return loadedCustomers;
  }, [jobs, shopId]);

  return {
    customers,
    jobs,
    jobsReadyShopId,
    refreshCustomers,
    refreshJobs,
    setCustomers,
    setJobs,
    setJobsReadyShopId
  };
}
