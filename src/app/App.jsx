import { Fragment, useEffect, useRef, useState } from 'react';
import AppNotice from '../shared/components/AppNotice.jsx';
import AuthGate from '../modules/auth/AuthGate.jsx';
import AccountingReports from '../modules/accounting/AccountingReports.jsx';
import BillingPage from '../modules/billing/BillingPage.jsx';
import { CustomerManager, getCustomers } from '../modules/customers';
import JobDetail from '../modules/jobs/JobDetail.jsx';
import JobForm from '../modules/jobs/JobForm.jsx';
import JobList from '../modules/jobs/JobList.jsx';
import BetaOperatorDashboard from '../modules/operator/BetaOperatorDashboard.jsx';
import ShopSettings from '../modules/shops/ShopSettings.jsx';
import FeedbackReporter from '../modules/system/FeedbackReporter.jsx';
import SystemAnnouncements from '../modules/system/SystemAnnouncements.jsx';
import { checkSupabaseJobsConnection, hasSupabaseConfig } from '../shared/lib/supabaseClient';
import { getCurrentSession, onAuthSessionChange, signOut } from '../modules/auth/authService';
import { getJobs, updateJob } from '../modules/jobs/jobService';
import { deleteJobImage, uploadJobImages } from '../modules/photos/photoService';
import { calculateTillSummary, sortNewestFirst } from '../modules/jobs/jobSelectors';
import { clearSelectedShop, getCurrentShopName, getSelectedShop, getShopDateOptions, getShopMoneyOptions, setSelectedShop } from '../modules/shops/shopConfig';
import { bootstrapCurrentUserAsOwner, getCurrentUserShopMemberships } from '../modules/shops/shopMembershipService';
import { getCurrentShopProfile } from '../modules/shops/shopProfileService';
import { money } from '../shared/utils/money';
import { defaultTheme, themes, THEME_STORAGE_KEY } from '../shared/theme/themes';
import {
  getBillingStatusLabel,
  getDefaultEntitlementSnapshot,
  getEffectiveStatus,
  getShopEntitlementSnapshot,
  isGraceStatus,
  isReadOnlyStatus
} from '../modules/billing/entitlementService';
import { getOrCreateBetaAccessRequest } from '../modules/beta/betaAccessService';
import { isCurrentOperator } from '../modules/operator/operatorService';
import { isIosInstallCandidate, isStandaloneDisplayMode } from '../shared/pwa/pwaSupport';

const APP_VERSION = '0.2.6-beta.13';
const APP_NAME = 'FretTrack Systems';
const APP_TAGLINE = 'Modern workflow for guitar repair';
const WORKSPACE_STATE_PREFIX = 'frettrack_workspace_state';
const PWA_INSTALL_HELP_DISMISSED_KEY = 'frettrack_pwa_install_help_dismissed';

export default function App() {
  const [jobs, setJobs] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [mode, setMode] = useState('new');
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
  const [theme, setTheme] = useState(() => {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    return themes.some((themeOption) => themeOption.value === savedTheme) ? savedTheme : defaultTheme;
  });
  const [shopName, setShopName] = useState(() => getCurrentShopName());
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState(null);
  const [isStandalonePwa, setIsStandalonePwa] = useState(() => isStandaloneDisplayMode());
  const [showInstallHelp, setShowInstallHelp] = useState(() => localStorage.getItem(PWA_INSTALL_HELP_DISMISSED_KEY) !== 'true');
  const manualSignOutRef = useRef(false);

  async function refreshJobs() {
    const loadedJobs = await getJobs();
    const sortedJobs = sortNewestFirst(loadedJobs);
    setJobs(sortedJobs);
    return sortedJobs;
  }

  async function refreshCustomers(sourceJobs = jobs) {
    const loadedCustomers = await getCustomers(sourceJobs);
    setCustomers(loadedCustomers);
    return loadedCustomers;
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
          setSelectedJobId(null);
          setMode('new');
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
      setSelectedJobId(null);
      setMode('new');
      setSupabaseStatus('auth-required');
      clearSelectedShop();
    } catch (error) {
      console.error('Beta access check failed.', error);
      setIsOperator(false);
      setBetaAccess({ status: 'pending' });
      setNotice({
        type: 'error',
        message: getErrorMessage(error, 'Unable to check beta access.')
      });
    } finally {
      setIsOperatorLoading(false);
      setIsBetaAccessLoading(false);
    }
  }

  useEffect(() => {
    if (!membership?.shopId || !jobs.length || selectedJobId) {
      return;
    }

    const workspaceState = getStoredWorkspaceState(membership.shopId);
    if (workspaceState.mode === 'detail' && jobs.some((job) => job.id === workspaceState.selectedJobId)) {
      setSelectedJobId(workspaceState.selectedJobId);
      setMode('detail');
    } else if (workspaceState.mode && workspaceState.mode !== 'detail') {
      setMode(workspaceState.mode);
    }
  }, [membership?.shopId, jobs, selectedJobId]);

  useEffect(() => {
    if (!membership?.shopId) {
      return;
    }

    saveWorkspaceState(membership.shopId, {
      mode,
      selectedJobId
    });
  }, [membership?.shopId, mode, selectedJobId]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(display-mode: standalone)');

    function handleBeforeInstallPrompt(event) {
      event.preventDefault();
      setDeferredInstallPrompt(event);
    }

    function handleInstalled() {
      setDeferredInstallPrompt(null);
      setIsStandalonePwa(true);
      setNotice({ type: 'success', message: 'FretTrack was installed on this device.' });
    }

    function syncStandaloneState() {
      setIsStandalonePwa(isStandaloneDisplayMode());
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);
    mediaQuery.addEventListener?.('change', syncStandaloneState);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
      mediaQuery.removeEventListener?.('change', syncStandaloneState);
    };
  }, []);

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

  async function loadShopAccess(preferredShopId = getSelectedShop().shopId) {
    setIsMembershipLoading(true);
    try {
      const availableMemberships = await getCurrentUserShopMemberships();
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
      setEntitlementSnapshot(currentEntitlements);
      setIsShopProfileLoading(true);
      const currentShopProfile = await getCurrentShopProfile(currentMembership.shopId);
      setShopProfile(currentShopProfile);
      if (currentShopProfile?.shopName) {
        setShopName(currentShopProfile.shopName);
      }
      setIsShopProfileLoading(false);
      if (!currentShopProfile) {
        setSupabaseStatus('connected');
        return;
      }

      const loadedJobs = await refreshJobs();
      await refreshCustomers(loadedJobs);
      await checkSupabaseConnection();
    } catch (error) {
      console.error('Shop membership load failed.', error);
      setSupabaseStatus('error');
      setNotice({
        type: 'error',
        message: getErrorMessage(error, 'Unable to load shop membership.')
      });
    } finally {
      setIsShopProfileLoading(false);
      setIsMembershipLoading(false);
    }
  }

  async function handleBootstrapOwner() {
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
      setNotice({ type: 'error', message: 'An operator must approve your beta access before you can create a shop.' });
      return;
    }

    setIsMembershipLoading(true);
    setNotice(null);
    try {
      const ownerMembership = await bootstrapCurrentUserAsOwner(shopId);
      const ownerShop = { ...ownerMembership, shopName: shopNameValue };
      setSelectedShop(ownerShop);
      setMembership(ownerShop);
      setMemberships([ownerShop]);
      setEntitlementSnapshot(getDefaultEntitlementSnapshot(ownerShop.shopId));
      setShopName(shopNameValue);
      setNewShopName('');
      await checkSupabaseConnection();
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
    manualSignOutRef.current = true;
    setJobs([]);
    setCustomers([]);
    setSelectedJobId(null);
    setMembership(null);
    setMemberships([]);
    setShopProfile(null);
    setIsOperator(false);
    setBetaAccess(null);
    setIsBetaAccessLoading(false);
    setShowOperatorDashboard(false);
    setEntitlementSnapshot(getDefaultEntitlementSnapshot());
    setMode('new');
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

  async function saveCurrentJob() {
    if (!canWrite) {
      setNotice({ type: 'error', message: 'Your shop role is read-only.' });
      return;
    }

    if (selectedJob && mode === 'detail') {
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

  function handleSelectJob(jobId) {
    setSelectedJobId(jobId);
    setMode('detail');
  }

  async function handleUpdate(job) {
    if (!canWrite) {
      setNotice({ type: 'error', message: 'Your shop role is read-only.' });
      return job;
    }

    setJobs((current) => current.map((item) => (item.id === job.id ? job : item)));
    const savedJob = await updateJob(job);
    const loadedJobs = await refreshJobs();
    await refreshCustomers(loadedJobs);
    setSelectedJobId(savedJob.id);
    return savedJob;
  }

  async function handleImageUpload(job, files, options = {}) {
    if (!canWrite) {
      setNotice({ type: 'error', message: 'Your shop role is read-only.' });
      return { job, errors: [{ fileName: 'Upload', message: 'Your shop role is read-only.' }] };
    }
    if (!canUploadPhotos) {
      const message = entitlementMessage || 'Photo uploads are unavailable for this shop plan or billing state.';
      setNotice({ type: 'error', message });
      return { job, errors: [{ fileName: 'Upload', message }] };
    }

    const { skipRefresh = false, ...uploadOptions } = options;
    const result = await uploadJobImages(job, files, { category: 'job', ...uploadOptions });
    if (result.job && !skipRefresh) {
      await refreshJobs();
      setSelectedJobId(result.job.id);
    }

    return result;
  }

  async function handleImageDelete(job, image) {
    if (!canWrite) {
      setNotice({ type: 'error', message: 'Your shop role is read-only.' });
      return;
    }

    const savedJob = await deleteJobImage(job, image);
    if (savedJob) {
      await refreshJobs();
      setSelectedJobId(savedJob.id);
    }
  }

  function showNewJob(customer = null) {
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
    setJobs([]);
    setCustomers([]);
    setSelectedJobId(null);
    setShopProfile(null);
    setMembership(null);
    setShowOperatorDashboard(false);
    setEntitlementSnapshot(getDefaultEntitlementSnapshot());
    clearSelectedShop();
  }

  const selectedJob = jobs.find((job) => job.id === selectedJobId);
  const billingAccess = entitlementSnapshot || getDefaultEntitlementSnapshot(membership?.shopId);
  const isBillingReadOnly = hasSupabaseConfig && isReadOnlyStatus(billingAccess);
  const canWrite = (!hasSupabaseConfig || ['owner', 'admin', 'tech'].includes(membership?.role)) && !isBillingReadOnly;
  const canManageShop = !hasSupabaseConfig || ['owner', 'admin'].includes(membership?.role);
  const canUploadPhotos = canWrite && billingAccess.access?.canUploadPhotos !== false;
  const canSendEmail = canWrite && billingAccess.access?.canSendEmail !== false;
  const canSendSms = canWrite && billingAccess.access?.canSendSms === true;
  const entitlementMessage = getEntitlementMessage(billingAccess);
  const tillSummary = calculateTillSummary(jobs);
  const moneyOptions = getShopMoneyOptions(shopProfile || undefined);
  const dateOptions = getShopDateOptions(shopProfile || undefined);
  const shouldShowPwaInstallButton = Boolean(deferredInstallPrompt) && !isStandalonePwa;
  const shouldShowIosInstallHelp = !isStandalonePwa && showInstallHelp && isIosInstallCandidate();
  const statusText = {
    checking: 'Supabase Checking',
    connected: 'Supabase Connected',
    'not-configured': 'Supabase Not Configured',
    'auth-required': 'Supabase Auth Required',
    error: 'Supabase Error'
  }[supabaseStatus];

  async function handleInstallApp() {
    if (!deferredInstallPrompt) {
      return;
    }

    deferredInstallPrompt.prompt();
    const choice = await deferredInstallPrompt.userChoice.catch(() => null);
    if (choice?.outcome === 'accepted') {
      setNotice({ type: 'success', message: 'Install prompt accepted. FretTrack will finish installing if the browser allows it.' });
    }
    setDeferredInstallPrompt(null);
  }

  function dismissInstallHelp() {
    localStorage.setItem(PWA_INSTALL_HELP_DISMISSED_KEY, 'true');
    setShowInstallHelp(false);
  }

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
        <AuthGate onNotice={setNotice} />
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
        <section className="panel auth-panel">Checking beta access...</section>
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
                className="shop-picker-button"
                onClick={() => handleShopSelected(shopMembership)}
              >
                <strong>{shopMembership.shopName || shopMembership.shopId}</strong>
                <span>{shopMembership.role}</span>
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
          <BetaOperatorDashboard onNotice={setNotice} />
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
              canManageShop={canManageShop}
              currentUserId={session?.user?.id || ''}
              initialSettings={{ ...getCurrentShopProfileFallback(), shopId: membership.shopId }}
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

  return (
    <main className="app app-shell">
      <header>
        <div className="brand-header">
          <img src="/frettrack-emblem.png" alt="" aria-hidden="true" />
          <div className="brand-copy">
            <h1>{APP_NAME}</h1>
            <small>{APP_TAGLINE}</small>
            <strong>{shopName}</strong>
            <span className="app-version">Version {APP_VERSION}</span>
          </div>
        </div>
        <div className="mode-actions no-print header-actions">
          <span className={`connection-status ${supabaseStatus}`} title={statusText}>
            <span className="plug-status" aria-hidden="true">
              <i className="plug-head" />
              <i className="plug-cord" />
              <i className="plug-socket" />
            </span>
            Database
          </span>
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
          <button type="button" className="primary-action" onClick={saveCurrentJob} disabled={isSaving || !canWrite}>
            {isSaving ? 'Saving...' : 'Save Job'}
          </button>
          <button type="button" onClick={showNewJob}>New Job</button>
          <button type="button" onClick={() => setMode('list')}>Current Jobs</button>
          <button type="button" onClick={() => setMode('customers')}>Customers</button>
          <button type="button" onClick={() => setMode('accounting')}>Accounting / Reports</button>
          <button type="button" onClick={() => setMode('settings')}>Shop Settings</button>
          {canManageShop && <button type="button" onClick={() => setMode('billing')}>Billing</button>}
          {isOperator && <button type="button" onClick={() => setMode('operator')}>Operator</button>}
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
      {session && <SystemAnnouncements />}
      {hasSupabaseConfig && membership && (
        <BillingStateBanner
          canManageShop={canManageShop}
          entitlementSnapshot={billingAccess}
        />
      )}
      <AppNotice message={notice?.message} type={notice?.type} onDismiss={() => setNotice(null)} />
      <div className={`layout app-layout${mode === 'detail' && selectedJob ? ' detail-active' : ''}`}>
        <aside className="no-print">
          <JobForm
            jobs={jobs}
            customers={customers}
            canWrite={canWrite}
            shopProfile={shopProfile}
            initialCustomer={pendingNewJobCustomer}
            onJobSaved={handleJobSaved}
            onNotice={setNotice}
          />
          <JobList jobs={jobs} selectedJobId={selectedJobId} onSelectJob={handleSelectJob} />
          <section className="panel till-summary">
            <h2>Till Summary</h2>
            <div className="totals">
              <span>Paid In</span>
              <strong>{money(tillSummary.paidTotal, moneyOptions)}</strong>
              <span>{shopProfile?.taxLabel || 'Sales Tax'}</span>
              <strong>{money(tillSummary.salesTaxAccrued, moneyOptions)}</strong>
              <span>Open Balance</span>
              <strong>{money(tillSummary.openBalance, moneyOptions)}</strong>
              {Object.entries(tillSummary.byMethod).map(([method, amount]) => (
                <Fragment key={method}>
                  <span>{method}</span>
                  <strong>{money(amount, moneyOptions)}</strong>
                </Fragment>
              ))}
            </div>
          </section>
        </aside>
        <div className="content">
          {mode === 'new' && (
            <section className="panel empty-state">
              Enter a new job on the left, then click Save Job.
            </section>
          )}

          {mode === 'list' && (
            <section className="panel empty-state">
              <h2>Current Jobs</h2>
              <p>Select an open job from the list to open it.</p>
            </section>
          )}

          {mode === 'settings' && (
            <ShopSettings
              canManageShop={canManageShop}
              currentUserId={session?.user?.id || ''}
              initialSettings={shopProfile}
              onSave={(settings) => {
                setShopProfile(settings);
                setShopName(settings.shopName);
              }}
              onNotice={setNotice}
            />
          )}

          {mode === 'customers' && (
            <CustomerManager
              customers={customers}
              jobs={jobs}
              canWrite={canWrite}
              dateOptions={dateOptions}
              moneyOptions={moneyOptions}
              onCustomerSaved={handleCustomerSaved}
              onCreateJobForCustomer={showNewJob}
              onNotice={setNotice}
            />
          )}

          {mode === 'accounting' && (
            <AccountingReports jobs={jobs} shopId={membership?.shopId || getSelectedShop().shopId} shopProfile={shopProfile} />
          )}

          {mode === 'billing' && (
            <BillingPage
              canManageShop={canManageShop}
              entitlementSnapshot={billingAccess}
              shopProfile={shopProfile}
            />
          )}

          {mode === 'operator' && (
            <BetaOperatorDashboard onNotice={setNotice} />
          )}

          {mode === 'detail' && selectedJob && (
            <JobDetail
              job={selectedJob}
              jobs={jobs}
              onUpdate={handleUpdate}
              onImageUpload={handleImageUpload}
              onImageDelete={handleImageDelete}
              onRefresh={refreshJobs}
              onClose={showNewJob}
              canWrite={canWrite}
              canSendEmail={canSendEmail}
              canSendSms={canSendSms}
              entitlementMessage={entitlementMessage}
            />
          )}

          {mode === 'detail' && !selectedJob && (
            <section className="panel empty-state">Select a saved job from the list.</section>
          )}
        </div>
      </div>
    </main>
  );
}

function getWorkspaceStateKey(shopId) {
  return `${WORKSPACE_STATE_PREFIX}:${shopId || 'unknown'}`;
}

function getStoredWorkspaceState(shopId) {
  try {
    return JSON.parse(localStorage.getItem(getWorkspaceStateKey(shopId))) || {};
  } catch {
    return {};
  }
}

function saveWorkspaceState(shopId, state) {
  try {
    localStorage.setItem(getWorkspaceStateKey(shopId), JSON.stringify(state));
  } catch {
    // Non-critical: workspace restore should never block normal app use.
  }
}

function getCurrentShopProfileFallback() {
  const shopName = getCurrentShopName();
  const looksUnitedKingdom = /\b(norwich|united kingdom|uk|england|gb|great britain)\b/i.test(shopName);
  return {
    shopId: '',
    shopName,
    phone: '',
    email: '',
    address: '',
    logoUrl: '',
    logoStoragePath: '',
    printFooterText: '',
    currencyCode: looksUnitedKingdom ? 'GBP' : 'USD',
    locale: looksUnitedKingdom ? 'en-GB' : 'en-US',
    taxLabel: looksUnitedKingdom ? 'VAT' : 'Sales Tax',
    taxRegistrationNumber: '',
    dateFormat: looksUnitedKingdom ? 'DD/MM/YYYY' : 'MM/DD/YYYY',
    measurementSystem: looksUnitedKingdom ? 'metric' : 'imperial',
    lengthUnit: looksUnitedKingdom ? 'mm' : 'in',
    taxState: '',
    salesTaxRate: '',
    taxablePartsDefault: true,
    taxableServicesDefault: false
  };
}

function resolveMembership(availableMemberships = [], preferredShopId = '') {
  if (!availableMemberships.length) {
    return null;
  }

  if (preferredShopId) {
    const preferredMembership = availableMemberships.find((item) => item.shopId === preferredShopId);
    if (preferredMembership) {
      return preferredMembership;
    }
  }

  if (availableMemberships.length === 1) {
    return availableMemberships[0];
  }

  return null;
}

function slugifyShopId(shopName) {
  return String(shopName || '')
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64);
}

function PendingApprovalScreen({ betaAccess, email, onRetry, onSignOut }) {
  const isRejected = betaAccess?.status === 'rejected';
  const message = isRejected
    ? 'Your FretTrack beta access request is not active. Contact support if you believe this is a mistake.'
    : 'Your FretTrack beta access request has been received. An operator must approve your account before you can create or access a shop workspace.';

  return (
    <main className="app auth-shell">
      <section className="panel auth-panel">
        <h1>{isRejected ? 'Beta Access Not Active' : 'Pending Approval'}</h1>
        <p>{message}</p>
        <p className="muted-text">{email || betaAccess?.email}</p>
        <div className="mode-actions">
          <button type="button" className="primary-action" onClick={onRetry}>
            Retry Access Check
          </button>
          <button type="button" className="button-tertiary" onClick={onSignOut}>
            Sign Out
          </button>
        </div>
      </section>
    </main>
  );
}

function BillingStateBanner({ canManageShop, entitlementSnapshot }) {
  if (!entitlementSnapshot) {
    return null;
  }

  const status = getEffectiveStatus(entitlementSnapshot);
  if (!isGraceStatus(entitlementSnapshot) && !isReadOnlyStatus(entitlementSnapshot)) {
    return null;
  }

  const isReadOnly = isReadOnlyStatus(entitlementSnapshot);
  const actionText = canManageShop
    ? 'Open Billing to review plan details or contact support.'
    : 'Ask a shop owner or admin to review billing.';
  const message = isReadOnly
    ? `This shop is ${getBillingStatusLabel(status).toLowerCase()}. Existing jobs and customers remain viewable, but new work, uploads, and customer messages are paused. ${actionText}`
    : `This shop is in a billing grace period. Normal work is still available for now. ${actionText}`;

  return (
    <section className={`billing-state-banner ${isReadOnly ? 'read-only' : 'grace'}`}>
      <strong>{isReadOnly ? 'Read-only access' : 'Grace period'}</strong>
      <span>{message}</span>
    </section>
  );
}

function getEntitlementMessage(entitlementSnapshot) {
  if (isReadOnlyStatus(entitlementSnapshot)) {
    return 'This shop is read-only. Viewing, printing, and exports remain available, but new writes and customer messages are paused.';
  }

  const status = getEffectiveStatus(entitlementSnapshot);
  if (status === 'grace') {
    return '';
  }

  return '';
}

function getErrorMessage(error, fallback) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message || fallback);
  }

  return fallback;
}
