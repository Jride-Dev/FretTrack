import FeedbackReporter from '../modules/system/FeedbackReporter.jsx';

export default function WorkspaceShellHeader({
  appVersionText,
  canViewBilling,
  canViewOperator,
  canWrite,
  handleInstallApp,
  handleSignOut,
  isJobMode,
  isOnline,
  isSaving,
  memberships,
  mode,
  navigateTo,
  offlineDraftCount,
  planStatus,
  saveCurrentJob,
  selectedJob,
  session,
  setNotice,
  setTheme,
  shopName,
  shouldShowPwaInstallButton,
  showNewJob,
  showShopPicker,
  statusText,
  supabaseStatus,
  theme,
  themes
}) {
  const navClass = (...modes) => [
    'workspace-nav-button',
    modes.includes(mode) ? 'active' : ''
  ].filter(Boolean).join(' ');

  return (
    <header className="workspace-shell-header no-print">
      <div className="workspace-brand">
        <img
          src={planStatus.emblemSrc}
          alt=""
          aria-hidden="true"
          className={planStatus.emblemClassName}
        />
        <div>
          <strong>{planStatus.headerLabel || 'FretTrack'}</strong>
          <span>{shopName}</span>
        </div>
      </div>

      <div className="workspace-plan-context">
        <span className={`plan-badge ${planStatus.badgeTone}`}>{planStatus.planLabel || 'Trial'}</span>
        {planStatus.countdownLabel && <small>{planStatus.countdownLabel}</small>}
        <small>{appVersionText}</small>
      </div>

      <div className="workspace-quick-actions">
        <button type="button" className="primary-action" aria-label="New Job" onClick={() => showNewJob()}>
          <span aria-hidden="true">+</span> New Work Order
        </button>
        <button
          type="button"
          className={isJobMode ? 'button-secondary' : 'button-tertiary'}
          aria-label="Save Job"
          onClick={saveCurrentJob}
          disabled={isSaving || !canWrite}
        >
          {isSaving ? 'Saving…' : 'Save Work Order'}
        </button>
      </div>

      <nav className="workspace-primary-nav" aria-label="FretTrack workspace">
        <NavGroup label="Workspace">
          <button type="button" className={navClass('list')} onClick={() => navigateTo('list')}>Current Jobs</button>
          <button type="button" className={navClass('scheduling')} onClick={() => navigateTo('scheduling')}>Calendar</button>
        </NavGroup>

        <NavGroup label="Repair">
          <button type="button" className={navClass('amplifiers', 'amplifier-detail')} onClick={() => navigateTo('amplifiers')}>Amplifier Repair</button>
          <button type="button" className={navClass('keyboards', 'keyboard-detail')} onClick={() => navigateTo('keyboards')}>Keyboard Repair</button>
        </NavGroup>

        <NavGroup label="Operations">
          <button type="button" className={navClass('customers')} onClick={() => navigateTo('customers')}>Customers</button>
          <button type="button" className={navClass('inventory')} onClick={() => navigateTo('inventory')}>Inventory</button>
          <button type="button" className={navClass('shipping')} onClick={() => navigateTo('shipping')}>Shipping</button>
        </NavGroup>

        <NavGroup label="Insights">
          <button type="button" className={navClass('reports')} onClick={() => navigateTo('reports')}>Advanced Reports</button>
          <button type="button" className={navClass('accounting')} onClick={() => navigateTo('accounting')}>Accounting</button>
        </NavGroup>

        <NavGroup label="Administration">
          {(canWrite || offlineDraftCount > 0) && (
            <button type="button" className={navClass('drafts')} onClick={() => navigateTo('drafts')}>
              Local Drafts{offlineDraftCount ? ` (${offlineDraftCount})` : ''}
            </button>
          )}
          <button type="button" className={navClass('settings')} onClick={() => navigateTo('settings')}>Shop Settings</button>
          {canViewBilling && <button type="button" className={navClass('billing')} onClick={() => navigateTo('billing')}>Billing</button>}
          {canViewOperator && <button type="button" className={navClass('operator')} onClick={() => navigateTo('operator')}>Operator</button>}
        </NavGroup>
      </nav>

      <div className="workspace-nav-footer">
        <label className="workspace-theme-picker">
          <span>Interface theme</span>
          <select value={theme} onChange={(event) => setTheme(event.target.value)}>
            {themes.map((themeOption) => (
              <option key={themeOption.value} value={themeOption.value}>{themeOption.label}</option>
            ))}
          </select>
        </label>
        <div className="workspace-connection-row">
          <span className={`connection-status ${supabaseStatus}`} title={statusText}>
            <span className="connection-status-dot" aria-hidden="true" />
            Database
          </span>
          {!isOnline && <span className="connection-status offline">Offline</span>}
        </div>
        {shouldShowPwaInstallButton && <button type="button" onClick={handleInstallApp}>Install App</button>}
        {session && <FeedbackReporter selectedJob={selectedJob} onNotice={setNotice} />}
        {memberships.length > 1 && <button type="button" onClick={showShopPicker}>Switch Shop</button>}
        {session && <button type="button" className="button-tertiary" onClick={handleSignOut}>Sign Out</button>}
      </div>
    </header>
  );
}

function NavGroup({ label, children }) {
  return (
    <section className="workspace-nav-group">
      <span className="workspace-nav-label">{label}</span>
      {children}
    </section>
  );
}
