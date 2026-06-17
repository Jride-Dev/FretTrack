import { Fragment, lazy, Suspense, useEffect, useState } from 'react';
import AppNotice from '../shared/components/AppNotice.jsx';
import AuthGate from '../modules/auth/AuthGate.jsx';
import { getCurrentSession, onAuthSessionChange } from '../modules/auth/authService';
import { hasSupabaseConfig } from '../shared/lib/supabaseClient';
import LegacyDebugPanel from '../shared/legacy/LegacyDebugPanel.jsx';
import { getErrorMessage, logLegacyDebug } from '../shared/legacy/legacyDebug';

const AuthenticatedApp = lazy(() => import('./App.jsx'));
const SESSION_CHECK_TIMEOUT_MS = 5000;

function LoadingScreen({ message = 'Loading FretTrack...' }) {
  return (
    <main className="app auth-shell">
      <section className="panel auth-panel">{message}</section>
    </main>
  );
}

export default function AppBootstrap() {
  const [session, setSession] = useState(null);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const [isLoadingSession, setIsLoadingSession] = useState(hasSupabaseConfig);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    logLegacyDebug('app bootstrap started');

    if (!hasSupabaseConfig) {
      logLegacyDebug('session check skipped', 'Supabase config is not present.');
      setIsLoadingSession(false);
      return undefined;
    }

    let isMounted = true;
    let didSessionCheckTimeout = false;
    let unsubscribe = () => {};

    logLegacyDebug('session check started');
    const sessionTimeoutId = window.setTimeout(() => {
      didSessionCheckTimeout = true;
      logLegacyDebug('session check timeout', `${SESSION_CHECK_TIMEOUT_MS}ms elapsed; showing login form.`);
      if (isMounted) {
        setIsLoadingSession(false);
        setNotice({
          type: 'warning',
          message: 'Session check is taking longer than expected. You can still try signing in.'
        });
      }
    }, SESSION_CHECK_TIMEOUT_MS);

    getCurrentSession()
      .then((currentSession) => {
        window.clearTimeout(sessionTimeoutId);
        logLegacyDebug('session check success', currentSession ? 'Existing session found.' : 'No existing session.');
        if (!isMounted) {
          return;
        }
        setSession(currentSession);
        if (!didSessionCheckTimeout) {
          setIsLoadingSession(false);
        }
      })
      .catch((error) => {
        window.clearTimeout(sessionTimeoutId);
        console.error('Session bootstrap failed.', error);
        logLegacyDebug('session check failure', getErrorMessage(error));
        if (isMounted) {
          setIsLoadingSession(false);
          setNotice({ type: 'error', message: 'Unable to load sign-in session.' });
        }
      });

    try {
      logLegacyDebug('auth state subscription started');
      unsubscribe = onAuthSessionChange((nextSession, event) => {
        logLegacyDebug('auth state event', event || 'unknown');
        if (event === 'PASSWORD_RECOVERY') {
          setIsPasswordRecovery(true);
        }
        setSession(nextSession);
      });
      logLegacyDebug('auth state subscription success');
    } catch (error) {
      console.error('Auth state subscription failed.', error);
      logLegacyDebug('auth state subscription failure', getErrorMessage(error));
      setNotice({ type: 'error', message: getErrorMessage(error, 'Unable to subscribe to auth changes.') });
    }

    return () => {
      isMounted = false;
      window.clearTimeout(sessionTimeoutId);
      unsubscribe();
    };
  }, []);

  let content;

  if (isLoadingSession) {
    content = <LoadingScreen />;
  } else if (hasSupabaseConfig && isPasswordRecovery) {
    content = (
      <Fragment>
        <AuthGate
          initialMode="update-password"
          onPasswordUpdated={() => setIsPasswordRecovery(false)}
          onNotice={setNotice}
        />
        <AppNotice message={notice?.message} type={notice?.type} onDismiss={() => setNotice(null)} />
      </Fragment>
    );
  } else if (hasSupabaseConfig && !session) {
    content = (
      <Fragment>
        <AuthGate onAuthCompleted={setSession} onNotice={setNotice} />
        <AppNotice message={notice?.message} type={notice?.type} onDismiss={() => setNotice(null)} />
      </Fragment>
    );
  } else {
    content = (
      <Suspense fallback={<LoadingScreen message="Opening shop workspace..." />}>
        <AuthenticatedApp />
      </Suspense>
    );
  }

  return (
    <>
      {content}
      <LegacyDebugPanel />
    </>
  );
}
