import { useState } from 'react';
import {
  resendSignupConfirmation,
  sendPasswordResetEmail,
  signInWithPassword,
  signUpWithPassword,
  updateCurrentUserPassword
} from './authService';
import { getErrorMessage, logLegacyDebug } from '../../shared/legacy/legacyDebug';

const AUTH_REQUEST_TIMEOUT_MS = 20000;

export default function AuthGate({ initialMode = 'sign-in', onAuthCompleted, onPasswordUpdated, onNotice }) {
  const [mode, setMode] = useState(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResendingConfirmation, setIsResendingConfirmation] = useState(false);
  const [inlineError, setInlineError] = useState('');

  function switchMode(nextMode) {
    setMode(nextMode);
    setPassword('');
    setConfirmPassword('');
    setInlineError('');
  }

  async function handleResendConfirmation() {
    setIsResendingConfirmation(true);
    onNotice?.(null);

    try {
      await resendSignupConfirmation(email);
      onNotice?.({
        type: 'success',
        message: 'Confirmation email requested. If the account is still unconfirmed, check your inbox and spam folder.'
      });
    } catch (error) {
      onNotice?.({
        type: 'error',
        message: getErrorMessage(error, 'Unable to resend the confirmation email.')
      });
    } finally {
      setIsResendingConfirmation(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    logLegacyDebug('login submit clicked', mode);
    setIsSubmitting(true);
    setInlineError('');
    onNotice?.(null);

    try {
      if (mode === 'reset-request') {
        await withAuthTimeout(sendPasswordResetEmail(email), 'Password reset request timed out.');
        onNotice?.({
          type: 'success',
          message: 'Password reset email sent. Open the link, then set a new password.'
        });
        switchMode('sign-in');
      } else if (mode === 'update-password') {
        validateNewPassword(password, confirmPassword);
        await withAuthTimeout(updateCurrentUserPassword(password), 'Password update request timed out.');
        setPassword('');
        setConfirmPassword('');
        onNotice?.({ type: 'success', message: 'Password updated. You are signed in.' });
        onPasswordUpdated?.();
      } else if (mode === 'sign-up') {
        validateNewPassword(password, confirmPassword);
        const result = await withAuthTimeout(signUpWithPassword({ email, password }), 'Sign-up request timed out.');
        onNotice?.({
          type: 'success',
          message: signupNoticeForResult(result)
        });
        if (result?.session) {
          onAuthCompleted?.(result.session);
        } else {
          switchMode('sign-in');
        }
      } else {
        logLegacyDebug('login request started');
        const session = await withAuthTimeout(signInWithPassword({ email, password }), 'Login request timed out.');
        logLegacyDebug('login request success', session ? 'Session returned.' : 'No session returned.');
        onNotice?.({ type: 'success', message: 'Signed in.' });
        onAuthCompleted?.(session);
      }
    } catch (error) {
      const message = getErrorMessage(error, 'Authentication failed.');
      logLegacyDebug('login request failure', message);
      setInlineError(message);
      onNotice?.({
        type: 'error',
        message
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="app auth-shell">
      <section className="panel auth-panel">
        <h1>FretTrack</h1>
        <p>{copyForMode(mode).description}</p>

        <form onSubmit={handleSubmit}>
          {mode !== 'update-password' && (
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
          )}

          {mode !== 'reset-request' && (
            <label>
              {mode === 'update-password' ? 'New Password' : 'Password'}
              <input
                type="password"
                autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={12}
                required
              />
            </label>
          )}

          {(mode === 'sign-up' || mode === 'update-password') && (
            <label>
              Confirm Password
              <input
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                minLength={12}
                required
              />
            </label>
          )}

          <button type="submit" className="primary-action" disabled={isSubmitting}>
            {isSubmitting ? 'Please wait...' : copyForMode(mode).submit}
          </button>
        </form>

        {inlineError && <p className="auth-inline-error">{inlineError}</p>}

        {mode === 'sign-in' && (
          <>
            <button
              type="button"
              className="button-tertiary auth-mode-toggle"
              onClick={() => switchMode('reset-request')}
            >
              Forgot password?
            </button>
            <button
              type="button"
              className="button-tertiary auth-mode-toggle"
            onClick={() => switchMode('sign-up')}
          >
              Create beta login account
          </button>
          </>
        )}

        {mode !== 'sign-in' && mode !== 'update-password' && (
          <button
            type="button"
            className="button-tertiary auth-mode-toggle"
            onClick={() => switchMode('sign-in')}
          >
            Back to sign in
          </button>
        )}

        {mode === 'sign-up' && (
          <button
            type="button"
            className="button-tertiary auth-mode-toggle"
            onClick={handleResendConfirmation}
            disabled={isSubmitting || isResendingConfirmation || !email}
          >
            {isResendingConfirmation ? 'Requesting...' : 'Resend confirmation email'}
          </button>
        )}
      </section>
    </main>
  );
}

function withAuthTimeout(promise, timeoutMessage) {
  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, AUTH_REQUEST_TIMEOUT_MS);

    promise
      .then(resolve)
      .catch(reject)
      .then(
        () => window.clearTimeout(timeoutId),
        () => window.clearTimeout(timeoutId)
      );
  });
}

function copyForMode(mode) {
  if (mode === 'reset-request') {
    return {
      description: 'Enter your email and FretTrack will send a password reset link.',
      submit: 'Send Reset Email'
    };
  }

  if (mode === 'update-password') {
    return {
      description: 'Set a new password for this FretTrack account.',
      submit: 'Update Password'
    };
  }

  if (mode === 'sign-up') {
    return {
      description: 'Create a beta login account. Shop workspace access starts after operator approval.',
      submit: 'Create Login Account'
    };
  }

  return {
    description: 'Sign in to access shop work orders and customer records.',
    submit: 'Sign In'
  };
}

function validateNewPassword(password, confirmPassword) {
  if (password.length < 12) {
    throw new Error('Password must be at least 12 characters.');
  }

  if (password !== confirmPassword) {
    throw new Error('Passwords do not match.');
  }
}

function signupNoticeForResult(result) {
  if (result?.session) {
    return 'Account created. You are signed in.';
  }

  if (result?.mayAlreadyExist) {
    return 'If this email already has a FretTrack account, sign in or reset your password. If it is new and still unconfirmed, check your email.';
  }

  return 'Check your email to confirm your account, then sign in. If it does not arrive, use Resend confirmation email.';
}
