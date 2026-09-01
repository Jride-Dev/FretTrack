import { useEffect, useRef } from 'react';
import { getCurrentSession, onAuthSessionChange, signOut } from '../modules/auth/authService';
import {
  getDefaultEntitlementSnapshot,
  getShopEntitlementSnapshot
} from '../modules/billing/entitlementService';
import { isCurrentOperator } from '../modules/operator/operatorService';
import {
  clearSelectedShop,
  getCurrentShopName,
  getSelectedShop,
  setSelectedShop
} from '../modules/shops/shopConfig';
import {
  bootstrapCurrentUserAsOwner,
  getCurrentUserShopMemberships
} from '../modules/shops/shopMembershipService';
import { getCurrentShopProfile } from '../modules/shops/shopProfileService';
import { checkSupabaseJobsConnection, hasSupabaseConfig } from '../shared/lib/supabaseClient';
import { getErrorMessage, resolveMembership, slugifyShopId } from './appRuntimeHelpers.js';

export default function useSessionShopBootstrap({
  accessState,
  navigation,
  onNotice,
  stateSetters,
  workspace
}) {
  const manualSignOutRef = useRef(false);
  const shopAccessRequestIdRef = useRef(0);
  const {
    isMembershipLoading,
    newShopName,
    session
  } = accessState;
  const {
    confirmUnsavedNavigation,
    resetWorkspaceNavigation,
    setHasUnsavedPageChanges,
    setMode,
    setSelectedJobId
  } = navigation;
  const {
    setBetaAccess,
    setCustomers,
    setEntitlementSnapshot,
    setIsAuthLoading,
    setIsBetaAccessLoading,
    setIsMembershipLoading,
    setIsOperator,
    setIsOperatorLoading,
    setIsPasswordRecovery,
    setIsShopProfileLoading,
    setJobs,
    setJobsReadyShopId,
    setMembership,
    setMemberships,
    setNewShopName,
    setSession,
    setShopName,
    setShopProfile,
    setShowOperatorDashboard,
    setSupabaseStatus
  } = stateSetters;
  const {
    refreshCustomers,
    refreshJobs,
    refreshOfflineDraftQueue,
    resetOfflineDraftQueue
  } = workspace;

  async function checkSupabaseConnection() {
    const result = await checkSupabaseJobsConnection();
    if (result.error) {
      console.error('Supabase connection check failed.', result.error);
    }
    setSupabaseStatus(result.status);
    return result;
  }

  async function loadShopAccess(preferredShopId = getSelectedShop().shopId, options = {}) {
    const requestId = ++shopAccessRequestIdRef.current;
    const isCurrentRequest = () => requestId === shopAccessRequestIdRef.current;
    setIsMembershipLoading(true);
    setJobsReadyShopId('');
    try {
      const availableMemberships = await getCurrentUserShopMemberships();
      if (!isCurrentRequest()) return null;
      setMemberships(availableMemberships);
      const currentMembership = resolveMembership(availableMemberships, preferredShopId);
      setMembership(currentMembership);
      if (!currentMembership) {
        setSupabaseStatus('auth-required');
        clearSelectedShop();
        return null;
      }

      setSelectedShop(currentMembership);
      setShopName(currentMembership.shopName || getCurrentShopName());
      const currentEntitlements = await getShopEntitlementSnapshot(currentMembership.shopId);
      if (!isCurrentRequest()) return null;
      setEntitlementSnapshot(currentEntitlements);
      setIsShopProfileLoading(true);
      const currentShopProfile = await getCurrentShopProfile(currentMembership.shopId);
      if (!isCurrentRequest()) return null;
      setShopProfile(currentShopProfile);
      if (currentShopProfile?.shopName) {
        setShopName(currentShopProfile.shopName);
      }
      setIsShopProfileLoading(false);
      if (!currentShopProfile) {
        setSupabaseStatus('connected');
        return currentMembership;
      }

      const loadedJobs = await refreshJobs(currentMembership.shopId);
      if (!isCurrentRequest() || !loadedJobs) return null;
      await refreshCustomers(loadedJobs, currentMembership.shopId);
      if (!isCurrentRequest()) return null;
      await refreshOfflineDraftQueue(currentMembership.shopId);
      if (!isCurrentRequest()) return null;
      await checkSupabaseConnection();
      return currentMembership;
    } catch (error) {
      if (!isCurrentRequest()) return null;
      console.error('Shop membership load failed.', error);
      setSupabaseStatus('error');
      onNotice({
        type: 'error',
        message: getErrorMessage(error, 'Unable to load shop membership.')
      });
      if (options.rethrow) {
        throw error;
      }
      return null;
    } finally {
      if (isCurrentRequest()) {
        setIsShopProfileLoading(false);
        setIsMembershipLoading(false);
      }
    }
  }

  async function loadSessionAccess() {
    setIsOperatorLoading(true);
    setIsBetaAccessLoading(true);
    try {
      const operatorAccess = await isCurrentOperator();
      setIsOperator(operatorAccess);

      if (operatorAccess) {
        setBetaAccess({ status: 'approved' });
        setIsBetaAccessLoading(false);
        await loadShopAccess();
        return;
      }

      setBetaAccess({ status: 'self-service' });
      setIsBetaAccessLoading(false);
      await loadShopAccess();
    } catch (error) {
      console.error('Account bootstrap check failed.', error);
      setIsOperator(false);
      setBetaAccess({ status: 'self-service' });
      onNotice({
        type: 'error',
        message: getErrorMessage(error, 'Unable to check account access.')
      });
    } finally {
      setIsOperatorLoading(false);
      setIsBetaAccessLoading(false);
    }
  }

  useEffect(() => {
    if (!hasSupabaseConfig) {
      refreshJobs().then((loadedJobs) => refreshCustomers(loadedJobs));
      checkSupabaseConnection();
      return undefined;
    }

    let isMounted = true;
    getCurrentSession()
      .then((currentSession) => {
        if (isMounted) {
          setSession(currentSession);
          if (!currentSession) {
            clearSelectedShop();
            setShopName(getCurrentShopName());
          }
          setIsAuthLoading(false);
        }
      })
      .catch((error) => {
        console.error('Session load failed.', error);
        if (isMounted) {
          setIsAuthLoading(false);
          onNotice({ type: 'error', message: 'Unable to load sign-in session.' });
        }
      });

    const unsubscribe = onAuthSessionChange((nextSession, event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true);
      }

      setSession((currentSession) => {
        if (nextSession) {
          manualSignOutRef.current = false;
        }

        const currentUserId = currentSession?.user?.id || '';
        const nextUserId = nextSession?.user?.id || '';
        const shouldResetWorkspace = (event === 'SIGNED_OUT' && manualSignOutRef.current)
          || (event === 'SIGNED_IN' && currentUserId && nextUserId && currentUserId !== nextUserId);

        if (event === 'SIGNED_OUT' && !manualSignOutRef.current && currentSession) {
          return currentSession;
        }

        if (shouldResetWorkspace) {
          shopAccessRequestIdRef.current += 1;
          setMembership(null);
          setMemberships([]);
          setShopProfile(null);
          setIsOperator(false);
          setBetaAccess(null);
          setShowOperatorDashboard(false);
          setEntitlementSnapshot(getDefaultEntitlementSnapshot());
          setJobs([]);
          setCustomers([]);
          resetOfflineDraftQueue();
          resetWorkspaceNavigation();
          if (!nextSession) {
            clearSelectedShop();
            setShopName(getCurrentShopName());
          }
        }

        return nextSession;
      });
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  // Session listeners intentionally bind once; their state transitions use React setters and stable workspace boundaries.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hasSupabaseConfig || !session) {
      setIsOperator(false);
      setBetaAccess(null);
      setIsBetaAccessLoading(false);
      return;
    }

    loadSessionAccess();
  // Access bootstrap is keyed to identity changes, not unrelated render-time callback identities.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

  async function handleBootstrapOwner() {
    if (isMembershipLoading) {
      return;
    }

    const shopNameValue = newShopName.trim();
    if (!shopNameValue) {
      onNotice({ type: 'error', message: 'Enter a shop name first.' });
      return;
    }

    const shopId = slugifyShopId(shopNameValue);
    if (!shopId) {
      onNotice({ type: 'error', message: 'Enter a valid shop name.' });
      return;
    }

    setIsMembershipLoading(true);
    onNotice(null);
    try {
      await bootstrapCurrentUserAsOwner(shopId, shopNameValue);
      await loadShopAccess(shopId, { rethrow: true });
      setNewShopName('');
      onNotice({ type: 'success', message: 'Shop owner access created.' });
    } catch (error) {
      onNotice({
        type: 'error',
        message: getErrorMessage(error, 'Unable to create shop owner access.')
      });
    } finally {
      setIsMembershipLoading(false);
    }
  }

  async function handleSignOut() {
    if (!confirmUnsavedNavigation()) {
      return;
    }

    manualSignOutRef.current = true;
    shopAccessRequestIdRef.current += 1;
    setJobs([]);
    setCustomers([]);
    setMembership(null);
    setMemberships([]);
    setShopProfile(null);
    setIsOperator(false);
    setBetaAccess(null);
    setIsBetaAccessLoading(false);
    setShowOperatorDashboard(false);
    setEntitlementSnapshot(getDefaultEntitlementSnapshot());
    resetOfflineDraftQueue();
    resetWorkspaceNavigation();
    clearSelectedShop();
    try {
      await signOut();
      onNotice(null);
    } catch (error) {
      manualSignOutRef.current = false;
      onNotice({
        type: 'error',
        message: getErrorMessage(error, 'Sign out failed.')
      });
    }
  }

  function handleAuthCompleted(nextSession) {
    if (nextSession) {
      setSession(nextSession);
    }
  }

  async function handleShopProfileSaved(savedProfile) {
    setShopProfile(savedProfile);
    setSelectedShop(savedProfile);
    setShopName(savedProfile.shopName);
    setEntitlementSnapshot(await getShopEntitlementSnapshot(savedProfile.shopId));
    const loadedJobs = await refreshJobs();
    await refreshCustomers(loadedJobs);
    await checkSupabaseConnection();
    setMode('new');
  }

  async function handleShopSelected(selectedMembership) {
    if (selectedMembership?.effectiveMemberAccess === false) {
      onNotice({ type: 'error', message: 'Staff access for this shop is available in Pro.' });
      return;
    }

    shopAccessRequestIdRef.current += 1;
    setJobs([]);
    setCustomers([]);
    setSelectedJobId(null);
    setShopProfile(null);
    setShowOperatorDashboard(false);
    setEntitlementSnapshot(getDefaultEntitlementSnapshot(selectedMembership.shopId));
    setMembership(selectedMembership);
    setSelectedShop(selectedMembership);
    setShopName(selectedMembership.shopName || selectedMembership.shopId);
    await loadShopAccess(selectedMembership.shopId);
  }

  function showShopPicker() {
    if (!confirmUnsavedNavigation()) {
      return;
    }

    shopAccessRequestIdRef.current += 1;
    setHasUnsavedPageChanges(false);
    setJobs([]);
    setCustomers([]);
    setSelectedJobId(null);
    setShopProfile(null);
    setMembership(null);
    setShowOperatorDashboard(false);
    setEntitlementSnapshot(getDefaultEntitlementSnapshot());
    resetOfflineDraftQueue();
    clearSelectedShop();
  }

  return {
    checkSupabaseConnection,
    handleAuthCompleted,
    handleBootstrapOwner,
    handleShopProfileSaved,
    handleShopSelected,
    handleSignOut,
    loadSessionAccess,
    loadShopAccess,
    showShopPicker
  };
}
