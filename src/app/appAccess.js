import {
  canDeletePhotos as canDeletePhotosForRole,
  canEditCustomers as canEditCustomersForRole,
  canEditJobs as canEditJobsForRole,
  canEditPhotos as canEditPhotosForRole,
  canEditScheduling as canEditSchedulingForRole,
  canManageInventory as canManageInventoryForRole,
  canManageShipments as canManageShipmentsForRole,
  canManageTeamMembers as canManageTeamMembersForRole,
  canManageShopSettings,
  canOverwritePhotos as canOverwritePhotosForRole,
  canPreviewCustomerImport as canPreviewCustomerImportForRole,
  canUploadPhotos as canUploadPhotosForRole,
  canViewBilling as canViewBillingForRole,
  getShopWriteAccess
} from '../modules/auth/permissionService.js';
import {
  canUseTeamAssignment,
  getEffectiveStatus,
  isReadOnlyStatus
} from '../modules/billing/entitlementService.js';

export function getAppAccess({
  membership,
  billingAccess,
  betaApproved,
  hasSupabaseConfig
}) {
  const permissionContext = {
    role: membership?.role,
    entitlementSnapshot: billingAccess,
    betaApproved
  };
  const canEditJobs = !hasSupabaseConfig || canEditJobsForRole(permissionContext);
  const canWrite = hasSupabaseConfig
    ? getShopWriteAccess({ ...permissionContext, hasSupabaseConfig })
    : canEditJobs;
  const canManageShop = !hasSupabaseConfig || canManageShopSettings({ role: membership?.role });

  return {
    permissionContext,
    canEditJobs,
    canWrite,
    canManageShop,
    canEditShopSettings: canManageShop && canWrite,
    canManageTeamMembers: !hasSupabaseConfig || canManageTeamMembersForRole(permissionContext),
    canManageInventory: !hasSupabaseConfig || canManageInventoryForRole(permissionContext),
    canManageShipments: !hasSupabaseConfig || canManageShipmentsForRole(permissionContext),
    canEditCustomers: !hasSupabaseConfig || canEditCustomersForRole(permissionContext),
    canEditScheduling: !hasSupabaseConfig || canEditSchedulingForRole(permissionContext),
    canPreviewCustomerImport: !hasSupabaseConfig || canPreviewCustomerImportForRole(permissionContext),
    canUploadPhotos: !hasSupabaseConfig || canUploadPhotosForRole(permissionContext),
    canEditPhotos: !hasSupabaseConfig || canEditPhotosForRole(permissionContext),
    canOverwritePhotos: !hasSupabaseConfig || canOverwritePhotosForRole(permissionContext),
    canDeletePhotos: !hasSupabaseConfig || canDeletePhotosForRole(permissionContext),
    canViewBilling: !hasSupabaseConfig || canViewBillingForRole(permissionContext),
    canSendEmail: canWrite && billingAccess.access?.canSendEmail !== false,
    canSendSms: canWrite && billingAccess.access?.canSendSms === true,
    teamAssignmentEnabled: canUseTeamAssignment(billingAccess, { betaApproved }),
    entitlementMessage: getEntitlementMessage(billingAccess)
  };
}

function getEntitlementMessage(entitlementSnapshot) {
  if (getEffectiveStatus(entitlementSnapshot) === 'expired') {
    return 'Trial expired. Viewing, printing, and exports remain available where safe, but new writes and customer messages require upgraded access.';
  }

  if (isReadOnlyStatus(entitlementSnapshot)) {
    return 'This shop is read-only. Viewing, printing, and exports remain available, but new writes and customer messages are paused.';
  }

  return '';
}
