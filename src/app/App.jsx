import { useEffect, useRef, useState } from 'react';
import AppNotice from '../shared/components/AppNotice.jsx';
import NewJobSidebar from './NewJobSidebar.jsx';
import { BillingStateBanner, InternalCurrentAccessPanel, PendingApprovalScreen } from './AppAccessPanels.jsx';
import { getAppAccess } from './appAccess.js';
import {
  getCurrentShopProfileFallback,
  getErrorMessage,
  resolveMembership,
  slugifyShopId
} from './appRuntimeHelpers.js';
import WorkspaceRouter from './WorkspaceRouter.jsx';
import useJobWorkspaceActions from './useJobWorkspaceActions.js';
import useJobWorkspaceData from './useJobWorkspaceData.js';
import useOfflineDraftQueue from './useOfflineDraftQueue.js';
import useAppPreferences from './useAppPreferences.js';
import useAssignableMembers from './useAssignableMembers.js';
import useWorkspaceNavigation from './useWorkspaceNavigation.js';
import AuthGate from '../modules/auth/AuthGate.jsx';
import BetaOperatorDashboard from '../modules/operator/BetaOperatorDashboard.jsx';
import ShopSettings from '../modules/shops/ShopSettings.jsx';
import FeedbackReporter from '../modules/system/FeedbackReporter.jsx';
import SystemAnnouncements from '../modules/system/SystemAnnouncements.jsx';
import { checkSupabaseJobsConnection, hasSupabaseConfig } from '../shared/lib/supabaseClient';
import { getCurrentSession, onAuthSessionChange, signOut } from '../modules/auth/authService';
import {
  canAccessOperatorDashboard,
  getCurrentAccessPermissions
} from '../modules/auth/permissionService';
import { calculateTillSummary } from '../modules/jobs/jobSelectors';
import { clearSelectedShop, getCurrentShopName, getSelectedShop, getShopDateOptions, getShopMoneyOptions, setSelectedShop } from '../modules/shops/shopConfig';
import { clearVitePreloadReloadGuard } from '../shared/pwa/preloadRecovery';
import { bootstrapCurrentUserAsOwner, getCurrentUserShopMemberships } from '../modules/shops/shopMembershipService';
import { getCurrentShopProfile } from '../modules/shops/shopProfileService';
import {
  getDefaultEntitlementSnapshot,
  getShopEntitlementSnapshot
} from '../modules/billing/entitlementService';
import { getPlanStatus, getPlanVersionText } from '../modules/billing/planStatus';
import { getOrCreateBetaAccessRequest } from '../modules/beta/betaAccessService';
import { isCurrentOperator } from '../modules/operator/operatorService';
import { isAmplifierJob } from '../modules/amplifiers/amplifierRepair.js';
import { isKeyboardJob } from '../modules/keyboards/keyboardRepair.js';

const APP_VERSION = '0.3.1';
const APP_NAME = 'FretTrack';
const APP_TAGLINE = 'Modern workflow for instrument repair';

export default function App() {
  const [currentJobsAssigneeFilter, setCurrentJobsAssigneeFilter] = useState('');
  const [supabaseStatus, setSupabaseStatus] = useState(hasSupabaseConfig ? 'checking' : 'not-configured');
  const [session, setSession] = useState(null);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(hasSupabaseConfig);
  const [membership, setMembership] = useState(null);
  const [memberships, setMemberships] = useState([]);
  const [isMembershipLoading, setIsMembershipLoading] = useState(false);
  const [shopProfile, setShopProfile] = useState(null);
  const [entitlementSnapshot, setEntitlementSnapshot] = useState(() => getDefaultEntitlementSnapshot());
  const [isShopProfileLoading, setIsShopProfileLoading] = useState(false);
  const [isOperator, setIsOperator] = useState(false);
  const [isOperatorLoading, setIsOperatorLoading] = useState(false);
  const [betaAccess, setBetaAccess] = useState(null);
  const [isBetaAccessLoading, setIsBetaAccessLoading] = useState(false);
  const [showOperatorDashboard, setShowOperatorDashboard] = useState(false);
  const [newShopName, setNewShopName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [pendingNewJobCustomer, setPendingNewJobCustomer] = useState(null);
  const [notice, setNotice] = useState(null);
  const [shopName, setShopName] = useState(() => getCurrentShopName());
  const manualSignOutRef = useRef(false);
  const shopAccessRequestIdRef = useRef(0);
  const {
    dismissInstallHelp,
    installApp: handleInstallApp,
    isNewJobSidebarCollapsed,
    setTheme,
    shouldShowIosInstallHelp,
    shouldShowPwaInstallButton,
    theme,
    themes,
    toggleNewJobSidebar
  } = useAppPreferences({ onNotice: setNotice });
  const {
    members: assignableMembers,
    error: assignableMembersError,
    isLoading: assignableMembersLoading,
    refresh: refreshAssignableMembers
  } = useAssignableMembers(membership?.shopId);

  const {
    customers,
    jobs,
    jobsReadyShopId,
    refreshCustomers,
    refreshJobs,
    setCustomers,
    setJobs,
    setJobsReadyShopId
  } = useJobWorkspaceData({ shopId: membership?.shopId });

  useEffect(() => {
    clearVitePreloadReloadGuard();
  }, []);
  const billingAccess = entitlementSnapshot || getDefaultEntitlementSnapshot(membership?.shopId);
  const betaApproved = betaAccess?.status === 'approved';
  const planStatus = getPlanStatus(billingAccess);
  const appVersionText = getPlanVersionText(APP_VERSION, planStatus);
  const {
    permissionContext,
    amplifierRepairEnabled,
    canEditAmplifierRepair,
    keyboardRepairEnabled,
    canEditKeyboardRepair,
    canEditJobs,
    canWrite,
    canManageShop,
    canEditShopSettings,
    canManageTeamMembers,
    canManageInventory,
    canManageShipments,
    canEditCustomers,
    canEditScheduling,
    canPreviewCustomerImport,
    canUploadPhotos,
    canEditPhotos,
    canOverwritePhotos,
    canDeletePhotos,
    canViewBilling,
    canSendEmail,
    canScheduleEmail,
    canSendSms,
    teamAssignmentEnabled,
    entitlementMessage
  } = getAppAccess({ membership, billingAccess, betaApproved, hasSupabaseConfig });
  const tillSummary = calculateTillSummary(jobs, { shopProfile });
  const moneyOptions = getShopMoneyOptions(shopProfile || undefined);
  const dateOptions = getShopDateOptions(shopProfile || undefined);
  const {
    mode,
    selectedJobId,
    isWorkspaceReady,
    setMode,
    setSelectedJobId,
    setHasUnsavedPageChanges,
    confirmUnsavedNavigation,
    navigateTo,
    selectJob: selectWorkspaceJob,
    closeJobDetail,
    resetWorkspaceNavigation
  } = useWorkspaceNavigation({
    shopId: membership?.shopId,
    jobs,
    isReady: Boolean(
      membership?.shopId
      && shopProfile
      && jobsReadyShopId === membership.shopId
      && !isMembershipLoading
      && !isShopProfileLoading
    ),
    access: { isOperator, canManageShop, canViewBilling, canWrite },
    onAccessDenied: () => setNotice({ type: 'error', message: 'This area is not available for your account.' })
  });
  const selectedJob = jobs.find((job) => job.id === selectedJobId);
  const {
    handleDiscardOfflineDraft,
    handleOfflineDraftSaved,
    handleSyncOfflineDraft,
    isOnline,
    offlineDraftCount,
    offlineDrafts,
    refreshOfflineDraftQueue,
    resetOfflineDraftQueue,
    selectedOfflineDraftId,
    setSelectedOfflineDraftId,
    syncingDraftId
  } = useOfflineDraftQueue({
    onNotice: setNotice,
    onOpenDrafts: () => setMode('drafts'),
    refreshCustomers,
    refreshJobs,
    shopId: membership?.shopId
  });
  const {
    handleAccountingVoidChange,
    handleAmplifierJobCreate,
    handleAssignmentChanged,
    handleImageDelete,
    handleImageUpload,
    handleKeyboardJobCreate,
    handleUpdate
  } = useJobWorkspaceActions({
    access: {
      amplifierRepairEnabled,
      canEditAmplifierRepair,
      canEditKeyboardRepair,
      canEditShopSettings,
      canUploadPhotos,
      canWrite,
      entitlementMessage,
      keyboardRepairEnabled
    },
    isOnline,
    navigation: { selectWorkspaceJob, setHasUnsavedPageChanges, setSelectedJobId },
    refreshCustomers,
    refreshJobs,
    selectedJobId,
    setJobs,
    setNotice
  });

  function handleSelectJob(jobId) {
    const job = jobs.find((item) => item.id === jobId);
    const detailMode = isAmplifierJob(job)
      ? 'amplifier-detail'
      : isKeyboardJob(job)
        ? 'keyboard-detail'
        : 'guitar-detail';
    return selectWorkspaceJob(jobId, detailMode);
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
        setNotice({ type: 'error', message: 'Unable to load sign-in session.' });
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
  }, []);

  useEffect(() => {
    if (!hasSupabaseConfig || !session) {
      setIsOperator(false);
      setBetaAccess(null);
      setIsBetaAccessLoading(false);
      return;
    }

    loadSessionAccess();
  }, [session?.user?.id]);

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

      const accessRequest = await getOrCreateBetaAccessRequest();
      setBetaAccess(accessRequest);
      setIsBetaAccessLoading(false);

      if (accessRequest.status === 'approved') {
        await loadShopAccess();
        return;
      }

      setMembership(null);
      setMemberships([]);
      setShopProfile(null);
      setEntitlementSnapshot(getDefaultEntitlementSnapshot());
      setJobs([]);
      setCustomers([]);
      resetWorkspaceNavigation();
      setSupabaseStatus('auth-required');
      clearSelectedShop();
    } catch (error) {
      console.error('Access approval check failed.', error);
      setIsOperator(false);
      setBetaAccess({ status: 'pending' });
      setNotice({
        type: 'error',
        message: getErrorMessage(error, 'Unable to check account access.')
      });
    } finally {
      setIsOperatorLoading(false);
      setIsBetaAccessLoading(false);
    }
  }

  useEffect(() => {
    if (!notice?.message) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setNotice(null);
    }, 10000);

    return () => window.clearTimeout(timeoutId);
  }, [notice]);

  async function checkSupabaseConnection() {
    const result = await checkSupabaseJobsConnection();
    if (result.error) {
      console.error('Supabase connection check failed.', result.error);
    }
    setSupabaseStatus(result.status);
    if (!result.ok) {
      return;
    }
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
        return;
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
        return;
      }

      const loadedJobs = await refreshJobs(currentMembership.shopId);
      if (!isCurrentRequest() || !loadedJobs) return null;
      await refreshCustomers(loadedJobs, currentMembership.shopId);
      if (!isCurrentRequest()) return null;
      await refreshOfflineDraftQueue(currentMembership.shopId);
      if (!isCurrentRequest()) return null;
      await checkSupabaseConnection();
    } catch (error) {
      if (!isCurrentRequest()) return null;
      console.error('Shop membership load failed.', error);
      setSupabaseStatus('error');
      setNotice({
        type: 'error',
        message: getErrorMessage(error, 'Unable to load shop membership.')
      });
      if (options.rethrow) {
        throw error;
      }
    } finally {
      if (isCurrentRequest()) {
        setIsShopProfileLoading(false);
        setIsMembershipLoading(false);
      }
    }
  }

  async function handleBootstrapOwner() {
    if (isMembershipLoading) {
      return;
    }

    const shopNameValue = newShopName.trim();
    if (!shopNameValue) {
      setNotice({ type: 'error', message: 'Enter a shop name first.' });
      return;
    }

    const shopId = slugifyShopId(shopNameValue);
    if (!shopId) {
      setNotice({ type: 'error', message: 'Enter a valid shop name.' });
      return;
    }

    if (hasSupabaseConfig && !isOperator && betaAccess?.status !== 'approved') {
      setNotice({ type: 'error', message: 'FretTrack must approve your account access before you can create a shop.' });
      return;
    }

    setIsMembershipLoading(true);
    setNotice(null);
    try {
      await bootstrapCurrentUserAsOwner(shopId, shopNameValue);
      await loadShopAccess(shopId, { rethrow: true });
      setNewShopName('');
      setNotice({ type: 'success', message: 'Shop owner access created.' });
    } catch (error) {
      setNotice({
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
      setNotice(null);
    } catch (error) {
      manualSignOutRef.current = false;
      setNotice({
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

  async function saveCurrentJob() {
    if (!canWrite) {
      setNotice({ type: 'error', message: 'Your shop role is read-only.' });
      return;
    }

    if (selectedJob && ['detail', 'guitar-detail', 'amplifier-detail', 'keyboard-detail'].includes(mode)) {
      if (hasSupabaseConfig && !isOnline) {
        setNotice({ type: 'error', message: 'Offline draft mode is for new job intake only. Existing job edits require an active connection.' });
        return;
      }

      setIsSaving(true);
      setNotice(null);
      try {
        const savedJob = await new Promise((resolve, reject) => {
          window.dispatchEvent(new CustomEvent('guitar-app-save-current-job', {
            detail: { resolve, reject }
          }));
        });
        setNotice({
          type: 'success',
          message: `Saved job ${savedJob?.jobNumber || selectedJob.jobNumber || ''} successfully.`
        });
      } catch (error) {
        setNotice({
          type: 'error',
          message: getErrorMessage(error, 'Job save failed.')
        });
      } finally {
        setIsSaving(false);
      }
      return;
    }

    await checkSupabaseConnection();
  }

  async function handleJobSaved(savedJob) {
    if (!canWrite) {
      setNotice({ type: 'error', message: 'Your shop role is read-only.' });
      return;
    }

    const loadedJobs = await refreshJobs();
    await refreshCustomers(loadedJobs);
    setPendingNewJobCustomer(null);
    setSelectedJobId(savedJob.id);
    setMode('new');
    setNotice({
      type: 'success',
      message: `Saved job ${savedJob?.jobNumber || ''} successfully.`
    });
  }

  function openCurrentJobsForAssignee(assignedMemberId) {
    setCurrentJobsAssigneeFilter(assignedMemberId || '');
    navigateTo('list');
  }

  function showNewJob(customer = null, options = {}) {
    if (!options.skipDirtyGuard && !confirmUnsavedNavigation()) {
      return;
    }

    setHasUnsavedPageChanges(false);
    setPendingNewJobCustomer(customer || null);
    setSelectedJobId(null);
    setMode('new');
  }

  async function handleCustomerSaved() {
    await refreshCustomers(jobs);
    setPendingNewJobCustomer(null);
    setMode('customers');
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
      setNotice({ type: 'error', message: 'Staff access for this shop is available in Pro.' });
      return;
    }

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

  const statusText = {
    checking: 'Supabase Checking',
    connected: 'Supabase Connected',
    'not-configured': 'Supabase Not Configured',
    'auth-required': 'Supabase Auth Required',
    error: 'Supabase Error'
  }[supabaseStatus];

  if (hasSupabaseConfig && isAuthLoading) {
    return (
      <main className="app auth-shell">
        <section className="panel auth-panel">Loading FretTrack...</section>
      </main>
    );
  }

  if (hasSupabaseConfig && !session) {
    return (
      <>
        <AuthGate onAuthCompleted={handleAuthCompleted} onNotice={setNotice} />
        <AppNotice message={notice?.message} type={notice?.type} onDismiss={() => setNotice(null)} />
      </>
    );
  }

  if (hasSupabaseConfig && session && isPasswordRecovery) {
    return (
      <>
        <AuthGate
          initialMode="update-password"
          onPasswordUpdated={() => setIsPasswordRecovery(false)}
          onNotice={setNotice}
        />
        <AppNotice message={notice?.message} type={notice?.type} onDismiss={() => setNotice(null)} />
      </>
    );
  }

  if (hasSupabaseConfig && session && !isOperator && isBetaAccessLoading) {
    return (
      <main className="app auth-shell">
        <section className="panel auth-panel">Checking account access...</section>
      </main>
    );
  }

  if (hasSupabaseConfig && session && !isOperator && betaAccess && betaAccess.status !== 'approved') {
    return (
      <>
        <PendingApprovalScreen
          betaAccess={betaAccess}
          email={session.user?.email || ''}
          onRetry={loadSessionAccess}
          onSignOut={handleSignOut}
        />
        <AppNotice message={notice?.message} type={notice?.type} onDismiss={() => setNotice(null)} />
      </>
    );
  }

  if (hasSupabaseConfig && session && memberships.length > 1 && !membership) {
    if (isOperator && showOperatorDashboard) {
      return (
        <main className="app app-shell operator-only-shell">
          <header>
            <div className="brand-header">
              <img src="/frettrack-emblem.png" alt="" aria-hidden="true" />
              <div className="brand-copy">
                <h1>{APP_NAME}</h1>
                <small>{APP_TAGLINE}</small>
                <strong>Operator</strong>
                <span className="app-version">Version {APP_VERSION}</span>
              </div>
            </div>
            <div className="mode-actions no-print">
              <button type="button" onClick={() => setShowOperatorDashboard(false)}>Back to Shops</button>
              <button type="button" onClick={handleSignOut}>Sign Out</button>
            </div>
          </header>
          <AppNotice message={notice?.message} type={notice?.type} onDismiss={() => setNotice(null)} />
          <SystemAnnouncements />
          <BetaOperatorDashboard onNotice={setNotice} />
        </main>
      );
    }

    return (
      <main className="app auth-shell">
        <AppNotice message={notice?.message} type={notice?.type} onDismiss={() => setNotice(null)} />
        <section className="panel auth-panel">
          <h1>Select Shop</h1>
          <p className="muted-text">{session.user?.email}</p>
          <div className="shop-picker-list">
            {memberships.map((shopMembership) => (
              <button
                type="button"
                key={shopMembership.id}
                className={`shop-picker-button${shopMembership.effectiveMemberAccess === false ? ' locked' : ''}`}
                onClick={() => handleShopSelected(shopMembership)}
                disabled={shopMembership.effectiveMemberAccess === false}
              >
                <strong>{shopMembership.shopName || shopMembership.shopId}</strong>
                <span>{shopMembership.role}{shopMembership.effectiveMemberAccess === false ? ' - Shop team access required' : ''}</span>
              </button>
            ))}
          </div>
          {isOperator && (
            <button type="button" className="primary-action" onClick={() => setShowOperatorDashboard(true)}>
              Operator Dashboard
            </button>
          )}
          <button type="button" className="button-tertiary" onClick={handleSignOut}>
            Sign Out
          </button>
        </section>
      </main>
    );
  }

  if (hasSupabaseConfig && session && !membership) {
    if (isOperatorLoading) {
      return (
        <main className="app auth-shell">
          <section className="panel auth-panel">Checking operator access...</section>
        </main>
      );
    }

    if (isOperator) {
      return (
        <main className="app app-shell operator-only-shell">
          <header>
            <div className="brand-header">
              <img src="/frettrack-emblem.png" alt="" aria-hidden="true" />
              <div className="brand-copy">
                <h1>{APP_NAME}</h1>
                <small>{APP_TAGLINE}</small>
                <strong>Operator</strong>
                <span className="app-version">Version {APP_VERSION}</span>
              </div>
            </div>
            <div className="mode-actions no-print">
              <button type="button" onClick={handleSignOut}>Sign Out</button>
            </div>
          </header>
          <AppNotice message={notice?.message} type={notice?.type} onDismiss={() => setNotice(null)} />
          <SystemAnnouncements />
          <BetaOperatorDashboard onNotice={setNotice} />
        </main>
      );
    }

    if (memberships.length) {
      return (
        <main className="app auth-shell">
          <AppNotice message={notice?.message} type={notice?.type} onDismiss={() => setNotice(null)} />
          <section className="panel auth-panel">
            <h1>Shop Access Locked</h1>
            <p>Trial access keeps the owner account active. Staff access is available in Pro while access is active.</p>
            <p className="muted-text">{session.user?.email}</p>
            <div className="shop-picker-list">
              {memberships.map((shopMembership) => (
                <div key={shopMembership.id} className="shop-picker-button locked">
                  <strong>{shopMembership.shopName || shopMembership.shopId}</strong>
                  <span>{shopMembership.role} - preserved membership</span>
                </div>
              ))}
            </div>
            <button type="button" className="button-tertiary" onClick={() => loadShopAccess()} disabled={isMembershipLoading}>
              Retry Access Check
            </button>
            <button type="button" className="button-tertiary" onClick={handleSignOut}>
              Sign Out
            </button>
          </section>
        </main>
      );
    }

    return (
      <main className="app auth-shell">
        <AppNotice message={notice?.message} type={notice?.type} onDismiss={() => setNotice(null)} />
        <section className="panel auth-panel">
          <h1>Create Shop</h1>
          <p>{isMembershipLoading ? 'Checking shop membership...' : 'Your account is signed in, but it is not connected to a FretTrack shop yet.'}</p>
          <p className="muted-text">{session.user?.email}</p>
          <label>
            Shop Name
            <input
              value={newShopName}
              onChange={(event) => setNewShopName(event.target.value)}
              placeholder="Your shop name"
              disabled={isMembershipLoading}
            />
          </label>
          <button type="button" className="primary-action" onClick={handleBootstrapOwner} disabled={isMembershipLoading}>
            {isMembershipLoading ? 'Working...' : 'Create My Shop'}
          </button>
          <button type="button" className="button-tertiary" onClick={() => loadShopAccess()} disabled={isMembershipLoading}>
            Retry Access Check
          </button>
          <button type="button" className="button-tertiary" onClick={handleSignOut}>
            Sign Out
          </button>
        </section>
      </main>
    );
  }

  if (hasSupabaseConfig && session && membership && !shopProfile) {
    return (
      <main className="app auth-shell">
        <AppNotice message={notice?.message} type={notice?.type} onDismiss={() => setNotice(null)} />
        <section className="panel auth-panel onboarding-panel">
          {isShopProfileLoading ? (
            <p>Loading shop setup...</p>
          ) : (
            <ShopSettings
              canManageShop={canEditShopSettings}
              currentUserId={session?.user?.id || ''}
              initialSettings={{ ...getCurrentShopProfileFallback(), shopId: membership.shopId }}
              entitlementSnapshot={billingAccess}
              requireCompletion
              onSave={handleShopProfileSaved}
              onNotice={setNotice}
            />
          )}
          <button type="button" className="button-tertiary" onClick={handleSignOut}>
            Sign Out
          </button>
        </section>
      </main>
    );
  }

  if (hasSupabaseConfig && session && membership && shopProfile && !isWorkspaceReady) {
    return (
      <main className="app auth-shell">
        <section className="panel auth-panel">Loading shop workspace...</section>
      </main>
    );
  }

  const isJobMode = ['new', 'detail', 'guitar-detail', 'amplifier-detail', 'keyboard-detail'].includes(mode);
  const getHeaderNavClass = (targetMode, baseClass = '') => [
    baseClass,
    mode === targetMode ? 'header-nav-active' : ''
  ].filter(Boolean).join(' ') || undefined;
  const saveJobButtonClass = isJobMode ? 'primary-action header-nav-active' : 'button-tertiary';

  return (
    <main className="app app-shell">
      <header>
        <div className="brand-header">
          <img
            src={planStatus.emblemSrc}
            alt=""
            aria-hidden="true"
            className={planStatus.emblemClassName}
          />
          <div className="brand-copy">
            <h1>{planStatus.headerLabel || APP_NAME}</h1>
            <small>{APP_TAGLINE}</small>
            <strong>{shopName}</strong>
            <span className="plan-line">
              <span className={`plan-badge ${planStatus.badgeTone}`}>{planStatus.planLabel || 'Trial'}</span>
              {planStatus.countdownLabel && <span>{planStatus.countdownLabel}</span>}
            </span>
            <span className="app-version">{appVersionText}</span>
          </div>
        </div>
        <div className="mode-actions no-print header-actions">
          <span className={`connection-status ${supabaseStatus}`} title={statusText}>
            <span className="connection-status-dot" aria-hidden="true" />
            Database
          </span>
          {!isOnline && (
            <span className="connection-status offline" title="Browser offline">
              Offline
            </span>
          )}
          <div className="theme-settings">
            <label className="theme-picker">
              Theme
              <select value={theme} onChange={(event) => setTheme(event.target.value)}>
                {themes.map((themeOption) => (
                  <option key={themeOption.value} value={themeOption.value}>{themeOption.label}</option>
                ))}
              </select>
            </label>
          </div>
          {shouldShowPwaInstallButton && (
            <button type="button" onClick={handleInstallApp}>Install App</button>
          )}
          <button type="button" className={saveJobButtonClass} onClick={saveCurrentJob} disabled={isSaving || !canWrite}>
            {isSaving ? 'Saving...' : 'Save Job'}
          </button>
          <button type="button" className={getHeaderNavClass('new')} onClick={() => showNewJob()}>New Job</button>
          <button type="button" className={getHeaderNavClass('list')} onClick={() => navigateTo('list')}>Current Jobs</button>
          <button
            type="button"
            className={['amplifiers', 'amplifier-detail'].includes(mode) ? 'header-nav-active' : undefined}
            onClick={() => navigateTo('amplifiers')}
          >
            Amplifier Repair
          </button>
          <button
            type="button"
            className={['keyboards', 'keyboard-detail'].includes(mode) ? 'header-nav-active' : undefined}
            onClick={() => navigateTo('keyboards')}
          >
            Keyboard Repair
          </button>
          <button type="button" className={getHeaderNavClass('customers')} onClick={() => navigateTo('customers')}>Customers</button>
          <button type="button" className={getHeaderNavClass('inventory')} onClick={() => navigateTo('inventory')}>Inventory</button>
          <button type="button" className={getHeaderNavClass('shipping')} onClick={() => navigateTo('shipping')}>Shipping</button>
          <button type="button" className={getHeaderNavClass('scheduling')} onClick={() => navigateTo('scheduling')}>Scheduling</button>
          <button type="button" className={getHeaderNavClass('reports')} onClick={() => navigateTo('reports')}>Reports</button>
          <button type="button" className={getHeaderNavClass('accounting')} onClick={() => navigateTo('accounting')}>Accounting / Reports</button>
          {(canWrite || offlineDraftCount > 0) && (
            <button type="button" className={getHeaderNavClass('drafts')} onClick={() => navigateTo('drafts')}>Local Drafts{offlineDraftCount ? ` (${offlineDraftCount})` : ''}</button>
          )}
          <button type="button" className={getHeaderNavClass('settings')} onClick={() => navigateTo('settings')}>Shop Settings</button>
          {canViewBilling && <button type="button" className={getHeaderNavClass('billing')} onClick={() => navigateTo('billing')}>Billing</button>}
          {canAccessOperatorDashboard({ isOperator }) && <button type="button" className={getHeaderNavClass('operator')} onClick={() => navigateTo('operator')}>Operator</button>}
          {session && (
            <FeedbackReporter selectedJob={selectedJob} onNotice={setNotice} />
          )}
          {memberships.length > 1 && (
            <button type="button" onClick={showShopPicker}>Switch Shop</button>
          )}
          {session && (
            <button type="button" onClick={handleSignOut}>Sign Out</button>
          )}
        </div>
      </header>
      {shouldShowIosInstallHelp && (
        <section className="pwa-install-banner no-print">
          <div>
            <strong>Install FretTrack on this device</strong>
            <p>On iPhone or iPad, use Share and then Add to Home Screen for a cleaner bench workflow.</p>
          </div>
          <div className="mode-actions">
            <button type="button" onClick={dismissInstallHelp}>Dismiss</button>
          </div>
        </section>
      )}
      {!isOnline && (
        <section className="offline-banner no-print">
          <strong>Offline</strong>
          <span>Offline draft mode is for new job intake only. Existing job edits, photos, inventory, purchase orders, and receiving require an active connection.</span>
        </section>
      )}
      {session && <SystemAnnouncements />}
      {hasSupabaseConfig && membership && (
        <InternalCurrentAccessPanel
          betaAccess={betaAccess}
          canWrite={canWrite}
          entitlementSnapshot={billingAccess}
          isOperator={isOperator}
          membership={membership}
          permissions={getCurrentAccessPermissions({ ...permissionContext, isOperator })}
          session={session}
        />
      )}
      {hasSupabaseConfig && membership && (
        <BillingStateBanner
          canManageShop={canManageShop}
          entitlementSnapshot={billingAccess}
        />
      )}
      <AppNotice message={notice?.message} type={notice?.type} onDismiss={() => setNotice(null)} />
      <div className={`layout app-layout${['detail', 'guitar-detail', 'amplifier-detail', 'keyboard-detail'].includes(mode) && selectedJob ? ' detail-active' : ''}${isNewJobSidebarCollapsed ? ' sidebar-collapsed' : ''}${['list', 'guitar-detail', 'amplifiers', 'amplifier-detail', 'keyboards', 'keyboard-detail'].includes(mode) ? ' full-content' : ''}`}>
        {!['list', 'guitar-detail', 'amplifiers', 'amplifier-detail', 'keyboards', 'keyboard-detail'].includes(mode) && (
          <NewJobSidebar
            isCollapsed={isNewJobSidebarCollapsed}
            onToggle={toggleNewJobSidebar}
            jobs={jobs}
            customers={customers}
            selectedJobId={selectedJobId}
            shopProfile={shopProfile}
            membership={membership}
            assignableMembers={assignableMembers}
            billingAccess={billingAccess}
            betaApproved={betaApproved}
            canEditJobs={canEditJobs}
            amplifierRepairEnabled={amplifierRepairEnabled}
            keyboardRepairEnabled={keyboardRepairEnabled}
            pendingNewJobCustomer={pendingNewJobCustomer}
            tillSummary={tillSummary}
            moneyOptions={moneyOptions}
            onJobSaved={handleJobSaved}
            onOfflineDraftSaved={handleOfflineDraftSaved}
            onSelectJob={handleSelectJob}
            onOpenCurrentJobs={() => navigateTo('list')}
            onOpenSchedule={() => navigateTo('scheduling')}
            onNotice={setNotice}
          />
        )}
        <div className="content">
          <WorkspaceRouter
            mode={mode}
            data={{
              assignableMembers,
              assignableMembersError,
              assignableMembersLoading,
              betaApproved,
              billingAccess,
              currentJobsAssigneeFilter,
              customers,
              dateOptions,
              isOnline,
              jobs,
              membership,
              moneyOptions,
              offlineDrafts,
              selectedJob,
              selectedOfflineDraftId,
              session,
              shopId: membership?.shopId || getSelectedShop().shopId,
              shopProfile,
              syncingDraftId,
              teamAssignmentEnabled
            }}
            access={{
              canDeletePhotos,
              amplifierRepairEnabled,
              canEditAmplifierRepair,
              keyboardRepairEnabled,
              canEditKeyboardRepair,
              canEditCustomers,
              canEditJobs,
              canEditPhotos,
              canEditScheduling,
              canEditShopSettings,
              canManageInventory,
              canManageShipments,
              canManageTeamMembers,
              canOverwritePhotos,
              canPreviewCustomerImport,
              canSendEmail,
              canScheduleEmail,
              canSendSms,
              canUploadPhotos,
              canViewBilling,
              canWrite,
              entitlementMessage,
              isOperator
            }}
            actions={{
              isNewJobSidebarCollapsed,
              onAssignmentChanged: handleAssignmentChanged,
              onAccountingVoidChange: handleAccountingVoidChange,
              onCloseJobDetail: closeJobDetail,
              onCreateAmplifierJob: handleAmplifierJobCreate,
              onCreateKeyboardJob: handleKeyboardJobCreate,
              onCreateJobForCustomer: showNewJob,
              onCustomerSaved: handleCustomerSaved,
              onDirtyChange: setHasUnsavedPageChanges,
              onDiscardOfflineDraft: handleDiscardOfflineDraft,
              onImageDelete: handleImageDelete,
              onImageUpload: handleImageUpload,
              onNotice: setNotice,
              onOpenCurrentJobsForAssignee: openCurrentJobsForAssignee,
              onOpenInventory: () => navigateTo('inventory'),
              onRefreshJobs: refreshJobs,
              onSelectJob: handleSelectJob,
              onSelectJobMode: selectWorkspaceJob,
              onSelectOfflineDraft: setSelectedOfflineDraftId,
              onShopSettingsSave: (settings) => {
                setShopProfile(settings);
                setShopName(settings.shopName);
              },
              onSyncOfflineDraft: handleSyncOfflineDraft,
              onUpdateJob: handleUpdate
            }}
          />
        </div>
      </div>
    </main>
  );
}
