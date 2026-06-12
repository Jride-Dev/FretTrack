import { useState } from 'react';
import {
  resendSignupConfirmation,
  sendPasswordResetEmail,
  signInWithPassword,
  signUpWithPassword,
  updateCurrentUserPassword
} from './authService';

export default function AuthGate({ initialMode = 'sign-in', onAuthCompleted, onPasswordUpdated, onNotice }) {
  const [mode, setMode] = useState(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResendingConfirmation, setIsResendingConfirmation] = useState(false);

  function switchMode(nextMode) {
    setMode(nextMode);
    setPassword('');
    setConfirmPassword('');
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
    setIsSubmitting(true);
    onNotice?.(null);

    try {
      if (mode === 'reset-request') {
        await sendPasswordResetEmail(email);
        onNotice?.({
          type: 'success',
          message: 'Password reset email sent. Open the link, then set a new password.'
        });
        switchMode('sign-in');
      } else if (mode === 'update-password') {
        validateNewPassword(password, confirmPassword);
        await updateCurrentUserPassword(password);
        setPassword('');
        setConfirmPassword('');
        onNotice?.({ type: 'success', message: 'Password updated. You are signed in.' });
        onPasswordUpdated?.();
      } else if (mode === 'sign-up') {
        validateNewPassword(password, confirmPassword);
        const result = await signUpWithPassword({ email, password });
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
        const session = await signInWithPassword({ email, password });
        onNotice?.({ type: 'success', message: 'Signed in.' });
        onAuthCompleted?.(session);
      }
    } catch (error) {
      onNotice?.({
        type: 'error',
        message: getErrorMessage(error, 'Authentication failed.')
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

function getErrorMessage(error, fallback) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message || fallback);
  }

  return fallback;
}
