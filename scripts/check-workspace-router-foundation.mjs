import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const appPath = path.join(root, 'src', 'app', 'App.jsx');
const routerPath = path.join(root, 'src', 'app', 'WorkspaceRouter.jsx');
const navigationPath = path.join(root, 'src', 'app', 'useWorkspaceNavigation.js');
const workspaceStatePath = path.join(root, 'src', 'app', 'workspaceState.js');
const appSource = fs.readFileSync(appPath, 'utf8');
const routerSource = fs.readFileSync(routerPath, 'utf8');
const navigationSource = fs.readFileSync(navigationPath, 'utf8');
const { resolveStoredWorkspaceState } = await import(pathToFileURL(workspaceStatePath));

assert.match(
  appSource,
  /import WorkspaceRouter from ['"]\.\/WorkspaceRouter\.jsx['"]/,
  'App must use the workspace page boundary.'
);
assert.match(appSource, /import useWorkspaceNavigation from ['"]\.\/useWorkspaceNavigation\.js['"]/, 'App must use the workspace navigation boundary.');
assert.match(appSource, /useWorkspaceNavigation\(\{/, 'App must obtain workspace state from the navigation hook.');
assert.doesNotMatch(appSource, /useState\(['"]new['"]\)/, 'App must not own workspace mode state directly.');
assert.doesNotMatch(appSource, /jobDetailReturnModeRef/, 'App must not own Job Detail return navigation state directly.');
assert.match(navigationSource, /function navigateTo\(nextMode\)/, 'Workspace navigation must own permission-aware page transitions.');
assert.match(navigationSource, /function selectJob\(jobId\)/, 'Workspace navigation must own job-detail selection transitions.');
assert.match(navigationSource, /function closeJobDetail\(\)/, 'Workspace navigation must own Job Detail close transitions.');
assert.match(navigationSource, /saveWorkspaceState\(shopId, \{ mode, selectedJobId \}\)/, 'Workspace navigation must persist page and selection state.');
assert.match(navigationSource, /window\.confirm\(UNSAVED_CHANGES_MESSAGE\)/, 'Workspace navigation must preserve the dirty-state confirmation.');
assert.match(
  navigationSource,
  /hydratedShopId !== shopId[\s\S]*?return;[\s\S]*?saveWorkspaceState/,
  'Workspace persistence must wait until the saved page has been restored for the current shop.'
);

for (const restoredMode of ['inventory', 'scheduling', 'customers', 'reports']) {
  assert.deepEqual(
    resolveStoredWorkspaceState({ workspaceState: { mode: restoredMode }, isAllowedMode: () => true }),
    { mode: restoredMode, selectedJobId: null },
    `${restoredMode} must survive a refresh once the shop is ready.`
  );
}

assert.deepEqual(
  resolveStoredWorkspaceState({
    workspaceState: { mode: 'detail', selectedJobId: 'job-2' },
    jobs: [{ id: 'job-1' }, { id: 'job-2' }]
  }),
  { mode: 'detail', selectedJobId: 'job-2' },
  'A saved Job Detail must restore when the selected job belongs to the loaded shop data.'
);
assert.deepEqual(
  resolveStoredWorkspaceState({
    workspaceState: { mode: 'detail', selectedJobId: 'missing-job' },
    jobs: [{ id: 'job-1' }]
  }),
  { mode: 'new', selectedJobId: null },
  'A stale Job Detail selection must fall back safely after refresh.'
);
assert.match(routerSource, /import \{ lazy, Suspense \} from ['"]react['"]/, 'Workspace pages must use the shared lazy-loading boundary.');
assert.match(routerSource, /<Suspense fallback=/, 'Workspace pages must provide a loading state while their module loads.');
assert.match(
  appSource,
  /<WorkspaceRouter[\s\S]*?mode=\{mode\}/,
  'App must delegate the active workspace mode to WorkspaceRouter.'
);

const expectedModes = [
  'new',
  'list',
  'settings',
  'customers',
  'accounting',
  'reports',
  'inventory',
  'shipping',
  'scheduling',
  'drafts',
  'billing',
  'operator',
  'detail'
];

for (const mode of expectedModes) {
  assert.match(
    routerSource,
    new RegExp(`mode === ['"]${mode}['"]`),
    `WorkspaceRouter must preserve the ${mode} workspace mode.`
  );
}

const expectedPages = [
  'CurrentJobsPage',
  'ShopSettings',
  'CustomerManager',
  'AccountingReports',
  'AdvancedReportsPage',
  'InventoryPage',
  'ShippingDashboard',
  'SchedulingPage',
  'OfflineDraftQueue',
  'BillingPage',
  'BetaOperatorDashboard',
  'JobDetail'
];

for (const page of expectedPages) {
  assert.match(
    routerSource,
    new RegExp(`<${page}\\b`),
    `WorkspaceRouter must retain the ${page} page.`
  );
}

for (const page of [
  'AccountingReports',
  'BillingPage',
  'CustomerManager',
  'InventoryPage',
  'CurrentJobsPage',
  'JobDetail',
  'OfflineDraftQueue',
  'AdvancedReportsPage',
  'SchedulingPage',
  'ShippingDashboard'
]) {
  assert.match(
    routerSource,
    new RegExp(`const ${page} = lazy\\(\\(\\) => import\\(`),
    `${page} must load through the workspace module boundary.`
  );
}

assert.match(routerSource, /onDirtyChange=\{actions\.onDirtyChange\}/, 'Module dirty-state callbacks must remain connected.');
assert.match(routerSource, /onClose=\{actions\.onCloseJobDetail\}/, 'Job Detail must retain the established close handler.');
assert.match(routerSource, /canWrite=\{access\.canEditJobs\}/, 'Job write permissions must remain connected.');
assert.match(routerSource, /canWrite=\{access\.canManageInventory\}/, 'Inventory write permissions must remain connected.');
assert.match(routerSource, /canWrite=\{access\.canEditScheduling\}/, 'Scheduling write permissions must remain connected.');
assert.doesNotMatch(routerSource, /supabase/i, 'The workspace router must not load or mutate Supabase data directly.');

const extractedPageImports = [
  'AccountingReports',
  'BillingPage',
  'CustomerManager',
  'InventoryPage',
  'JobDetail',
  'CurrentJobsPage',
  'OfflineDraftQueue',
  'AdvancedReportsPage',
  'SchedulingPage',
  'ShippingDashboard'
];

for (const page of extractedPageImports) {
  assert.doesNotMatch(
    appSource,
    new RegExp(`import[^;]*\\b${page}\\b`),
    `App must not directly import the extracted ${page} page.`
  );
}

console.log('Workspace router foundation checks passed.');
