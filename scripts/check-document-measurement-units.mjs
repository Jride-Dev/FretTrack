import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildSelectedDocumentEmailContent } from '../src/modules/jobs/emailDocuments.js';
import { formatMeasurementChange } from '../src/shared/utils/measurements.js';

const root = process.cwd();
const read = (file) => readFileSync(resolve(root, file), 'utf8');
const emailDocuments = read('src/modules/jobs/emailDocuments.js');
const jobDetail = read('src/modules/jobs/JobDetail.jsx');

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

assert.equal(
  formatMeasurementChange('0.2', '0.3', 'mm'),
  '0.2 mm -> 0.3 mm (+0.100 mm)',
  'The generated document must use the same shared formatter as Job Detail.'
);
assert.match(jobDetail, /lengthUnit: measurementOptions\.lengthUnit/, 'Document generation must receive the same resolved unit displayed by Job Detail.');
assert.match(jobDetail, /return formatMeasurementChange\(initialValue, finalValue, unit\);/, 'Job Detail must use the shared measurement-change formatter.');
assert.match(emailDocuments, /formatMeasurementChange\(neckInspection\.initial\?\.relief/, 'Generated neck measurements must use the shared formatter.');
assert.doesNotMatch(emailDocuments, /cleanText\(techDetails\.lengthUnit\) \|\| 'in'/, 'Generated documents must not use the stale job-level inch fallback.');

const changed = execFileSync('git', ['diff', '--name-only', 'HEAD'], { cwd: root, encoding: 'utf8' }).replaceAll('\\', '/');
assert.doesNotMatch(changed, /supabase\/|src\/modules\/scheduling\/|src\/modules\/billing\/|src\/modules\/auth\/|cloudflare\/|stale-chunk/i);
assert.doesNotMatch(changed, /Screenshots\/current_jobs_update7\.jpg/);

console.log('Document measurement unit checks passed for inches and millimeters.');
