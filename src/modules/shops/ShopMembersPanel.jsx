import { useEffect, useMemo, useState } from 'react';
import {
  addShopMemberByEmail,
  getShopMembers,
  removeShopMember,
  updateShopMemberRole
} from './shopMembershipService';

const memberRoles = [
  { value: 'owner', label: 'Owner' },
  { value: 'admin', label: 'Admin' },
  { value: 'tech', label: 'Tech' },
  { value: 'viewer', label: 'Viewer' }
];

export default function ShopMembersPanel({
  canManageShop = false,
  canManageTeamMembers = false,
  shopId = '',
  currentUserId = '',
  onNotice
}) {
  const [members, setMembers] = useState([]);
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState('tech');
  const [isLoading, setIsLoading] = useState(false);
  const [busyMemberId, setBusyMemberId] = useState('');

  const ownerCount = useMemo(
    () => members.filter((member) => member.role === 'owner').length,
    [members]
  );

  useEffect(() => {
    if (!canManageShop || !shopId) {
      setMembers([]);
      return;
    }

    loadMembers();
  }, [canManageShop, shopId]);

  async function loadMembers() {
    setIsLoading(true);
    try {
      setMembers(await getShopMembers(shopId));
    } catch (error) {
      console.error('Shop members load failed.', error);
      onNotice?.({ type: 'error', message: getErrorMessage(error, 'Unable to load shop members.') });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleAddMember(event) {
    event.preventDefault();
    if (!email.trim()) {
      onNotice?.({ type: 'error', message: 'Member email is required.' });
      return;
    }

    setBusyMemberId('new');
    try {
      await addShopMemberByEmail({
        shopId,
        email: email.trim(),
        role,
        displayName: displayName.trim()
      });
      setEmail('');
      setDisplayName('');
      setRole('tech');
      await loadMembers();
      onNotice?.({ type: 'success', message: 'Shop member saved.' });
    } catch (error) {
      console.error('Shop member save failed.', error);
      onNotice?.({ type: 'error', message: getErrorMessage(error, 'Unable to save shop member.') });
    } finally {
      setBusyMemberId('');
    }
  }

  async function handleRoleChange(member, nextRole) {
    if (member.role === nextRole) {
      return;
    }

    setBusyMemberId(member.id);
    try {
      await updateShopMemberRole(member.id, nextRole);
      await loadMembers();
      onNotice?.({ type: 'success', message: 'Member role updated.' });
    } catch (error) {
      console.error('Member role update failed.', error);
      onNotice?.({ type: 'error', message: getErrorMessage(error, 'Unable to update member role.') });
    } finally {
      setBusyMemberId('');
    }
  }

  async function handleRemove(member) {
    const label = member.email || member.displayName || 'this member';
    if (!window.confirm(`Remove ${label} from this shop?`)) {
      return;
    }

    setBusyMemberId(member.id);
    try {
      await removeShopMember(member.id);
      await loadMembers();
      onNotice?.({ type: 'success', message: 'Shop member removed.' });
    } catch (error) {
      console.error('Member remove failed.', error);
      onNotice?.({ type: 'error', message: getErrorMessage(error, 'Unable to remove shop member.') });
    } finally {
      setBusyMemberId('');
    }
  }

  if (!canManageShop) {
    return null;
  }

  return (
    <section className="shop-members-settings">
      <div className="panel-heading">
        <div>
          <h3>Shop Members</h3>
          <p className="muted-text">Add people who already have a FretTrack sign-in, then choose what they can do in this shop.</p>
        </div>
        <button type="button" onClick={loadMembers} disabled={isLoading || Boolean(busyMemberId)}>
          {isLoading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {!canManageTeamMembers && (
        <section className="locked-feature-panel">
          <strong>Team Members - Available in Pro</strong>
          <p>Trial access keeps the owner account active. Existing staff memberships are preserved, and staff access plus member changes unlock with Pro access.</p>
        </section>
      )}

      {canManageTeamMembers && (
        <form className="form-grid member-add-form" onSubmit={handleAddMember}>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={Boolean(busyMemberId)}
              placeholder="tech@example.com"
              required
            />
          </label>
          <label>
            Display Name
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              disabled={Boolean(busyMemberId)}
              placeholder="Optional"
            />
          </label>
          <label>
            Role
            <select value={role} onChange={(event) => setRole(event.target.value)} disabled={Boolean(busyMemberId)}>
              {memberRoles.map((roleOption) => (
                <option key={roleOption.value} value={roleOption.value}>{roleOption.label}</option>
              ))}
            </select>
          </label>
          <button type="submit" disabled={Boolean(busyMemberId)}>
            {busyMemberId === 'new' ? 'Saving...' : 'Add / Update Member'}
          </button>
        </form>
      )}

      <div className="operator-table-wrap shop-members-table-wrap">
        <table className="operator-table shop-members-table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Last Sign-In</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => {
              const isBusy = busyMemberId === member.id;
              const isLastOwner = member.role === 'owner' && ownerCount <= 1;
              const isCurrentUser = member.userId === currentUserId;
              return (
                <tr key={member.id}>
                  <td>
                    <strong>{member.email || member.displayName || 'Unknown member'}</strong>
                    <small>{member.displayName && member.displayName !== member.email ? member.displayName : member.userId}</small>
                  </td>
                  <td>
                    <select
                      value={member.role}
                      onChange={(event) => handleRoleChange(member, event.target.value)}
                      disabled={!canManageTeamMembers || isBusy || isLastOwner}
                    >
                      {memberRoles.map((roleOption) => (
                        <option key={roleOption.value} value={roleOption.value}>{roleOption.label}</option>
                      ))}
                    </select>
                    {isLastOwner && <small>Last owner</small>}
                  </td>
                  <td><span className={`status-badge ${member.status || 'active'}`}>{member.status || 'active'}</span></td>
                  <td>{formatDateTime(member.lastSignInAt) || '-'}</td>
                  <td>
                    <button
                      type="button"
                      className="table-link danger-link"
                      onClick={() => handleRemove(member)}
                      disabled={!canManageTeamMembers || isBusy || isLastOwner}
                    >
                      {isBusy ? 'Working...' : isCurrentUser ? 'Remove Self' : 'Remove'}
                    </button>
                  </td>
                </tr>
              );
            })}
            {!members.length && (
              <tr>
                <td colSpan="5">{isLoading ? 'Loading members...' : 'No members found.'}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function formatDateTime(value) {
  if (!value) {
    return '';
  }

  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(new Date(value));
  } catch {
    return value;
  }
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
