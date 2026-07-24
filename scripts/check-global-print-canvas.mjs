import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const styles = readFileSync(resolve(root, 'src/styles.css'), 'utf8');
const printStart = styles.lastIndexOf('@media print');
const printStyles = styles.slice(printStart);
const changedFiles = execFileSync('git', ['diff', '--name-only'], { cwd: root, encoding: 'utf8' });

assert.ok(printStart >= 0, 'A print stylesheet must exist.');
assert.ok(printStyles.includes('/* Keep the selected app theme from leaking into any browser print canvas. */'), 'Global print canvas reset must be at the end of the print stylesheet.');
assert.match(printStyles, /html,\s*body,\s*#root,[\s\S]*background:\s*#fff\s*!important;[\s\S]*color:\s*#000\s*!important;/, 'The document root must print on a white canvas with black text.');
assert.match(printStyles, /#root,[\s\S]*\.app-shell,[\s\S]*\.app-layout,[\s\S]*\.print-sheet,[\s\S]*\.customer-report\s*{[\s\S]*border:\s*0\s*!important;[\s\S]*box-shadow:\s*none\s*!important;[\s\S]*outline:\s*0\s*!important;/, 'Outer print wrappers must not render a dark frame, shadow, or outline.');
assert.match(printStyles, /@page\s*{[\s\S]*background:\s*#fff;[\s\S]*size:\s*letter portrait;[\s\S]*margin:\s*0\.5in;/, 'Print pages must retain a white Letter canvas and explicit margins.');
assert.doesNotMatch(printStyles, /\*,\s*\*::before,\s*\*::after\s*{[^}]*border:\s*(?:0|none)/, 'Print CSS must not remove borders from every element.');
assert.match(printStyles, /\.report-table th,[\s\S]*\.report-table td\s*{[\s\S]*border:\s*1px solid #000;/, 'Internal report table borders must remain available.');
assert.match(printStyles, /\.print-sheet h3\s*{[\s\S]*border-bottom:\s*1px solid #9a9a9a;/, 'Job Sheet section dividers must remain available.');
assert.ok(!changedFiles.includes('src/components/DamageMap.js'), 'Global print canvas work must not change Damage Map logic.');
assert.ok(!changedFiles.includes('src/modules/photos/'), 'Global print canvas work must not change photo logic.');

console.log('Global print canvas checks passed.');
