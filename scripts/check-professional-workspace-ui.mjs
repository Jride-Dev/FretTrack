import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const app = read('src/app/App.jsx');
const shell = read('src/app/WorkspaceShellHeader.jsx');
const currentJobs = read('src/modules/jobs/CurrentJobsPage.jsx');
const preferences = read('src/app/useAppPreferences.js');
const themes = read('src/shared/theme/themes.js');
const main = read('src/main.jsx');
const styles = read('src/styles/professional-ui.css');
const jobForm = read('src/modules/jobs/JobForm.jsx');
const jobDetailHeader = read('src/modules/jobs/JobDetailHeader.jsx');
const jobDetailTabs = read('src/modules/jobs/components/JobDetailTabs.jsx');
const pageHeader = read('src/shared/components/WorkspacePageHeader.jsx');
const section = read('src/shared/components/WorkspaceSection.jsx');
const router = read('src/app/WorkspaceRouter.jsx');

assert.match(app, /<WorkspaceShellHeader/, 'The application must use the shared professional workspace shell.');
assert.match(shell, /aria-label="FretTrack workspace"/, 'The workspace navigation must be explicitly labeled.');
for (const group of ['Workspace', 'Repair', 'Operations', 'Insights', 'Administration']) {
  assert.ok(shell.includes(`label="${group}"`), `The workspace shell must keep the ${group} navigation group.`);
}
assert.match(shell, /aria-label="New Job"/, 'The professional New Work Order action must retain the established accessible name.');
assert.match(shell, /aria-label="Save Job"/, 'The professional Save Work Order action must retain the established accessible name.');

assert.match(themes, /value: 'system'/, 'Theme options must include the device color-scheme preference.');
assert.match(preferences, /prefers-color-scheme: dark/, 'The device theme must follow the operating-system color scheme.');
assert.match(preferences, /dataset\.themePreference = theme/, 'The selected theme preference must remain observable separately from the resolved theme.');
assert.match(main, /styles\/professional-ui\.css/, 'Professional UI overrides must load after the established application styles.');

assert.match(currentJobs, /current-jobs-metrics/, 'Current Jobs must show the operational summary strip.');
assert.match(currentJobs, /New Work Order/, 'Current Jobs must expose a prominent creation action.');
assert.match(currentJobs, /job-status-badge/, 'Current Jobs must use consistent status badges.');
assert.match(jobForm, /<WorkspacePageHeader/, 'New Work Order must use the shared page-heading primitive.');
assert.match(jobForm, /<WorkspaceSection/g, 'New Work Order must use the shared form-section primitive.');
assert.match(jobForm, /className="work-order-form-actions"/, 'New Work Order must keep its primary action in the shared action bar.');
assert.match(jobDetailHeader, /<WorkspacePageHeader/, 'Job Detail must use the shared page-heading primitive.');
assert.match(jobDetailTabs, /role="tabpanel"/, 'Job Detail must expose the active workspace panel to assistive technology.');
assert.match(jobDetailTabs, /aria-controls=\{`job-tab-panel-\$\{tab\.key\}`\}/, 'Each Job Detail tab must target the active panel.');
assert.match(pageHeader, /workspace-page-header/, 'The shared page-heading primitive must retain its styling contract.');
assert.match(section, /workspace-section-body/, 'The shared section primitive must retain its content boundary.');
assert.doesNotMatch(router, /Enter a new job on the left/, 'New Work Order must not retain the obsolete left-column instruction.');
assert.match(router, /className="new-work-order-page"/, 'New Work Order must render as a full-width workspace page.');
assert.match(app, /!\['new', 'list', 'customers',/, 'New Work Order must not mount the legacy left-side sidebar.');
assert.match(styles, /grid-template-columns: var\(--workspace-nav-width\) minmax\(0, 1fr\)/, 'Desktop workspace chrome must use the restrained navigation rail.');
assert.match(styles, /\.work-order-form\.panel/, 'Professional New Work Order styling must remain in the final override layer.');
assert.match(styles, /\.workspace-detail-shell \.job-tab-bar button\.active/, 'Professional Job Detail tabs must retain their restrained active state.');
assert.match(styles, /@media \(max-width: 1080px\)/, 'The workspace chrome must include a tablet navigation layout.');
assert.match(styles, /@media \(max-width: 760px\)/, 'The workspace chrome must include a mobile navigation layout.');
assert.match(styles, /\.current-job-row\s*\{\s*white-space: normal;/, 'Mobile job cards must override the global nowrap button rule.');
assert.doesNotMatch(styles, /linear-gradient|radial-gradient|border-radius:\s*999px/, 'The professional UI layer must not reintroduce decorative gradients or pill controls.');

console.log('Professional workspace UI checks passed.');
