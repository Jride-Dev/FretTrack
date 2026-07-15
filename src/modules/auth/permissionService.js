import {
  canManageTeamMembers as hasTeamMembersEntitlement,
  canUseAdvancedReporting,
  canUsePhotoEditor as hasPhotoEditorEntitlement,
  isReadOnlyStatus
} from '../billing/entitlementService';

const SHOP_WRITE_ROLES = new Set(['owner', 'admin', 'tech']);
const SHOP_MANAGE_ROLES = new Set(['owner', 'admin']);
const SHOP_OWNER_ROLES = new Set(['owner']);

function normalizeRole(role) {
  return String(role || '').toLowerCase();
}

function hasShopWriteRole(role) {
  return SHOP_WRITE_ROLES.has(normalizeRole(role));
}

function canWriteShop({ role, entitlementSnapshot } = {}) {
  return hasShopWriteRole(role) && !isReadOnlyStatus(entitlementSnapshot);
}

export function canAccessOperatorDashboard({ isOperator } = {}) {
  return Boolean(isOperator);
}

export function canManageShopSettings({ role } = {}) {
  return SHOP_MANAGE_ROLES.has(normalizeRole(role));
}

export function canViewBilling({ role } = {}) {
  return SHOP_MANAGE_ROLES.has(normalizeRole(role));
}

export function canManageBilling({ role, entitlementSnapshot } = {}) {
  return SHOP_OWNER_ROLES.has(normalizeRole(role)) && !isReadOnlyStatus(entitlementSnapshot);
}

export function canAccessShopAsMember({ role, entitlementSnapshot } = {}) {
  const normalizedRole = normalizeRole(role);
  if (!normalizedRole) {
    return false;
  }

  if (normalizedRole === 'owner') {
    return true;
  }

  return hasTeamMembersEntitlement(entitlementSnapshot);
}

export function canManageSubscriptionSettings({ isOperator } = {}) {
  return Boolean(isOperator);
}

export function canManageBetaAccess({ isOperator } = {}) {
  return Boolean(isOperator);
}

export function canManageInventory({ role, entitlementSnapshot } = {}) {
  return canWriteShop({ role, entitlementSnapshot });
}

export function canManageVendors({ role, entitlementSnapshot } = {}) {
  return canManageInventory({ role, entitlementSnapshot });
}

export function canManagePurchaseOrders({ role, entitlementSnapshot } = {}) {
  return canManageInventory({ role, entitlementSnapshot });
}

export function canEditCustomers({ role, entitlementSnapshot } = {}) {
  return canWriteShop({ role, entitlementSnapshot });
}

export function canPreviewCustomerImport({ role, entitlementSnapshot } = {}) {
  return SHOP_MANAGE_ROLES.has(normalizeRole(role)) && !isReadOnlyStatus(entitlementSnapshot);
}

export function canEditScheduling({ role, entitlementSnapshot } = {}) {
  return canWriteShop({ role, entitlementSnapshot });
}

export function canEditJobs({ role, entitlementSnapshot } = {}) {
  return canWriteShop({ role, entitlementSnapshot });
}

export function canManageShipments({ role, entitlementSnapshot } = {}) {
  return canWriteShop({ role, entitlementSnapshot });
}

export function canWriteShipping({ role, entitlementSnapshot } = {}) {
  return canManageShipments({ role, entitlementSnapshot });
}

export function canManageCustodyEvents({ role, entitlementSnapshot } = {}) {
  return canManageShipments({ role, entitlementSnapshot });
}

export function canVoidShipments({ role, entitlementSnapshot } = {}) {
  return SHOP_MANAGE_ROLES.has(normalizeRole(role)) && !isReadOnlyStatus(entitlementSnapshot);
}

export function canUploadPhotos({ role, entitlementSnapshot } = {}) {
  return canWriteShop({ role, entitlementSnapshot });
}

export function canUsePhotoEditor({ role, entitlementSnapshot } = {}) {
  return canUploadPhotos({ role, entitlementSnapshot }) && hasPhotoEditorEntitlement(entitlementSnapshot);
}

export function canEditPhotos({ role, entitlementSnapshot } = {}) {
  return canUsePhotoEditor({ role, entitlementSnapshot });
}

export function canOverwritePhotos({ role, entitlementSnapshot } = {}) {
  return canUsePhotoEditor({ role, entitlementSnapshot });
}

export function canDeletePhotos({ role, entitlementSnapshot } = {}) {
  return canUploadPhotos({ role, entitlementSnapshot });
}

export function canViewAdvancedReporting({ entitlementSnapshot } = {}) {
  return canUseAdvancedReporting(entitlementSnapshot);
}

export function canManageTeamMembers({ role, entitlementSnapshot } = {}) {
  return canWriteShop({ role, entitlementSnapshot })
    && SHOP_MANAGE_ROLES.has(normalizeRole(role))
    && hasTeamMembersEntitlement(entitlementSnapshot);
}

export function getShopWriteAccess({ role, entitlementSnapshot, hasSupabaseConfig = true } = {}) {
  if (!hasSupabaseConfig) {
    return true;
  }

  return canWriteShop({ role, entitlementSnapshot });
}

export function getCurrentAccessPermissions({ isOperator, role, entitlementSnapshot } = {}) {
  const context = { role, entitlementSnapshot };
  return {
    canAccessOperatorDashboard: canAccessOperatorDashboard({ isOperator }),
    canManageBilling: canManageBilling(context),
    canManageCustodyEvents: canManageCustodyEvents(context),
    canManageInventory: canManageInventory(context),
    canManagePurchaseOrders: canManagePurchaseOrders(context),
    canManageShopSettings: canManageShopSettings(context),
    canManageTeamMembers: canManageTeamMembers(context),
    canManageVendors: canManageVendors(context),
    canViewAdvancedReports: canViewAdvancedReporting(context),
    canViewBilling: canViewBilling(context),
    canWriteShipping: canWriteShipping(context),
    canEditCustomers: canEditCustomers(context),
    canEditJobs: canEditJobs(context),
    canEditPhotos: canEditPhotos(context),
    canEditScheduling: canEditScheduling(context),
    canDeletePhotos: canDeletePhotos(context),
    canOverwritePhotos: canOverwritePhotos(context),
    canUploadPhotos: canUploadPhotos(context),
    canUsePhotoEditor: canUsePhotoEditor(context)
  };
}
