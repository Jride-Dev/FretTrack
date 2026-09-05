import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const appPath = path.join(root, 'src', 'app', 'App.jsx');
const routerPath = path.join(root, 'src', 'app', 'WorkspaceRouter.jsx');
const navigationPath = path.join(root, 'src', 'app', 'useWorkspaceNavigation.js');
const jobWorkspaceDataPath = path.join(root, 'src', 'app', 'useJobWorkspaceData.js');
const jobWorkspaceActionsPath = path.join(root, 'src', 'app', 'useJobWorkspaceActions.js');
const sessionShopBootstrapPath = path.join(root, 'src', 'app', 'useSessionShopBootstrap.js');
const workspaceStatePath = path.join(root, 'src', 'app', 'workspaceState.js');
const appAccessPath = path.join(root, 'src', 'app', 'appAccess.js');
const appSource = fs.readFileSync(appPath, 'utf8');
const routerSource = fs.readFileSync(routerPath, 'utf8');
const navigationSource = fs.readFileSync(navigationPath, 'utf8');
const jobWorkspaceDataSource = fs.readFileSync(jobWorkspaceDataPath, 'utf8');
const jobWorkspaceActionsSource = fs.readFileSync(jobWorkspaceActionsPath, 'utf8');
const sessionShopBootstrapSource = fs.readFileSync(sessionShopBootstrapPath, 'utf8');
const appAccessSource = fs.readFileSync(appAccessPath, 'utf8');
const { resolveStoredWorkspaceState } = await import(pathToFileURL(workspaceStatePath));

assert.match(
  appSource,
  /import WorkspaceRouter from ['"]\.\/WorkspaceRouter\.jsx['"]/,
  'App must use the workspace page boundary.'
);
assert.match(appSource, /import useWorkspaceNavigation from ['"]\.\/useWorkspaceNavigation\.js['"]/, 'App must use the workspace navigation boundary.');
assert.match(appSource, /import useJobWorkspaceData from ['"]\.\/useJobWorkspaceData\.js['"]/, 'App must use the job workspace data boundary.');
assert.match(appSource, /import useJobWorkspaceActions from ['"]\.\/useJobWorkspaceActions\.js['"]/, 'App must use the job workspace action boundary.');
assert.match(appSource, /import useSessionShopBootstrap from ['"]\.\/useSessionShopBootstrap\.js['"]/, 'App must use the session and shop bootstrap boundary.');
assert.ok(appSource.split(/\r?\n/).length < 900, 'App must remain a composition surface instead of regaining session and shop bootstrap implementation.');
assert.doesNotMatch(appSource, /getCurrentSession|onAuthSessionChange|bootstrapCurrentUserAsOwner|getCurrentUserShopMemberships/, 'Session and shop bootstrap service calls must stay behind the focused controller.');
assert.match(appSource, /import \{ getAppAccess \} from ['"]\.\/appAccess\.js['"]/, 'App must use the derived access boundary.');
assert.match(appSource, /getAppAccess\(\{ membership, billingAccess, betaApproved, hasSupabaseConfig \}\)/, 'App must derive feature access through one boundary.');
assert.doesNotMatch(appSource, /canEditJobsForRole|canManageInventoryForRole|canUploadPhotosForRole/, 'App must not derive individual feature permissions inline.');
for (const accessRule of ['canEditJobsForRole', 'canManageInventoryForRole', 'canManageShipmentsForRole', 'canEditSchedulingForRole', 'canUploadPhotosForRole']) {
  assert.match(appAccessSource, new RegExp(accessRule), `App access must preserve ${accessRule}.`);
}
assert.doesNotMatch(appSource, /<JobForm\b|<JobList\b|<UpcomingSchedulePanel\b/, 'App must not render sidebar module internals directly.');
assert.doesNotMatch(appSource, /NewJobSidebar|new-job-sidebar/, 'The retired legacy sidebar must not be mounted.');
assert.match(appSource, /useWorkspaceNavigation\(\{/, 'App must obtain workspace state from the navigation hook.');
assert.match(appSource, /jobsReadyShopId === membership\.shopId[\s\S]*?!isWorkspaceReady[\s\S]*?Loading shop workspace/, 'Hosted workspace restoration must wait for current-shop jobs and navigation hydration instead of flashing the generic workspace.');
assert.match(jobWorkspaceDataSource, /if \(selectedShopId !== requestedShopId\) \{[\s\S]*?return null;[\s\S]*?const requestId = \+\+jobsRequestIdRef\.current;[\s\S]*?requestId !== jobsRequestIdRef\.current \|\| activeShopId !== requestedShopId[\s\S]*?return null;[\s\S]*?setJobs\(sortedJobs\);[\s\S]*?setJobsReadyShopId\(requestedShopId\)/, 'Only the latest response for the selected shop may publish jobs or mark the workspace ready.');
assert.match(sessionShopBootstrapSource, /const requestId = \+\+shopAccessRequestIdRef\.current;[\s\S]*?const isCurrentRequest = \(\) => requestId === shopAccessRequestIdRef\.current;[\s\S]*?if \(!isCurrentRequest\(\)\) return null;[\s\S]*?const loadedJobs = await refreshJobs\(currentMembership\.shopId\);[\s\S]*?if \(!isCurrentRequest\(\) \|\| !loadedJobs\) return null;/, 'A superseded shop bootstrap must stop before publishing another shop\'s workspace data.');
assert.match(jobWorkspaceDataSource, /const requestId = \+\+customersRequestIdRef\.current;[\s\S]*?requestId !== customersRequestIdRef\.current \|\| activeShopId !== requestedShopId[\s\S]*?return null;[\s\S]*?setCustomers\(loadedCustomers\)/, 'Customer refreshes must reject stale or cross-shop responses.');
assert.match(jobWorkspaceActionsSource, /if \(!options\.expectedUpdatedAt\)[\s\S]*?const savedJob = await updateJob\(job, options\);[\s\S]*?selectedJobIdRef\.current !== job\.id/, 'Job updates must retain optimistic local saves and protect a newly selected job from a stale save response.');
assert.match(jobWorkspaceActionsSource, /if \(!access\.canEditShopSettings\)[\s\S]*?setJobAccountingVoid\(jobId, voided, reason\)/, 'Accounting exclusion must remain behind writable owner or admin access.');
assert.match(jobWorkspaceActionsSource, /if \(!access\.canUploadPhotos\)[\s\S]*?uploadJobImages\(job, files, \{ category: 'job'/, 'Photo upload actions must preserve entitlement enforcement and job image persistence.');
assert.doesNotMatch(appSource, /useState\(['"]new['"]\)/, 'App must not own workspace mode state directly.');
assert.doesNotMatch(appSource, /jobDetailReturnModeRef/, 'App must not own Job Detail return navigation state directly.');
assert.match(navigationSource, /function navigateTo\(nextMode, \{ skipDirtyGuard = false \} = \{\}\)/, 'Workspace navigation must own permission-aware page transitions.');
assert.match(navigationSource, /function selectJob\(jobId, detailMode = 'detail', \{ skipDirtyGuard = false \} = \{\}\)/, 'Workspace navigation must own job-detail selection transitions, focused detail targets, and explicit safe post-save transitions.');
assert.match(navigationSource, /function closeJobDetail\(\)/, 'Workspace navigation must own Job Detail close transitions.');
assert.match(navigationSource, /saveWorkspaceState\(shopId, \{ mode, selectedJobId \}\)/, 'Workspace navigation must persist page and selection state.');
assert.match(navigationSource, /window\.confirm\(UNSAVED_CHANGES_MESSAGE\)/, 'Workspace navigation must preserve the dirty-state confirmation.');
assert.match(
  navigationSource,
  /if \(hasUserNavigatedRef\.current\) \{\s*setHydratedShopId\(shopId\);\s*return;/,
  'A deliberate navigation action must win over late workspace hydration.'
);
assert.match(
  navigationSource,
  /hydratedShopId !== shopId[\s\S]*?return;[\s\S]*?saveWorkspaceState/,
  'Workspace persistence must wait until the saved page has been restored for the current shop.'
);

for (const restoredMode of ['inventory', 'scheduling', 'customers', 'messages', 'reports']) {
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
    workspaceState: { mode: 'guitar-detail', selectedJobId: 'guitar-1' },
    jobs: [{ id: 'guitar-1', instrumentType: 'Electric' }]
  }),
  { mode: 'guitar-detail', selectedJobId: 'guitar-1' },
  'A saved guitar repair bench must remain open after refresh.'
);
assert.deepEqual(
  resolveStoredWorkspaceState({
    workspaceState: { mode: 'detail', selectedJobId: 'amp-1' },
    jobs: [{ id: 'amp-1', instrumentType: 'Amplifier' }]
  }),
  { mode: 'detail', selectedJobId: 'amp-1' },
  'An amplifier commercial work order must remain open after refresh.'
);
assert.deepEqual(
  resolveStoredWorkspaceState({
    workspaceState: { mode: 'amplifier-detail', selectedJobId: 'amp-1' },
    jobs: [{ id: 'amp-1', instrumentType: 'Amplifier' }]
  }),
  { mode: 'amplifier-detail', selectedJobId: 'amp-1' },
  'A saved amplifier repair bench must remain open after refresh.'
);
assert.deepEqual(
  resolveStoredWorkspaceState({
    workspaceState: { mode: 'detail', selectedJobId: 'keyboard-1' },
    jobs: [{ id: 'keyboard-1', instrumentType: 'Keyboard' }]
  }),
  { mode: 'detail', selectedJobId: 'keyboard-1' },
  'A keyboard commercial work order must remain open after refresh.'
);
assert.deepEqual(
  resolveStoredWorkspaceState({
    workspaceState: { mode: 'keyboard-detail', selectedJobId: 'keyboard-1' },
    jobs: [{ id: 'keyboard-1', instrumentType: 'Keyboard' }]
  }),
  { mode: 'keyboard-detail', selectedJobId: 'keyboard-1' },
  'A saved keyboard repair bench must remain open after refresh.'
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
  'messages',
  'accounting',
  'reports',
  'inventory',
  'shipping',
  'scheduling',
  'drafts',
  'billing',
  'operator',
  'detail',
  'guitar-detail',
  'amplifiers',
  'amplifier-detail'
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
  'MessagesInboxPage',
  'AccountingReports',
  'AdvancedReportsPage',
  'InventoryPage',
  'ShippingDashboard',
  'SchedulingPage',
  'OfflineDraftQueue',
  'BillingPage',
  'BetaOperatorDashboard',
  'GuitarJobDetail',
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
  'MessagesInboxPage',
  'InventoryPage',
  'CurrentJobsPage',
  'GuitarJobDetail',
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
  'MessagesInboxPage',
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
