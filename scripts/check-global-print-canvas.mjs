import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const styles = ['src/styles/foundations.css', 'src/styles/workspace.css', 'src/styles.css']
  .map((file) => readFileSync(resolve(root, file), 'utf8'))
  .join('\n');
const documentStyles = readFileSync(resolve(root, 'src/modules/print/PrintStyles.css'), 'utf8');
const printStart = styles.lastIndexOf('@media print');
const printStyles = styles.slice(printStart);
const changedFiles = execFileSync('git', ['diff', '--name-only'], { cwd: root, encoding: 'utf8' })
  .split(/\r?\n/)
  .filter(Boolean)
  .map((file) => file.replaceAll('\\', '/'));

assert.ok(printStart >= 0, 'A print stylesheet must exist.');
assert.ok(printStyles.includes('/* Keep the selected app theme from leaking into any browser print canvas. */'), 'Global print canvas reset must be at the end of the print stylesheet.');
assert.match(printStyles, /html,\s*body,\s*#root,[\s\S]*background:\s*#fff\s*!important;[\s\S]*color:\s*#000\s*!important;/, 'The document root must print on a white canvas with black text.');
assert.match(printStyles, /#root,[\s\S]*\.app-shell,[\s\S]*\.app-layout,[\s\S]*\.customer-report\s*{[\s\S]*border:\s*0\s*!important;[\s\S]*box-shadow:\s*none\s*!important;[\s\S]*outline:\s*0\s*!important;/, 'Outer print wrappers must not render a dark frame, shadow, or outline.');
assert.match(printStyles, /@page\s*{[\s\S]*background:\s*#fff;[\s\S]*size:\s*letter portrait;[\s\S]*margin:\s*0\.5in;/, 'Print pages must retain a white Letter canvas and explicit margins.');
assert.doesNotMatch(printStyles, /\*,\s*\*::before,\s*\*::after\s*{[^}]*border:\s*(?:0|none)/, 'Print CSS must not remove borders from every element.');
assert.match(printStyles, /\.report-table th,[\s\S]*\.report-table td\s*{[\s\S]*border:\s*1px solid #000;/, 'Internal report table borders must remain available.');
assert.match(documentStyles, /body:not\(\.customer-report-printing\) \.print-job-sheet\s*{[\s\S]*background:\s*#fff !important;[\s\S]*display:\s*block !important;/, 'The isolated Job Sheet must own its white print canvas.');
assert.match(documentStyles, /body\.customer-report-printing \.print-damage-report\s*{[\s\S]*display:\s*block !important;/, 'The isolated customer report must render only in customer-report print mode.');
assert.match(documentStyles, /\.print-damage-map-stage\s*{[\s\S]*position:\s*relative;/, 'The isolated damage-map stage must own marker positioning.');
assert.ok(
  !changedFiles.some((file) => file.startsWith('src/modules/photos/') && file !== 'src/modules/photos/photoService.js'),
  'Only the later usage-cap photo service integration may change photo logic.'
);

console.log('Global print canvas checks passed.');
