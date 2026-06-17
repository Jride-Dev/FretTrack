import { lazy, Suspense, useEffect, useState } from 'react';
import AppNotice from '../shared/components/AppNotice.jsx';
import AuthGate from '../modules/auth/AuthGate.jsx';
import { getCurrentSession, onAuthSessionChange } from '../modules/auth/authService';
import { hasSupabaseConfig } from '../shared/lib/supabaseClient';

const AuthenticatedApp = lazy(() => import('./App.jsx'));

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
    if (!hasSupabaseConfig) {
      setIsLoadingSession(false);
      return undefined;
    }

    let isMounted = true;
    getCurrentSession()
      .then((currentSession) => {
        if (!isMounted) {
          return;
        }
        setSession(currentSession);
        setIsLoadingSession(false);
      })
      .catch((error) => {
        console.error('Session bootstrap failed.', error);
        if (isMounted) {
          setIsLoadingSession(false);
          setNotice({ type: 'error', message: 'Unable to load sign-in session.' });
        }
      });

    const unsubscribe = onAuthSessionChange((nextSession, event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true);
      }
      setSession(nextSession);
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  if (isLoadingSession) {
    return <LoadingScreen />;
  }

  if (hasSupabaseConfig && isPasswordRecovery) {
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

  if (hasSupabaseConfig && !session) {
    return (
      <>
        <AuthGate onAuthCompleted={setSession} onNotice={setNotice} />
        <AppNotice message={notice?.message} type={notice?.type} onDismiss={() => setNotice(null)} />
      </>
    );
  }

  return (
    <Suspense fallback={<LoadingScreen message="Opening shop workspace..." />}>
      <AuthenticatedApp />
    </Suspense>
  );
}
