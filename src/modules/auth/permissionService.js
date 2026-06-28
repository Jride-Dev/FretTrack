import {
  canManageTeamMembers as hasTeamMembersEntitlement,
  canUseAdvancedReporting,
  canUsePhotoEditor as hasPhotoEditorEntitlement,
  isReadOnlyStatus
} from '../billing/entitlementService';

const SHOP_WRITE_ROLES = new Set(['owner', 'admin', 'tech']);
const SHOP_MANAGE_ROLES = new Set(['owner', 'admin']);

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

export function canEditCustomers({ role, entitlementSnapshot } = {}) {
  return canWriteShop({ role, entitlementSnapshot });
}

export function canPreviewCustomerImport({ role, entitlementSnapshot } = {}) {
  return SHOP_MANAGE_ROLES.has(normalizeRole(role)) && !isReadOnlyStatus(entitlementSnapshot);
}

export function canEditScheduling({ role, entitlementSnapshot } = {}) {
  return canWriteShop({ role, entitlementSnapshot });
}

export function canUploadPhotos({ role, entitlementSnapshot } = {}) {
  return canWriteShop({ role, entitlementSnapshot }) && entitlementSnapshot?.access?.canUploadPhotos !== false;
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
