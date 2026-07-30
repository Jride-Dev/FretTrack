import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildSelectedDocumentEmailContent } from '../src/modules/jobs/emailDocuments.js';
import { formatMeasurementChange } from '../src/shared/utils/measurements.js';
import { buildJobAccountingSnapshot } from '../src/modules/accounting/accountingSelectors.js';

const root = process.cwd();
const read = (file) => readFileSync(resolve(root, file), 'utf8');
const emailDocuments = read('src/modules/jobs/emailDocuments.js');
const jobDetail = read('src/modules/jobs/JobDetail.jsx');
const jobForm = read('src/modules/jobs/JobForm.jsx');
const jobPrintSheet = read('src/modules/jobs/JobPrintSheet.js');
const neckInspectionSection = read('src/modules/jobs/NeckInspectionSection.js');
const accountingSelectors = read('src/modules/accounting/accountingSelectors.js');
const shopConfig = read('src/modules/shops/shopConfig.js');

const job = {
  shopId: 'measurement-shop',
  jobNumber: 'MEASURE-001',
  customerName: 'Measurement Tester',
  techDetails: {
    lengthUnit: 'in',
    neckInspection: {
      initial: {
        relief: '0.2',
        actionHighE12th: '1.5',
        actionLowE12th: '2'
      },
      final: {
        relief: '0.3',
        actionHighE12th: '1.7',
        actionLowE12th: '2.2'
      }
    }
  }
};

function buildReport(lengthUnit, includeResolvedDisplayUnit = true) {
  return buildSelectedDocumentEmailContent(job, {
    shopSettings: {
      shopId: job.shopId,
      shopName: 'Measurement Shop',
      lengthUnit
    },
    ...(includeResolvedDisplayUnit ? { lengthUnit } : {})
  }, {
    includeCustomerReport: true
  });
}

const inchReport = buildReport('in');
assert.match(inchReport.text, /Relief \(in\) \| 0\.2 in -> 0\.3 in \(\+0\.100 in\)/);
assert.match(inchReport.text, /Action, High E at 12th fret \(in\) \| 1\.5 in -> 1\.7 in \(\+0\.200 in\)/);
assert.match(inchReport.text, /Action, Low E at 12th fret \(in\) \| 2 in -> 2\.2 in \(\+0\.200 in\)/);
assert.doesNotMatch(inchReport.text, /Relief \(mm\)|12th fret \(mm\)/);
assert.match(inchReport.html, /Relief \(in\)[\s\S]*0\.2 in -&gt; 0\.3 in \(\+0\.100 in\)/);

const millimeterReport = buildReport('mm');
assert.match(millimeterReport.text, /Relief \(mm\) \| 0\.2 mm -> 0\.3 mm \(\+0\.100 mm\)/);
assert.match(millimeterReport.text, /Action, High E at 12th fret \(mm\) \| 1\.5 mm -> 1\.7 mm \(\+0\.200 mm\)/);
assert.match(millimeterReport.text, /Action, Low E at 12th fret \(mm\) \| 2 mm -> 2\.2 mm \(\+0\.200 mm\)/);
assert.doesNotMatch(millimeterReport.text, /Relief \(in\)|12th fret \(in\)/);
assert.match(millimeterReport.html, /Relief \(mm\)[\s\S]*0\.2 mm -&gt; 0\.3 mm \(\+0\.100 mm\)/);

const shopFallbackReport = buildReport('mm', false);
assert.match(
  shopFallbackReport.text,
  /Relief \(mm\) \| 0\.2 mm -> 0\.3 mm/,
  'The scoped shop setting must remain authoritative when no explicit display-unit override is supplied.'
);

const metricAccountingSnapshot = buildJobAccountingSnapshot(job, { lengthUnit: 'mm' });
assert.equal(metricAccountingSnapshot.measurementSummary.initial.unit, 'mm');
assert.equal(metricAccountingSnapshot.measurementSummary.initial.relief, '0.2 mm');
assert.equal(metricAccountingSnapshot.measurementSummary.final.actionHighE12th, '1.7 mm');

assert.equal(
  formatMeasurementChange('0.2', '0.3', 'mm'),
  '0.2 mm -> 0.3 mm (+0.100 mm)',
  'The generated document must use the same shared formatter as Job Detail.'
);
assert.match(jobForm, /const measurementPreferences = getShopMeasurementOptions\(shopProfile \|\| undefined\);/, 'New jobs must copy the explicit Shop Settings measurement preference.');
assert.doesNotMatch(jobForm, /const measurementPreferences = getDefaultMeasurementPreferences\(shopProfile \|\| \{\}\);/, 'New jobs must not infer units from currency or locale when Shop Settings has an explicit preference.');
assert.match(shopConfig, /measurementSystem:\s*normalizeMeasurementSystem\(mergedSettings\.measurementSystem/, 'Measurement resolution must use the explicit Shop Settings system.');
assert.match(shopConfig, /lengthUnit:\s*normalizeLengthUnit\(mergedSettings\.lengthUnit/, 'Measurement resolution must use the explicit Shop Settings unit.');
assert.match(jobDetail, /const measurementOptions = getShopMeasurementOptions\(shopSettings\);/, 'Job Detail must resolve its display unit from current Shop Settings.');
assert.doesNotMatch(jobDetail, /measurementSystem: draftJob\.techDetails\.measurementSystem|lengthUnit: draftJob\.techDetails\.lengthUnit/, 'Stale job metadata must not override current Shop Settings.');
assert.match(jobDetail, /lengthUnit: measurementOptions\.lengthUnit/, 'Document generation must receive the same resolved unit displayed by Job Detail.');
assert.match(jobDetail, /return formatMeasurementChange\(initialValue, finalValue, unit\);/, 'Job Detail must use the shared measurement-change formatter.');
assert.match(neckInspectionSection, /Measurement Unit \(Shop Settings\)/, 'Neck measurement entry must identify Shop Settings as the unit source.');
assert.match(neckInspectionSection, /value=\{stageLengthUnit\}[\s\S]*disabled/, 'Per-stage controls must display the shop unit without allowing a stale job override.');
assert.doesNotMatch(neckInspectionSection, /stage\.lengthUnit \|\| stage\.reliefUnit/, 'Neck measurement display must not prefer stale per-stage unit metadata.');
assert.match(jobPrintSheet, /const finalLengthUnit = lengthUnit;/, 'The printed Job Sheet must use the unit supplied from Shop Settings.');
assert.doesNotMatch(jobPrintSheet, /finalNeckInspection\.lengthUnit \|\| finalNeckInspection\.reliefUnit/, 'The printed Job Sheet must not prefer stale per-stage unit metadata.');
assert.match(accountingSelectors, /const unit = normalizeLengthUnit\(fallbackUnit\);/, 'Report exports must use their shop-provided unit.');
assert.match(emailDocuments, /formatMeasurementChange\(neckInspection\.initial\?\.relief/, 'Generated neck measurements must use the shared formatter.');
assert.doesNotMatch(emailDocuments, /cleanText\(techDetails\.lengthUnit\) \|\| 'in'/, 'Generated documents must not use the stale job-level inch fallback.');

const changed = execFileSync('git', ['diff', '--name-only', 'HEAD'], { cwd: root, encoding: 'utf8' }).replaceAll('\\', '/');
assert.doesNotMatch(changed, /supabase\/|src\/modules\/scheduling\/|src\/modules\/billing\/|src\/modules\/auth\/|cloudflare\/|stale-chunk/i);
assert.doesNotMatch(changed, /Screenshots\/current_jobs_update7\.jpg/);

console.log('Document measurement unit checks passed for inches and millimeters.');
