import { useEffect, useMemo, useState } from 'react';
import { formatStorage, getBillingStatusLabel } from '../billing/entitlementService';
import { getBetaOperatorDashboard, updateBetaAccessRequest, updateBetaShopSubscription } from './operatorService';

const statusFilters = ['all', 'trialing', 'beta_bypass', 'active', 'grace', 'read_only', 'canceled'];
const editableStatuses = ['trialing', 'active', 'grace', 'read_only', 'canceled', 'beta_bypass'];

export default function BetaOperatorDashboard({ onNotice }) {
  const [dashboard, setDashboard] = useState(null);
  const [selectedShopId, setSelectedShopId] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [activeView, setActiveView] = useState('shops');
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingShopId, setIsSavingShopId] = useState('');
  const [isSavingAccessUserId, setIsSavingAccessUserId] = useState('');

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    setIsLoading(true);
    try {
      const nextDashboard = await getBetaOperatorDashboard();
      setDashboard(nextDashboard);
      setSelectedShopId((current) => current || nextDashboard.shops[0]?.shopId || '');
    } catch (error) {
      console.error('Operator dashboard failed to load.', error);
      onNotice?.({
        type: 'error',
        message: error instanceof Error ? error.message : 'Operator dashboard failed to load.'
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function updateShopAccess(shop, updates) {
    setIsSavingShopId(shop.shopId);
    try {
      await updateBetaShopSubscription(shop.shopId, updates);
      await loadDashboard();
      onNotice?.({ type: 'success', message: `${shop.shopName || shop.shopId} access updated.` });
    } catch (error) {
      console.error('Operator shop update failed.', error);
      onNotice?.({
        type: 'error',
        message: error instanceof Error ? error.message : 'Shop access update failed.'
      });
    } finally {
      setIsSavingShopId('');
    }
  }

  async function updateBetaAccess(accessRequest, status) {
    setIsSavingAccessUserId(accessRequest.id);
    try {
      await updateBetaAccessRequest(accessRequest.id, status, accessRequest.notes || null);
      await loadDashboard();
      onNotice?.({ type: 'success', message: `${accessRequest.email || accessRequest.userId || accessRequest.id} beta access updated.` });
    } catch (error) {
      console.error('Operator beta access update failed.', error);
      onNotice?.({
        type: 'error',
        message: error instanceof Error ? error.message : 'Beta access update failed.'
      });
    } finally {
      setIsSavingAccessUserId('');
    }
  }

  const filteredShops = useMemo(() => {
    const text = query.trim().toLowerCase();
    return (dashboard?.shops || []).filter((shop) => {
      const matchesStatus = statusFilter === 'all' || shop.subscriptionStatus === statusFilter;
      const haystack = [
        shop.shopName,
        shop.shopId,
        shop.planName,
        shop.subscriptionStatus,
        shop.billingEmail,
        shop.shopEmail,
        ...(shop.adminEmails || [])
      ].join(' ').toLowerCase();
      return matchesStatus && (!text || haystack.includes(text));
    });
  }, [dashboard?.shops, query, statusFilter]);

  const selectedShop = useMemo(
    () => (dashboard?.shops || []).find((shop) => shop.shopId === selectedShopId) || filteredShops[0] || null,
    [dashboard?.shops, filteredShops, selectedShopId]
  );

  const filteredMembers = useMemo(() => {
    const text = query.trim().toLowerCase();
    return (dashboard?.members || []).filter((member) => {
      const matchesShop = !selectedShop?.shopId || member.shopId === selectedShop.shopId || activeView === 'members';
      const haystack = [member.email, member.role, member.shopName, member.shopId, member.status].join(' ').toLowerCase();
      return matchesShop && (!text || haystack.includes(text));
    });
  }, [activeView, dashboard?.members, query, selectedShop?.shopId]);

  const filteredBetaAccessRequests = useMemo(() => {
    const text = query.trim().toLowerCase();
    return (dashboard?.betaAccessRequests || []).filter((request) => {
      const haystack = [request.email, request.status, request.userId, request.notes].join(' ').toLowerCase();
      return !text || haystack.includes(text);
    });
  }, [dashboard?.betaAccessRequests, query]);

  if (isLoading && !dashboard) {
    return <section className="panel operator-dashboard">Loading beta operator dashboard...</section>;
  }

  if (!dashboard) {
    return (
      <section className="panel operator-dashboard">
        <h2>Beta Operator Dashboard</h2>
        <p className="muted-text">Operator data is unavailable.</p>
        <button type="button" onClick={loadDashboard}>Retry</button>
      </section>
    );
  }

  return (
    <section className="panel operator-dashboard">
      <div className="operator-header">
        <div>
          <h2>Beta Operator Dashboard</h2>
          <p className="muted-text">Internal beta support view. Customer-facing analytics this is not.</p>
        </div>
        <button type="button" onClick={loadDashboard} disabled={isLoading}>
          {isLoading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      <SummaryCards summary={dashboard.summary} />

      <div className="operator-controls no-print">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search shops, users, status"
        />
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          {statusFilters.map((status) => (
            <option key={status} value={status}>{status === 'all' ? 'All statuses' : getBillingStatusLabel(status)}</option>
          ))}
        </select>
        <div className="segmented-control" role="tablist" aria-label="Operator views">
          {['shops', 'members', 'betaAccess', 'usage', 'activity'].map((view) => (
            <button
              key={view}
              type="button"
              className={activeView === view ? 'active' : ''}
              onClick={() => setActiveView(view)}
            >
              {view === 'betaAccess' ? 'beta access' : view}
            </button>
          ))}
        </div>
      </div>

      {activeView === 'shops' && (
        <ShopsTable
          shops={filteredShops}
          selectedShopId={selectedShop?.shopId || ''}
          isSavingShopId={isSavingShopId}
          onSelectShop={setSelectedShopId}
          onUpdateShop={updateShopAccess}
        />
      )}

      {activeView === 'members' && <MembersTable members={filteredMembers} />}

      {activeView === 'betaAccess' && (
        <BetaAccessTable
          requests={filteredBetaAccessRequests}
          isSavingAccessUserId={isSavingAccessUserId}
          onUpdateAccess={updateBetaAccess}
        />
      )}

      {activeView === 'usage' && <UsageTable shops={dashboard.usage} />}

      {activeView === 'activity' && <ActivityFeed activity={dashboard.activity} />}

      {selectedShop && activeView === 'shops' && (
        <ShopDetails shop={selectedShop} members={dashboard.members.filter((member) => member.shopId === selectedShop.shopId)} />
      )}
    </section>
  );
}

function SummaryCards({ summary }) {
  const cards = [
    ['Beta shops', summary.totalBetaShops],
    ['Active users', summary.activeUsers],
    ['Trialing', summary.trialingShops],
    ['Beta bypass', summary.betaBypassShops],
    ['Grace/read-only', summary.graceOrReadOnlyShops],
    ['Storage', formatStorage(summary.totalStorageBytes)],
    ['Jobs', summary.totalJobs],
    ['Pending approvals', summary.pendingBetaAccessRequests],
    ['Recent activity', summary.recentActivityCount]
  ];

  return (
    <div className="operator-summary-grid">
      {cards.map(([label, value]) => (
        <div key={label} className="operator-summary-card">
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  );
}

function BetaAccessTable({ requests, isSavingAccessUserId, onUpdateAccess }) {
  return (
    <div className="operator-table-wrap">
      <table className="operator-table">
        <thead>
          <tr>
            <th>User</th>
            <th>Status</th>
            <th>Requested</th>
            <th>Reviewed</th>
            <th>Last Sign-In</th>
            <th>Notes</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {requests.map((request) => (
            <tr key={request.id || request.userId || request.email}>
              <td>
                <strong>{request.email || request.userId || request.id}</strong>
                <small>{request.userId || 'No auth user yet'}</small>
              </td>
              <td><BetaAccessStatusBadge status={request.status} /></td>
              <td>{formatDateTime(request.requestedAt)}</td>
              <td>
                {formatDateTime(request.reviewedAt)}
                {request.reviewedByEmail && <small>{request.reviewedByEmail}</small>}
              </td>
              <td>{formatDateTime(request.lastSignInAt)}</td>
              <td>{request.notes || 'None'}</td>
              <td>
                <div className="operator-row-actions">
                  <button
                    type="button"
                    disabled={isSavingAccessUserId === request.id || request.status === 'approved'}
                    onClick={() => onUpdateAccess(request, 'approved')}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    disabled={isSavingAccessUserId === request.id || request.status === 'rejected'}
                    onClick={() => onUpdateAccess(request, 'rejected')}
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    disabled={isSavingAccessUserId === request.id || request.status === 'pending'}
                    onClick={() => onUpdateAccess(request, 'pending')}
                  >
                    Pending
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {!requests.length && (
            <tr>
              <td colSpan="7">No beta access requests found.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function ShopsTable({ shops, selectedShopId, isSavingShopId, onSelectShop, onUpdateShop }) {
  return (
    <div className="operator-table-wrap">
      <table className="operator-table">
        <thead>
          <tr>
            <th>Shop</th>
            <th>Plan</th>
            <th>Status</th>
            <th>Users</th>
            <th>Storage</th>
            <th>Jobs</th>
            <th>Trial Ends</th>
            <th>Last Activity</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {shops.map((shop) => (
            <tr key={shop.shopId} className={selectedShopId === shop.shopId ? 'selected' : ''}>
              <td>
                <button type="button" className="table-link" onClick={() => onSelectShop(shop.shopId)}>
                  {shop.shopName || shop.shopId}
                </button>
                <small>{shop.shopId}</small>
              </td>
              <td>{shop.planName || shop.planId}</td>
              <td><StatusBadge status={shop.subscriptionStatus} /></td>
              <td>{shop.userCount}</td>
              <td className={isNearQuota(shop) ? 'quota-warning' : ''}>{formatStorage(shop.storageBytes)}</td>
              <td>{shop.jobCount}</td>
              <td>{formatDate(shop.trialEndsAt)}</td>
              <td>{formatDateTime(shop.lastActivityAt)}</td>
              <td>
                <div className="operator-row-actions">
                  <button
                    type="button"
                    disabled={isSavingShopId === shop.shopId}
                    onClick={() => onUpdateShop(shop, { betaBypass: shop.subscriptionStatus !== 'beta_bypass' })}
                  >
                    {shop.subscriptionStatus === 'beta_bypass' ? 'Unset beta' : 'Beta bypass'}
                  </button>
                  <button
                    type="button"
                    disabled={isSavingShopId === shop.shopId}
                    onClick={() => onUpdateShop(shop, { extendTrialDays: 14 })}
                  >
                    +14 days
                  </button>
                  <select
                    value={shop.subscriptionStatus}
                    disabled={isSavingShopId === shop.shopId}
                    onChange={(event) => onUpdateShop(shop, { nextStatus: event.target.value })}
                  >
                    {editableStatuses.map((status) => (
                      <option key={status} value={status}>{getBillingStatusLabel(status)}</option>
                    ))}
                  </select>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ShopDetails({ shop, members }) {
  return (
    <section className="operator-detail-panel">
      <h3>{shop.shopName || shop.shopId}</h3>
      <div className="operator-detail-grid">
        <DetailItem label="Shop ID" value={shop.shopId} />
        <DetailItem label="Owner/admin emails" value={(shop.adminEmails || []).join(', ') || 'None found'} />
        <DetailItem label="Billing email" value={shop.billingEmail || shop.shopEmail || 'Not set'} />
        <DetailItem label="Grace ends" value={formatDate(shop.graceEndsAt)} />
        <DetailItem label="Created" value={formatDateTime(shop.createdAt)} />
        <DetailItem label="Usage measured" value={formatDateTime(shop.usageMeasuredAt)} />
        <DetailItem label="Images" value={String(shop.imageCount)} />
        <DetailItem label="Failed uploads" value={String(shop.failedUploadCount)} />
      </div>
      <MembersTable members={members} compact />
    </section>
  );
}

function MembersTable({ members, compact = false }) {
  return (
    <div className="operator-table-wrap">
      <table className="operator-table">
        <thead>
          <tr>
            {!compact && <th>Shop</th>}
            <th>User</th>
            <th>Role</th>
            <th>Status</th>
            <th>Last Sign-In</th>
            <th>Added</th>
          </tr>
        </thead>
        <tbody>
          {members.map((member) => (
            <tr key={`${member.shopId}-${member.userId}`}>
              {!compact && <td>{member.shopName || member.shopId}</td>}
              <td>
                <strong>{member.email || member.displayName || member.userId}</strong>
                <small>{member.userId}</small>
              </td>
              <td>{member.role}</td>
              <td><StatusBadge status={member.status} /></td>
              <td>{formatDateTime(member.lastSignInAt)}</td>
              <td>{formatDateTime(member.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function UsageTable({ shops }) {
  return (
    <div className="operator-table-wrap">
      <table className="operator-table">
        <thead>
          <tr>
            <th>Shop</th>
            <th>Storage</th>
            <th>Images</th>
            <th>Jobs</th>
            <th>Email Month</th>
            <th>SMS Month</th>
            <th>Storage Safety</th>
          </tr>
        </thead>
        <tbody>
          {shops.map((shop) => (
            <tr key={shop.shopId}>
              <td>
                <strong>{shop.shopName || shop.shopId}</strong>
                <small>{shop.shopId}</small>
              </td>
              <td>{formatStorage(shop.storageBytes)}</td>
              <td>{shop.imageCount}</td>
              <td>{shop.jobCount}</td>
              <td>{shop.emailCountMonth}</td>
              <td>{shop.smsCountMonth}</td>
              <td>{getStorageSafetyLabel(shop)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ActivityFeed({ activity }) {
  return (
    <div className="operator-activity-feed">
      {activity.map((item) => (
        <article key={`${item.createdAt}-${item.subjectId}-${item.eventType}`} className="operator-activity-item">
          <div>
            <strong>{item.eventLabel || item.eventType}</strong>
            <span>{item.shopName || item.shopId}</span>
          </div>
          <p>{item.eventNote || item.subjectId}</p>
          <time>{formatDateTime(item.createdAt)}</time>
        </article>
      ))}
      {!activity.length && <p className="muted-text">No recent activity found.</p>}
    </div>
  );
}

function DetailItem({ label, value }) {
  return (
    <div className="operator-detail-item">
      <span>{label}</span>
      <strong>{value || 'None'}</strong>
    </div>
  );
}

function StatusBadge({ status }) {
  return <span className={`status-badge ${String(status || '').replace(/_/g, '-')}`}>{getBillingStatusLabel(status)}</span>;
}

function BetaAccessStatusBadge({ status }) {
  const labels = {
    pending: 'Pending',
    approved: 'Approved',
    rejected: 'Rejected'
  };
  return <span className={`status-badge ${String(status || '').replace(/_/g, '-')}`}>{labels[status] || status || 'Unknown'}</span>;
}

function getStorageSafetyLabel(shop) {
  if (shop.failedUploadCount > 0) {
    return `${shop.failedUploadCount} blocked/failed upload events`;
  }
  if (isNearQuota(shop)) {
    return 'Near trial quota';
  }
  return 'OK';
}

function isNearQuota(shop) {
  const trialQuota = 1024 * 1024 * 1024;
  return shop.subscriptionStatus === 'trialing' && shop.storageBytes >= trialQuota * 0.8;
}

function formatDate(value) {
  if (!value) {
    return 'None';
  }
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
}

function formatDateTime(value) {
  if (!value) {
    return 'None';
  }
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(new Date(value));
}
