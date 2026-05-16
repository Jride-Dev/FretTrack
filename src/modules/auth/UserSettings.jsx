import { useEffect, useState } from 'react';
import { changeCurrentUserPassword, getCurrentUser } from './authService';

export default function UserSettings({ onNotice }) {
  const [email, setEmail] = useState('');
  const [form, setForm] = useState({
    currentPassword: '',
    nextPassword: '',
    confirmPassword: ''
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let isMounted = true;
    getCurrentUser()
      .then((user) => {
        if (isMounted) {
          setEmail(user?.email || '');
        }
      })
      .catch((error) => {
        console.error('User settings load failed.', error);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    try {
      validatePasswordChange(form);
    } catch (error) {
      onNotice?.({ type: 'error', message: error.message });
      return;
    }

    setIsSaving(true);
    try {
      await changeCurrentUserPassword({
        email,
        currentPassword: form.currentPassword,
        nextPassword: form.nextPassword
      });
      setForm({
        currentPassword: '',
        nextPassword: '',
        confirmPassword: ''
      });
      onNotice?.({ type: 'success', message: 'Password changed successfully.' });
    } catch (error) {
      console.error('Password change failed.', error);
      onNotice?.({
        type: 'error',
        message: error instanceof Error && error.message ? error.message : 'Password change failed.'
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="user-settings">
      <h3>User</h3>
      <p className="muted-text">Signed in as {email || 'current user'}.</p>
      <form className="form-grid" onSubmit={handleSubmit}>
        <label className="wide">
          Current Password
          <input
            type="password"
            name="currentPassword"
            autoComplete="current-password"
            value={form.currentPassword}
            onChange={updateField}
            disabled={isSaving}
            required
          />
        </label>
        <label>
          New Password
          <input
            type="password"
            name="nextPassword"
            autoComplete="new-password"
            value={form.nextPassword}
            onChange={updateField}
            disabled={isSaving}
            minLength={12}
            required
          />
        </label>
        <label>
          Confirm New Password
          <input
            type="password"
            name="confirmPassword"
            autoComplete="new-password"
            value={form.confirmPassword}
            onChange={updateField}
            disabled={isSaving}
            minLength={12}
            required
          />
        </label>
        <button type="submit" disabled={isSaving || !email}>
          {isSaving ? 'Changing Password...' : 'Change Password'}
        </button>
      </form>
    </section>
  );
}

function validatePasswordChange(form) {
  if (!form.currentPassword) {
    throw new Error('Enter your current password.');
  }

  if (form.nextPassword.length < 12) {
    throw new Error('New password must be at least 12 characters.');
  }

  if (form.nextPassword !== form.confirmPassword) {
    throw new Error('New passwords do not match.');
  }

  if (form.currentPassword === form.nextPassword) {
    throw new Error('New password must be different from the current password.');
  }
}
