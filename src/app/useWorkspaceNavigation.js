import { useEffect, useRef, useState } from 'react';
import { canAccessOperatorDashboard } from '../modules/auth/permissionService.js';
import { resolveStoredWorkspaceState } from './workspaceState.js';

const WORKSPACE_STATE_PREFIX = 'frettrack_workspace_state';
const UNSAVED_CHANGES_MESSAGE = 'You have unsaved changes. Leave without saving?';

export default function useWorkspaceNavigation({
  shopId,
  jobs,
  isReady,
  access,
  onAccessDenied
}) {
  const [mode, setMode] = useState('new');
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [hasUnsavedPageChanges, setHasUnsavedPageChanges] = useState(false);
  const [hydratedShopId, setHydratedShopId] = useState('');
  const jobDetailReturnModeRef = useRef('new');

  useEffect(() => {
    if (!shopId || !isReady || hydratedShopId === shopId) {
      return;
    }

    const workspaceState = getStoredWorkspaceState(shopId);
    const restoredState = resolveStoredWorkspaceState({
      workspaceState,
      jobs,
      isAllowedMode: (storedMode) => isAllowedWorkspaceMode(storedMode, access)
    });
    setSelectedJobId(restoredState.selectedJobId);
    setMode(restoredState.mode);
    setHydratedShopId(shopId);
  }, [access.canManageShop, access.canViewBilling, access.canWrite, access.isOperator, hydratedShopId, isReady, shopId, jobs]);

  useEffect(() => {
    if (!shopId || !isReady || hydratedShopId !== shopId) {
      return;
    }

    saveWorkspaceState(shopId, { mode, selectedJobId });
  }, [hydratedShopId, isReady, shopId, mode, selectedJobId]);

  function confirmUnsavedNavigation() {
    if (!hasUnsavedPageChanges) {
      return true;
    }

    return window.confirm(UNSAVED_CHANGES_MESSAGE);
  }

  function navigateTo(nextMode) {
    if (!isAllowedWorkspaceMode(nextMode, access)) {
      onAccessDenied?.();
      setMode('new');
      return false;
    }

    if (!confirmUnsavedNavigation()) {
      return false;
    }

    setHasUnsavedPageChanges(false);
    setMode(nextMode);
    return true;
  }

  function selectJob(jobId) {
    if (!confirmUnsavedNavigation()) {
      return false;
    }

    if (mode !== 'detail') {
      jobDetailReturnModeRef.current = mode;
    }
    setHasUnsavedPageChanges(false);
    setSelectedJobId(jobId);
    setMode('detail');
    return true;
  }

  function closeJobDetail() {
    setHasUnsavedPageChanges(false);
    setMode(jobDetailReturnModeRef.current || 'new');
  }

  function resetWorkspaceNavigation() {
    setHasUnsavedPageChanges(false);
    setSelectedJobId(null);
    setMode('new');
    setHydratedShopId('');
    jobDetailReturnModeRef.current = 'new';
  }

  return {
    mode,
    selectedJobId,
    hasUnsavedPageChanges,
    setMode,
    setSelectedJobId,
    setHasUnsavedPageChanges,
    confirmUnsavedNavigation,
    navigateTo,
    selectJob,
    closeJobDetail,
    resetWorkspaceNavigation
  };
}

function getWorkspaceStateKey(shopId) {
  return `${WORKSPACE_STATE_PREFIX}:${shopId || 'unknown'}`;
}

function getStoredWorkspaceState(shopId) {
  try {
    return JSON.parse(localStorage.getItem(getWorkspaceStateKey(shopId))) || {};
  } catch {
    return {};
  }
}

function saveWorkspaceState(shopId, state) {
  try {
    localStorage.setItem(getWorkspaceStateKey(shopId), JSON.stringify(state));
  } catch {
    // Workspace persistence is best effort only.
  }
}

export function isAllowedWorkspaceMode(mode, {
  isOperator = false,
  canManageShop = false,
  canViewBilling = false,
  canWrite = false
} = {}) {
  if (mode === 'operator') {
    return canAccessOperatorDashboard({ isOperator });
  }

  if (mode === 'billing') {
    return canViewBilling;
  }

  if (mode === 'drafts') {
    return canWrite;
  }

  return [
    'new',
    'list',
    'detail',
    'settings',
    'customers',
    'inventory',
    'shipping',
    'scheduling',
    'reports',
    'accounting'
  ].includes(mode);
}
