import { lazy, Suspense } from 'react';
import BetaOperatorDashboard from '../modules/operator/BetaOperatorDashboard.jsx';
import ShopSettings from '../modules/shops/ShopSettings.jsx';
import { canAccessOperatorDashboard } from '../modules/auth/permissionService.js';
import SpecialistJobWorkspaceNav, { getSpecialistRepairMode } from './SpecialistJobWorkspaceNav.jsx';
import JobForm from '../modules/jobs/JobForm.jsx';

const AccountingReports = lazy(() => import('../modules/accounting/AccountingReports.jsx'));
const AmplifierJobDetail = lazy(() => import('../modules/amplifiers/AmplifierJobDetail.jsx'));
const AmplifierRepairPage = lazy(() => import('../modules/amplifiers/AmplifierRepairPage.jsx'));
const KeyboardJobDetail = lazy(() => import('../modules/keyboards/KeyboardJobDetail.jsx'));
const KeyboardRepairPage = lazy(() => import('../modules/keyboards/KeyboardRepairPage.jsx'));
const BillingPage = lazy(() => import('../modules/billing/BillingPage.jsx'));
const CustomerManager = lazy(() => import('../modules/customers/CustomerManager.jsx'));
const InventoryPage = lazy(() => import('../modules/inventory/InventoryPage.jsx'));
const CurrentJobsPage = lazy(() => import('../modules/jobs/CurrentJobsPage.jsx'));
const EstimatesPage = lazy(() => import('../modules/jobs/EstimatesPage.jsx'));
const GuitarJobDetail = lazy(() => import('../modules/guitars/GuitarJobDetail.jsx'));
const JobDetail = lazy(() => import('../modules/jobs/JobDetail.jsx'));
const OfflineDraftQueue = lazy(() => import('../modules/jobs/OfflineDraftQueue.jsx'));
const AdvancedReportsPage = lazy(() => import('../modules/reports/AdvancedReportsPage.jsx'));
const SchedulingPage = lazy(() => import('../modules/scheduling/SchedulingPage.jsx'));
const ShippingDashboard = lazy(() => import('../modules/shipping/ShippingDashboard.jsx'));

export default function WorkspaceRouter(props) {
  return (
    <Suspense fallback={<section className="panel empty-state" role="status">Loading workspace…</section>}>
      <WorkspacePage {...props} />
    </Suspense>
  );
}

function WorkspacePage({
  mode,
  data,
  access,
  actions
}) {
  const {
    assignableMembers,
    assignableMembersError,
    assignableMembersLoading,
    betaApproved,
    billingAccess,
    currentJobsAssigneeFilter,
    customers,
    dateOptions,
    isOnline,
    jobs,
    membership,
    moneyOptions,
    offlineDrafts,
    selectedJob,
    selectedOfflineDraftId,
    session,
    shopId,
    shopProfile,
    syncingDraftId,
    teamAssignmentEnabled,
    pendingNewJobCustomer
  } = data;

  if (mode === 'new') {
    return (
      <section className="new-work-order-page" aria-label="New work order">
        <JobForm
          jobs={jobs}
          customers={customers}
          canWrite={access.canEditJobs}
          amplifierRepairEnabled={access.amplifierRepairEnabled}
          keyboardRepairEnabled={access.keyboardRepairEnabled}
          shopProfile={shopProfile}
          assignableMembers={assignableMembers}
          membership={membership}
          entitlementSnapshot={billingAccess}
          betaApproved={betaApproved}
          initialCustomer={pendingNewJobCustomer}
          onJobSaved={actions.onJobSaved}
          onOfflineDraftSaved={actions.onOfflineDraftSaved}
          onNotice={actions.onNotice}
        />
      </section>
    );
  }

  if (mode === 'list') {
    return (
      <CurrentJobsPage
        jobs={jobs}
        onCreateJob={actions.onOpenNewJob}
        onSelectJob={actions.onSelectJob}
        shopProfile={shopProfile}
        assignableMembers={assignableMembers}
        teamAssignmentEnabled={teamAssignmentEnabled}
        initialAssigneeFilter={currentJobsAssigneeFilter}
      />
    );
  }

  if (mode === 'estimates') {
    return <EstimatesPage jobs={jobs} moneyOptions={moneyOptions} dateOptions={dateOptions} onOpenJob={actions.onSelectJob} />;
  }

  if (mode === 'amplifiers') {
    return (
      <AmplifierRepairPage
        jobs={jobs}
        customers={customers}
        isEntitled={access.amplifierRepairEnabled}
        canWrite={access.canEditAmplifierRepair}
        isOnline={isOnline}
        dateOptions={dateOptions}
        onCreateJob={actions.onCreateAmplifierJob}
        onSelectJob={actions.onSelectJob}
        onNotice={actions.onNotice}
        onDirtyChange={actions.onDirtyChange}
      />
    );
  }

  if (mode === 'keyboards') {
    return (
      <KeyboardRepairPage
        jobs={jobs}
        customers={customers}
        isEntitled={access.keyboardRepairEnabled}
        canWrite={access.canEditKeyboardRepair}
        isOnline={isOnline}
        dateOptions={dateOptions}
        onCreateJob={actions.onCreateKeyboardJob}
        onSelectJob={actions.onSelectJob}
        onNotice={actions.onNotice}
        onDirtyChange={actions.onDirtyChange}
      />
    );
  }

  if (mode === 'settings') {
    return (
      <ShopSettings
        canManageShop={access.canEditShopSettings}
        canManageTeamMembers={access.canManageTeamMembers}
        currentUserId={session?.user?.id || ''}
        initialSettings={shopProfile}
        entitlementSnapshot={billingAccess}
        jobs={jobs}
        assignableMembers={assignableMembers}
        assignableMembersLoading={assignableMembersLoading}
        assignableMembersError={assignableMembersError}
        teamAssignmentEnabled={teamAssignmentEnabled}
        onOpenCurrentJobsForAssignee={actions.onOpenCurrentJobsForAssignee}
        onSave={actions.onShopSettingsSave}
        onNotice={actions.onNotice}
      />
    );
  }

  if (mode === 'customers') {
    return (
      <CustomerManager
        customers={customers}
        jobs={jobs}
        canWrite={access.canEditCustomers}
        loyaltyProgramEnabled={Boolean(billingAccess?.entitlements?.loyalty_program)}
        serviceRemindersEnabled={Boolean(billingAccess?.entitlements?.automated_service_reminders)}
        canPreviewCustomerImport={access.canPreviewCustomerImport}
        dateOptions={dateOptions}
        moneyOptions={moneyOptions}
        shopProfile={shopProfile}
        onCustomerSaved={actions.onCustomerSaved}
        onCreateJobForCustomer={actions.onCreateJobForCustomer}
        onNotice={actions.onNotice}
        onDirtyChange={actions.onDirtyChange}
      />
    );
  }

  if (mode === 'accounting') {
    return <AccountingReports jobs={jobs} shopId={shopId} shopProfile={shopProfile} />;
  }

  if (mode === 'reports') {
    return (
      <AdvancedReportsPage
        customers={customers}
        entitlementSnapshot={billingAccess}
        jobs={jobs}
        onOpenJob={actions.onSelectJob}
        shopId={shopId}
        shopProfile={shopProfile}
        onNotice={actions.onNotice}
      />
    );
  }

  if (mode === 'inventory') {
    return (
      <InventoryPage
        canWrite={access.canManageInventory}
        shopId={shopId}
        onNotice={actions.onNotice}
        onDirtyChange={actions.onDirtyChange}
      />
    );
  }

  if (mode === 'shipping') {
    return (
      <ShippingDashboard
        canWrite={access.canManageShipments}
        customers={customers}
        jobs={jobs}
        shopId={shopId}
        shopProfile={shopProfile}
        onNotice={actions.onNotice}
      />
    );
  }

  if (mode === 'scheduling') {
    return (
      <SchedulingPage
        canWrite={access.canEditScheduling}
        customers={customers}
        jobs={jobs}
        shopId={shopId}
        onNotice={actions.onNotice}
        onDirtyChange={actions.onDirtyChange}
      />
    );
  }

  if (mode === 'drafts') {
    return (
      <OfflineDraftQueue
        drafts={offlineDrafts}
        selectedDraftId={selectedOfflineDraftId}
        onSelectDraft={actions.onSelectOfflineDraft}
        onSyncDraft={actions.onSyncOfflineDraft}
        onDiscardDraft={actions.onDiscardOfflineDraft}
        isOnline={isOnline}
        isSyncingDraftId={syncingDraftId}
        canWrite={access.canWrite}
        dateOptions={dateOptions}
        moneyOptions={moneyOptions}
      />
    );
  }

  if (mode === 'billing') {
    return (
      <BillingPage
        canManageShop={access.canViewBilling}
        entitlementSnapshot={billingAccess}
        shopProfile={shopProfile}
      />
    );
  }

  if (mode === 'operator') {
    return canAccessOperatorDashboard({ isOperator: access.isOperator })
      ? <BetaOperatorDashboard onNotice={actions.onNotice} />
      : (
        <section className="panel empty-state">
          <h2>Operator Access Required</h2>
          <p>This area is not available for your account.</p>
        </section>
      );
  }

  if (mode === 'detail') {
    return selectedJob
      ? (
        <>
          <SpecialistJobWorkspaceNav
            activeMode={mode}
            job={selectedJob}
            onSelectMode={actions.onSelectJobMode}
            canManageAccountingVoid={access.canEditShopSettings}
            onAccountingVoidChange={actions.onAccountingVoidChange}
            onNotice={actions.onNotice}
          />
          <JobDetail
            job={selectedJob}
            jobs={jobs}
            initialTab={getSpecialistRepairMode(selectedJob) ? 'billing' : 'overview'}
            onUpdate={actions.onUpdateJob}
            onImageUpload={actions.onImageUpload}
            onImageDelete={actions.onImageDelete}
            onRefresh={actions.onRefreshJobs}
            onClose={actions.onCloseJobDetail}
            onNotice={actions.onNotice}
            canWrite={access.canEditJobs}
            canManageJobCharges={access.canManageJobCharges}
            canRecordJobPayments={access.canRecordJobPayments}
            canIssuePaymentAdjustments={access.canIssuePaymentAdjustments}
            canFinalizeJobInvoices={access.canFinalizeJobInvoices}
            amplifierRepairEnabled={access.amplifierRepairEnabled}
            keyboardRepairEnabled={access.keyboardRepairEnabled}
            canUploadPhotos={access.canUploadPhotos}
            canEditPhotos={access.canEditPhotos}
            canOverwritePhotos={access.canOverwritePhotos}
            canDeletePhotos={access.canDeletePhotos}
            canSendEmail={access.canSendEmail}
            canScheduleEmail={access.canScheduleEmail}
            canSendSms={access.canSendSms}
            entitlementMessage={access.entitlementMessage}
            shopProfile={shopProfile}
            membership={membership}
            entitlementSnapshot={billingAccess}
            betaApproved={betaApproved}
            assignableMembers={assignableMembers}
            assignableMembersLoading={assignableMembersLoading}
            assignableMembersError={assignableMembersError}
            onAssignmentChanged={actions.onAssignmentChanged}
            onDirtyChange={actions.onDirtyChange}
            canManageAccountingVoid={access.canEditShopSettings}
            onAccountingVoidChange={actions.onAccountingVoidChange}
          />
        </>
      )
      : <section className="panel empty-state">Select a saved job from the list.</section>;
  }

  if (mode === 'guitar-detail') {
    return selectedJob
      ? (
        <>
          <SpecialistJobWorkspaceNav
            activeMode={mode}
            job={selectedJob}
            onSelectMode={actions.onSelectJobMode}
            canManageAccountingVoid={access.canEditShopSettings}
            onAccountingVoidChange={actions.onAccountingVoidChange}
            onNotice={actions.onNotice}
          />
          <GuitarJobDetail
            job={selectedJob}
            jobs={jobs}
            canWrite={access.canEditJobs && !selectedJob.accountingVoidedAt}
            canUploadPhotos={access.canUploadPhotos}
            dateOptions={dateOptions}
            onUpdate={actions.onUpdateJob}
            onImageUpload={actions.onImageUpload}
            onClose={actions.onCloseJobDetail}
            onDirtyChange={actions.onDirtyChange}
            onNotice={actions.onNotice}
            shopProfile={shopProfile}
          />
        </>
      )
      : <section className="panel empty-state">Select a guitar work order from the list.</section>;
  }

  if (mode === 'amplifier-detail') {
    return selectedJob
      ? (
        <>
          <SpecialistJobWorkspaceNav
            activeMode={mode}
            job={selectedJob}
            onSelectMode={actions.onSelectJobMode}
            canManageAccountingVoid={access.canEditShopSettings}
            onAccountingVoidChange={actions.onAccountingVoidChange}
            onNotice={actions.onNotice}
          />
          <AmplifierJobDetail
            job={selectedJob}
            canWrite={access.canEditAmplifierRepair && !selectedJob.accountingVoidedAt}
            canManageJobCharges={access.canManageJobCharges}
            dateOptions={dateOptions}
            onUpdate={actions.onUpdateJob}
            onClose={actions.onCloseJobDetail}
            onDirtyChange={actions.onDirtyChange}
            onNotice={actions.onNotice}
            onRefresh={actions.onRefreshJobs}
            onOpenInventory={actions.onOpenInventory}
            shopProfile={shopProfile}
          />
        </>
      )
      : <section className="panel empty-state">Select an amplifier work order from the list.</section>;
  }

  if (mode === 'keyboard-detail') {
    return selectedJob
      ? (
        <>
          <SpecialistJobWorkspaceNav
            activeMode={mode}
            job={selectedJob}
            onSelectMode={actions.onSelectJobMode}
            canManageAccountingVoid={access.canEditShopSettings}
            onAccountingVoidChange={actions.onAccountingVoidChange}
            onNotice={actions.onNotice}
          />
          <KeyboardJobDetail
            job={selectedJob}
            canWrite={access.canEditKeyboardRepair && !selectedJob.accountingVoidedAt}
            canManageJobCharges={access.canManageJobCharges}
            dateOptions={dateOptions}
            onUpdate={actions.onUpdateJob}
            onRefresh={actions.onRefreshJobs}
            onClose={actions.onCloseJobDetail}
            onDirtyChange={actions.onDirtyChange}
            onNotice={actions.onNotice}
            canSendEmail={access.canSendEmail}
            entitlementMessage={access.entitlementMessage}
            shopProfile={shopProfile}
            onOpenInventory={actions.onOpenInventory}
          />
        </>
      )
      : <section className="panel empty-state">Select a keyboard work order from the list.</section>;
  }

  return null;
}
