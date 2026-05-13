import { Fragment, useEffect, useState } from 'react';
import AppNotice from '../shared/components/AppNotice.jsx';
import AuthGate from '../modules/auth/AuthGate.jsx';
import JobDetail from '../modules/jobs/JobDetail.jsx';
import JobForm from '../modules/jobs/JobForm.jsx';
import JobList from '../modules/jobs/JobList.jsx';
import ShopSettings from '../modules/shops/ShopSettings.jsx';
import { checkSupabaseJobsConnection, hasSupabaseConfig } from '../shared/lib/supabaseClient';
import { getCurrentSession, onAuthSessionChange, signOut } from '../modules/auth/authService';
import { getJobs, updateJob } from '../modules/jobs/jobService';
import { deleteJobImage, uploadJobImages } from '../modules/photos/photoService';
import { calculateTillSummary, sortNewestFirst } from '../modules/jobs/jobSelectors';
import { getCurrentShopName } from '../modules/shops/shopConfig';
import { bootstrapCurrentUserAsOwner, getCurrentShopMembership } from '../modules/shops/shopMembershipService';
import { money } from '../shared/utils/money';
import { defaultTheme, themes, THEME_STORAGE_KEY } from '../shared/theme/themes';

const APP_VERSION = '0.2.5';
const APP_NAME = 'FretTrack Systems';
const APP_TAGLINE = 'Modern workflow for guitar repair';

export default function App() {
  const [jobs, setJobs] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [mode, setMode] = useState('new');
  const [supabaseStatus, setSupabaseStatus] = useState(hasSupabaseConfig ? 'checking' : 'not-configured');
  const [session, setSession] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(hasSupabaseConfig);
  const [membership, setMembership] = useState(null);
  const [isMembershipLoading, setIsMembershipLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState(null);
  const [theme, setTheme] = useState(() => {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    return themes.some((themeOption) => themeOption.value === savedTheme) ? savedTheme : defaultTheme;
  });
  const [shopName, setShopName] = useState(() => getCurrentShopName());

  async function refreshJobs() {
    const loadedJobs = await getJobs();
    const sortedJobs = sortNewestFirst(loadedJobs);
    setJobs(sortedJobs);
    return sortedJobs;
  }

  useEffect(() => {
    if (!hasSupabaseConfig) {
      refreshJobs();
      checkSupabaseConnection();
      return undefined;
    }

    let isMounted = true;
    getCurrentSession()
      .then((currentSession) => {
        if (isMounted) {
          setSession(currentSession);
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

    const unsubscribe = onAuthSessionChange((nextSession) => {
      setSession(nextSession);
      setMembership(null);
      setJobs([]);
      setSelectedJobId(null);
      setMode('new');
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!hasSupabaseConfig || !session) {
      return;
    }

    loadMembershipAndJobs();
  }, [session]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

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

  async function loadMembershipAndJobs() {
    setIsMembershipLoading(true);
    try {
      const currentMembership = await getCurrentShopMembership();
      setMembership(currentMembership);
      if (!currentMembership) {
        setSupabaseStatus('auth-required');
        return;
      }

      await refreshJobs();
      await checkSupabaseConnection();
    } catch (error) {
      console.error('Shop membership load failed.', error);
      setSupabaseStatus('error');
      setNotice({
        type: 'error',
        message: getErrorMessage(error, 'Unable to load shop membership.')
      });
    } finally {
      setIsMembershipLoading(false);
    }
  }

  async function handleBootstrapOwner() {
    setIsMembershipLoading(true);
    setNotice(null);
    try {
      const ownerMembership = await bootstrapCurrentUserAsOwner();
      setMembership(ownerMembership);
      await refreshJobs();
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
    try {
      await signOut();
      setNotice(null);
    } catch (error) {
      setNotice({
        type: 'error',
        message: getErrorMessage(error, 'Sign out failed.')
      });
    }
  }

  async function saveCurrentJob() {
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
    await refreshJobs();
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
    setJobs((current) => current.map((item) => (item.id === job.id ? job : item)));
    const savedJob = await updateJob(job);
    setJobs((current) => current.map((item) => (item.id === savedJob.id ? savedJob : item)));
    setSelectedJobId(savedJob.id);
    return savedJob;
  }

  async function handleImageUpload(job, files, options = {}) {
    const { skipRefresh = false, ...uploadOptions } = options;
    const result = await uploadJobImages(job, files, { category: 'job', ...uploadOptions });
    if (result.job && !skipRefresh) {
      await refreshJobs();
      setSelectedJobId(result.job.id);
    }

    return result;
  }

  async function handleImageDelete(job, image) {
    const savedJob = await deleteJobImage(job, image);
    if (savedJob) {
      await refreshJobs();
      setSelectedJobId(savedJob.id);
    }
  }

  function showNewJob() {
    setSelectedJobId(null);
    setMode('new');
  }

  const selectedJob = jobs.find((job) => job.id === selectedJobId);
  const tillSummary = calculateTillSummary(jobs);
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
        <AuthGate onNotice={setNotice} />
        <AppNotice message={notice?.message} type={notice?.type} onDismiss={() => setNotice(null)} />
      </>
    );
  }

  if (hasSupabaseConfig && session && !membership) {
    return (
      <main className="app auth-shell">
        <AppNotice message={notice?.message} type={notice?.type} onDismiss={() => setNotice(null)} />
        <section className="panel auth-panel">
          <h1>Shop Access Required</h1>
          <p>{isMembershipLoading ? 'Checking shop membership...' : 'Your account is signed in, but it is not connected to this FretTrack shop yet.'}</p>
          <p className="muted-text">{session.user?.email}</p>
          <button type="button" className="primary-action" onClick={handleBootstrapOwner} disabled={isMembershipLoading}>
            {isMembershipLoading ? 'Working...' : 'Create First Shop Owner'}
          </button>
          <button type="button" className="button-tertiary" onClick={loadMembershipAndJobs} disabled={isMembershipLoading}>
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
        <div className="mode-actions no-print">
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
          <button type="button" className="primary-action" onClick={saveCurrentJob} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Job'}
          </button>
          <button type="button" onClick={showNewJob}>New Job</button>
          <button type="button" onClick={() => setMode('list')}>Current Jobs</button>
          <button type="button" onClick={() => setMode('settings')}>Shop Settings</button>
          {session && (
            <button type="button" onClick={handleSignOut}>Sign Out</button>
          )}
        </div>
      </header>
      <AppNotice message={notice?.message} type={notice?.type} onDismiss={() => setNotice(null)} />
      <div className="layout app-layout">
        <aside className="no-print">
          <JobForm jobs={jobs} onJobSaved={handleJobSaved} onNotice={setNotice} />
          <JobList jobs={jobs} selectedJobId={selectedJobId} onSelectJob={handleSelectJob} />
          <section className="panel till-summary">
            <h2>Till Summary</h2>
            <div className="totals">
              <span>Paid In</span>
              <strong>{money(tillSummary.paidTotal)}</strong>
              <span>Sales Tax</span>
              <strong>{money(tillSummary.salesTaxAccrued)}</strong>
              <span>Open Balance</span>
              <strong>{money(tillSummary.openBalance)}</strong>
              {Object.entries(tillSummary.byMethod).map(([method, amount]) => (
                <Fragment key={method}>
                  <span>{method}</span>
                  <strong>{money(amount)}</strong>
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
            <ShopSettings onSave={(settings) => setShopName(settings.shopName)} onNotice={setNotice} />
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

function getErrorMessage(error, fallback) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message || fallback);
  }

  return fallback;
}
