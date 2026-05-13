import { useState } from 'react';
import { signInWithPassword, signUpWithPassword } from './authService';

export default function AuthGate({ onNotice }) {
  const [mode, setMode] = useState('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setIsSubmitting(true);
    onNotice?.(null);

    try {
      if (mode === 'sign-up') {
        const session = await signUpWithPassword({ email, password });
        onNotice?.({
          type: 'success',
          message: session ? 'Account created.' : 'Check your email to confirm your account, then sign in.'
        });
      } else {
        await signInWithPassword({ email, password });
        onNotice?.({ type: 'success', message: 'Signed in.' });
      }
    } catch (error) {
      onNotice?.({
        type: 'error',
        message: error instanceof Error ? error.message : 'Authentication failed.'
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="app auth-shell">
      <section className="panel auth-panel">
        <h1>FretTrack</h1>
        <p>Sign in to access shop work orders and customer records.</p>

        <form onSubmit={handleSubmit}>
          <label>
            Email
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>

          <label>
            Password
            <input
              type="password"
              autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={6}
              required
            />
          </label>

          <button type="submit" className="primary-action" disabled={isSubmitting}>
            {isSubmitting ? 'Please wait...' : mode === 'sign-up' ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        <button
          type="button"
          className="button-tertiary auth-mode-toggle"
          onClick={() => setMode((currentMode) => (currentMode === 'sign-in' ? 'sign-up' : 'sign-in'))}
        >
          {mode === 'sign-in' ? 'Create a shop user account' : 'Already have an account? Sign in'}
        </button>
      </section>
    </main>
  );
}
