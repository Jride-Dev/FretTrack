import {
  canAccessOperatorDashboard,
  canAccessShopAsMember
} from '../modules/auth/permissionService';
import {
  getBillingStatusLabel,
  getEffectiveStatus,
  getPremiumFeatureAvailability,
  isGraceStatus,
  isReadOnlyStatus
} from '../modules/billing/entitlementService';

export function PendingApprovalScreen({ betaAccess, email, onRetry, onSignOut }) {
  const isRejected = betaAccess?.status === 'rejected';
  const message = isRejected
    ? 'Your FretTrack access request is not active. Contact support if you believe this is a mistake.'
    : 'Your FretTrack access request has been received. Approval is required before shop setup unlocks.';

  return (
    <main className="app auth-shell">
      <section className="panel auth-panel">
        <h1>{isRejected ? 'Account Access Not Active' : 'Pending Approval'}</h1>
        <p>{message}</p>
        {!isRejected && (
          <p className="muted-text">
            You do not need to create a shop yet. Watch your email for the approval message, and check your spam or junk folder if it does not arrive.
          </p>
        )}
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

export function InternalCurrentAccessPanel({ betaAccess, canWrite, entitlementSnapshot, isOperator, membership, permissions = {}, session }) {
  if (!canAccessOperatorDashboard({ isOperator })) {
    return null;
  }

  const subscription = entitlementSnapshot?.subscription || {};
  const premiumFeatures = getPremiumFeatureAvailability(entitlementSnapshot)
    .filter((feature) => feature.enabled)
    .map((feature) => feature.label);
  return (
    <section className="internal-access-panel no-print" aria-label="Internal current access">
      <div>
        <strong>Internal Access</strong>
        <span>{session?.user?.email || 'Unknown user'}</span>
      </div>
      <dl>
        <div>
          <dt>User ID</dt>
          <dd>{session?.user?.id || '-'}</dd>
        </div>
        <div>
          <dt>Active Shop</dt>
          <dd>{membership?.shopId || '-'}</dd>
        </div>
        <div>
          <dt>Shop Role</dt>
          <dd>{membership?.role || '-'}</dd>
        </div>
        <div>
          <dt>Effective Member Access</dt>
          <dd>{canAccessShopAsMember({ role: membership?.role, entitlementSnapshot }) ? 'Yes' : 'No'}</dd>
        </div>
        <div>
          <dt>Access Approval</dt>
          <dd>{betaAccess?.status || '-'}</dd>
        </div>
        <div>
          <dt>Operator</dt>
          <dd>{isOperator ? 'Yes' : 'No'}</dd>
        </div>
        <div>
          <dt>Raw Tier</dt>
          <dd>{subscription.tier || '-'}</dd>
        </div>
        <div>
          <dt>Raw Status</dt>
          <dd>{subscription.status || '-'}</dd>
        </div>
        <div>
          <dt>Premium Trial Ends</dt>
          <dd>{subscription.trialEndsAt ? new Date(subscription.trialEndsAt).toLocaleString() : '-'}</dd>
        </div>
        <div>
          <dt>Effective Tier</dt>
          <dd>{subscription.effectiveTier || subscription.tier || entitlementSnapshot?.plan?.id || '-'}</dd>
        </div>
        <div>
          <dt>Effective Status</dt>
          <dd>{subscription.effectiveStatus || subscription.status || '-'}</dd>
        </div>
        <div>
          <dt>Can Write</dt>
          <dd>{canWrite ? 'Yes' : 'No'}</dd>
        </div>
        <div>
          <dt>Jobs / Customers / Schedule</dt>
          <dd>{permissions.canEditJobs && permissions.canEditCustomers && permissions.canEditScheduling ? 'Write' : 'Read only'}</dd>
        </div>
        <div>
          <dt>Inventory / Shipping / Custody</dt>
          <dd>{permissions.canManageInventory && permissions.canWriteShipping && permissions.canManageCustodyEvents ? 'Write' : 'Read only'}</dd>
        </div>
        <div>
          <dt>Billing</dt>
          <dd>{permissions.canManageBilling ? 'Manage' : permissions.canViewBilling ? 'View only' : 'No access'}</dd>
        </div>
        <div>
          <dt>Photo Editor</dt>
          <dd>{entitlementSnapshot?.access?.canUsePhotoEditor ? 'Yes' : 'No'}</dd>
        </div>
        <div>
          <dt>Advanced Reporting</dt>
          <dd>{entitlementSnapshot?.access?.canUseAdvancedReporting ? 'Yes' : 'No'}</dd>
        </div>
        <div>
          <dt>Team Members</dt>
          <dd>{entitlementSnapshot?.access?.canManageTeamMembers ? 'Yes' : 'No'}</dd>
        </div>
      </dl>
      <p>{premiumFeatures.length ? premiumFeatures.join(', ') : 'No premium features enabled'}</p>
    </section>
  );
}

export function BillingStateBanner({ canManageShop, entitlementSnapshot }) {
  if (!entitlementSnapshot) {
    return null;
  }

  const status = getEffectiveStatus(entitlementSnapshot);
  if (!isGraceStatus(entitlementSnapshot) && !isReadOnlyStatus(entitlementSnapshot)) {
    return null;
  }

  const isReadOnly = isReadOnlyStatus(entitlementSnapshot);
  const isExpired = status === 'expired';
  const actionText = canManageShop
    ? 'Open Billing to review plan details or contact support.'
    : 'Ask a shop owner or admin to review billing.';
  const message = isExpired
    ? `This trial has expired. Existing jobs and customers remain viewable, but new work, uploads, edits, and customer messages require upgraded access. ${actionText}`
    : isReadOnly
      ? `This shop is ${getBillingStatusLabel(status).toLowerCase()}. Existing jobs and customers remain viewable, but new work, uploads, and customer messages are paused. ${actionText}`
      : `This shop is in a billing grace period. Normal work is still available for now. ${actionText}`;

  return (
    <section className={`billing-state-banner ${isReadOnly ? 'read-only' : 'grace'}`}>
      <strong>{isExpired ? 'Trial expired' : isReadOnly ? 'Read-only access' : 'Grace period'}</strong>
      <span>{message}</span>
    </section>
  );
}
