import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const app = read('src/app/App.jsx');
const scheduling = read('src/modules/scheduling/SchedulingPage.jsx');
const styles = read('src/styles/professional-ui.css');
const docs = read('docs/PROFESSIONAL_WORKSPACE_UI.md');
const publicDocs = read('cloudflare/frettrack-coming-soon/public/docs/scheduling.html');

assert.match(scheduling, /<WorkspacePageHeader/, 'Scheduling must use the shared professional page heading.');
assert.match(scheduling, /className="schedule-toolbar"/, 'Scheduling must retain its filter toolbar.');
assert.match(scheduling, /className="week-grid"/, 'Scheduling must retain the week grid.');
assert.match(app, /\[(?:'new', )?'list', 'customers', 'inventory', 'scheduling',/, 'Scheduling must use the full-width workspace.');
assert.match(styles, /\.scheduling-page > \.workspace-page-header/, 'Professional scheduling styling must include the page heading boundary.');
assert.match(styles, /\.scheduling-page \.schedule-layout/, 'Professional scheduling styling must contain the week/editor layout.');
assert.match(styles, /\.scheduling-page \.schedule-card/, 'Professional scheduling styling must contain event cards.');
assert.match(docs, /## Scheduling/, 'Professional workspace documentation must describe scheduling.');
assert.match(publicDocs, /week view/i, 'Public scheduling guidance must describe the week view.');
assert.doesNotMatch(scheduling, /\bsupabase\b|\.from\s*\(\s*['"]/i, 'Scheduling presentation must not introduce direct database access.');

console.log('Professional Scheduling UI checks passed.');
