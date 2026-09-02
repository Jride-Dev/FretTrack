import { useEffect, useState } from 'react';
import AppNotice from '../shared/components/AppNotice.jsx';
import NewJobSidebar from './NewJobSidebar.jsx';
import WorkspaceShellHeader from './WorkspaceShellHeader.jsx';
import { BillingStateBanner, InternalCurrentAccessPanel } from './AppAccessPanels.jsx';
import { getAppAccess } from './appAccess.js';
import {
  getCurrentShopProfileFallback,
  getErrorMessage
} from './appRuntimeHelpers.js';
import WorkspaceRouter from './WorkspaceRouter.jsx';
import useJobWorkspaceActions from './useJobWorkspaceActions.js';
import useJobWorkspaceData from './useJobWorkspaceData.js';
import useOfflineDraftQueue from './useOfflineDraftQueue.js';
import useAppPreferences from './useAppPreferences.js';
import useAssignableMembers from './useAssignableMembers.js';
import useWorkspaceNavigation from './useWorkspaceNavigation.js';
import useSessionShopBootstrap from './useSessionShopBootstrap.js';
import AuthGate from '../modules/auth/AuthGate.jsx';
import BetaOperatorDashboard from '../modules/operator/BetaOperatorDashboard.jsx';
import ShopSettings from '../modules/shops/ShopSettings.jsx';
import SystemAnnouncements from '../modules/system/SystemAnnouncements.jsx';
import { hasSupabaseConfig } from '../shared/lib/supabaseClient';
import {
  canAccessOperatorDashboard,
  getCurrentAccessPermissions
} from '../modules/auth/permissionService';
import { calculateTillSummary } from '../modules/jobs/jobSelectors';
import { getCurrentShopName, getSelectedShop, getShopDateOptions, getShopMoneyOptions, setSelectedShop } from '../modules/shops/shopConfig';
import { clearVitePreloadReloadGuard } from '../shared/pwa/preloadRecovery';
import {
  getDefaultEntitlementSnapshot
} from '../modules/billing/entitlementService';
import { getPlanStatus, getPlanVersionText } from '../modules/billing/planStatus';
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
  const [shopProfileLoadError, setShopProfileLoadError] = useState('');
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
    canManageJobCharges,
    canRecordJobPayments,
    canIssuePaymentAdjustments,
    canFinalizeJobInvoices,
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
  const {
    checkSupabaseConnection,
    handleAuthCompleted,
    handleBootstrapOwner,
    handleShopProfileSaved,
    handleShopSelected,
    handleSignOut,
    loadSessionAccess,
    loadShopAccess,
    showShopPicker
  } = useSessionShopBootstrap({
    accessState: {
      isMembershipLoading,
      newShopName,
      session
    },
    navigation: {
      confirmUnsavedNavigation,
      resetWorkspaceNavigation,
      setHasUnsavedPageChanges,
      setMode,
      setSelectedJobId
    },
    onNotice: setNotice,
    stateSetters: {
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
      setShopProfileLoadError,
      setShowOperatorDashboard,
      setSupabaseStatus
    },
    workspace: {
      refreshCustomers,
      refreshJobs,
      refreshOfflineDraftQueue,
      resetOfflineDraftQueue
    }
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
    if (!notice?.message) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setNotice(null);
    }, 10000);

    return () => window.clearTimeout(timeoutId);
  }, [notice]);

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
        <AuthGate
          initialMode={new URLSearchParams(window.location.search).get('signup') === '1' ? 'sign-up' : 'sign-in'}
          onAuthCompleted={handleAuthCompleted}
          onNotice={setNotice}
        />
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

  if (hasSupabaseConfig && session && isBetaAccessLoading) {
    return (
      <main className="app auth-shell">
        <section className="panel auth-panel">Loading account...</section>
      </main>
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
          <p>{isMembershipLoading ? 'Checking shop membership...' : 'Create your workspace to begin a free 14-day Pro trial. No card is required and the trial does not automatically convert.'}</p>
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
            {isMembershipLoading ? 'Working...' : 'Create Shop and Start Trial'}
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
          {isMembershipLoading || isShopProfileLoading ? (
            <p>Loading shop setup...</p>
          ) : shopProfileLoadError ? (
            <>
              <h1>Workspace Created</h1>
              <p>Your workspace is safe, but FretTrack could not finish loading its shop profile.</p>
              <p className="muted-text">{shopProfileLoadError}</p>
              <button
                type="button"
                className="primary-action"
                onClick={() => loadShopAccess(membership.shopId)}
                disabled={isMembershipLoading}
              >
                {isMembershipLoading ? 'Retrying...' : 'Retry Workspace Load'}
              </button>
            </>
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

  return (
    <main className="app app-shell">
      <WorkspaceShellHeader
        appVersionText={appVersionText}
        canViewBilling={canViewBilling}
        canViewOperator={canAccessOperatorDashboard({ isOperator })}
        canWrite={canWrite}
        handleInstallApp={handleInstallApp}
        handleSignOut={handleSignOut}
        isJobMode={isJobMode}
        isOnline={isOnline}
        isSaving={isSaving}
        memberships={memberships}
        mode={mode}
        navigateTo={navigateTo}
        offlineDraftCount={offlineDraftCount}
        planStatus={planStatus}
        saveCurrentJob={saveCurrentJob}
        selectedJob={selectedJob}
        session={session}
        setNotice={setNotice}
        setTheme={setTheme}
        shopName={shopName}
        shouldShowPwaInstallButton={shouldShowPwaInstallButton}
        showNewJob={showNewJob}
        showShopPicker={showShopPicker}
        statusText={statusText}
        supabaseStatus={supabaseStatus}
        theme={theme}
        themes={themes}
      />
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
      <div className={`layout app-layout${mode === 'new' ? ' new-job-active' : ''}${['detail', 'guitar-detail', 'amplifier-detail', 'keyboard-detail'].includes(mode) && selectedJob ? ' detail-active' : ''}${isNewJobSidebarCollapsed ? ' sidebar-collapsed' : ''}${['list', 'guitar-detail', 'amplifiers', 'amplifier-detail', 'keyboards', 'keyboard-detail'].includes(mode) ? ' full-content' : ''}`}>
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
              canManageJobCharges,
              canRecordJobPayments,
              canIssuePaymentAdjustments,
              canFinalizeJobInvoices,
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
              onOpenNewJob: showNewJob,
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
