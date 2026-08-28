import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8');

const documents = read('src/modules/jobs/JobPrintDocuments.jsx');
const detail = read('src/modules/jobs/JobDetail.jsx');
const report = read('src/modules/print/PrintDamageReport.jsx');
const mapFigure = read('src/modules/print/PrintDamageMapFigure.jsx');
const readiness = read('src/modules/print/printDocumentReady.js');
const styles = read('src/modules/print/PrintStyles.css');
const roadmap = read('ROADMAP.md');
const packageJson = read('package.json');

assert.ok(documents.includes("import PrintDamageReport from '../print/PrintDamageReport.jsx'"), 'Job documents must use the isolated customer report renderer.');
assert.ok(!existsSync(resolve(root, 'src/modules/jobs/CustomerDamageReport.js')), 'The legacy shared-layout customer report must be removed.');
assert.ok(!existsSync(resolve(root, 'src/modules/jobs/JobDamageReportView.jsx')), 'The legacy damage-map print view must be removed.');
assert.match(report, /className="print-damage-report" data-print-document="customer-report"/, 'The customer report must expose one scoped document root.');
assert.match(report, /instrumentType === 'Amplifier'[\s\S]*?<h3>Amplifier inspection<\/h3>/, 'Amplifier reports must use amplifier inspection language.');
assert.match(report, /instrumentType === 'Keyboard'[\s\S]*?<h3>Keyboard inspection<\/h3>/, 'Keyboard reports must use keyboard inspection language.');
assert.match(report, /isGuitarFamily[\s\S]*?<GuitarInspection/, 'Guitar neck measurements must remain limited to guitar-family reports.');
assert.match(mapFigure, /style=\{\{ left: `\$\{clampPercent\(mark\.x\)\}%`, top: `\$\{clampPercent\(mark\.y\)\}%` \}\}/, 'Saved marker percentages must map directly onto the isolated image stage.');
assert.match(mapFigure, /className="print-damage-marker-layer"/, 'Markers must render in a dedicated layer over the image.');
assert.match(mapFigure, /imageState\.url === imageUrl[\s\S]*?imageState\.status/, 'Image readiness must be tied to the current damage image URL.');
assert.match(mapFigure, /onLoad=\{\(\) => setImageState\(\{ url: imageUrl, status: 'loaded' \}\)\}/, 'The report must confirm that the current damage image loaded before presenting image-backed evidence.');
assert.match(mapFigure, /onError=\{\(\) => setImageState\(\{ url: imageUrl, status: 'error' \}\)\}/, 'The report must record failed damage images against the current URL.');
assert.match(mapFigure, /imageStatus === 'loaded' && marks\.length > 0/, 'Condition observations must remain hidden unless the reference image loaded successfully.');
assert.match(styles, /\.print-damage-map-stage > img\s*{[\s\S]*max-height:\s*4\.55in;[\s\S]*max-width:\s*100%;/, 'Damage images must remain inside the printable page frame.');
assert.match(styles, /\.print-damage-marker\s*{[\s\S]*transform:\s*translate\(-50%, -50%\);/, 'Printed markers must stay centered on saved coordinates.');
assert.match(styles, /\.print-document-table thead\s*{[\s\S]*display:\s*table-header-group;/, 'Multi-page tables must repeat their headers.');
assert.ok(detail.includes('await waitForCustomerReportPrintReady();'), 'Customer printing must wait for document images before opening the browser print dialog.');
assert.match(readiness, /querySelectorAll\(`\$\{selector\} img`\)[\s\S]*Promise\.all\(images\.map\(waitForImage\)\)[\s\S]*nextPaint/, 'Shared print readiness must wait for every selected document image and layout paint.');
assert.ok(readiness.includes("waitForPrintDocumentReady('.print-damage-report', root)"), 'Customer report readiness must target only the isolated customer document.');
assert.ok(!roadmap.includes('- Customer Damage Report print rendering still needs a proper isolated rebuild'), 'The completed print blocker must be removed from the active roadmap weak spots.');
assert.ok(packageJson.includes('"check:customer-report-print-renderer": "node scripts/check-customer-report-print-renderer.mjs"'), 'Package scripts must expose the customer report print check.');

console.log('Customer report print renderer checks passed.');
