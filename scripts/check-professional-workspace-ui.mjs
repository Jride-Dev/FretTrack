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
assert.match(styles, /grid-template-columns: var\(--workspace-nav-width\) minmax\(0, 1fr\)/, 'Desktop workspace chrome must use the restrained navigation rail.');
assert.match(styles, /@media \(max-width: 1080px\)/, 'The workspace chrome must include a tablet navigation layout.');
assert.match(styles, /@media \(max-width: 760px\)/, 'The workspace chrome must include a mobile navigation layout.');
assert.doesNotMatch(styles, /linear-gradient|radial-gradient|border-radius:\s*999px/, 'The professional UI layer must not reintroduce decorative gradients or pill controls.');

console.log('Professional workspace UI checks passed.');
