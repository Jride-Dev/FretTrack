import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (file) => readFileSync(resolve(root, file), 'utf8');
const app = read('src/app/App.jsx');
const router = read('src/app/WorkspaceRouter.jsx');
const navigation = read('src/app/SpecialistJobWorkspaceNav.jsx');
const workspaceState = read('src/app/workspaceState.js');
const workspaceNavigation = read('src/app/useWorkspaceNavigation.js');
const guitarDetail = read('src/modules/guitars/GuitarJobDetail.jsx');
const techDetails = read('src/modules/jobs/TechDetailsSection.js');
const damageMap = read('src/modules/jobs/DamageMapSection.js');

assert.match(app, /isKeyboardJob\(job\)[\s\S]*?: 'guitar-detail'/, 'Ordinary stringed-instrument jobs must open the focused Guitar Bench.');
assert.match(router, /mode === 'guitar-detail'[\s\S]*?<SpecialistJobWorkspaceNav[\s\S]*?<GuitarJobDetail/, 'The workspace router must compose Guitar Bench with the shared work-order switch.');
assert.match(router, /<GuitarJobDetail[\s\S]*?onUpdate=\{actions\.onUpdateJob\}[\s\S]*?onImageUpload=\{actions\.onImageUpload\}/, 'Guitar Bench must reuse authoritative job and photo persistence.');
assert.match(navigation, /isStringedInstrumentType\([\s\S]*?return 'guitar-detail'/, 'Stringed instruments must map to Guitar Bench without affecting amp or keyboard routing.');
assert.match(navigation, /'Guitar Bench'[\s\S]*?Work Order, Parts &amp; Payments/, 'Guitar jobs must expose the same bench-to-commerce navigation as specialist jobs.');
assert.match(workspaceState, /'guitar-detail'[\s\S]*?: 'guitar-detail'/, 'Guitar Bench must survive refresh for the selected job.');
assert.match(workspaceNavigation, /\['guitar-detail', 'amplifier-detail', 'keyboard-detail'\]\.includes\(detailMode\)/, 'Workspace selection must recognize Guitar Bench as a first-class detail mode.');

assert.match(guitarDetail, /className="guitar-detail amplifier-detail"/, 'Guitar Bench must use the established full-width repair bench layout.');
assert.match(guitarDetail, /onUpdate\?\.\(draft, \{ expectedUpdatedAt: draft\.updatedAt \}\)/, 'Guitar saves must reject stale full-record updates.');
assert.match(guitarDetail, /<JobStatusSelect[\s\S]*?Reason for Visit \/ Customer Request/, 'Guitar Bench must retain essential work-order state and customer request fields.');
assert.match(guitarDetail, /<h3>Guitar Identity<\/h3>[\s\S]*?Instrument Type[\s\S]*?Brand[\s\S]*?Model[\s\S]*?Serial Number[\s\S]*?String Count/, 'Guitar Bench must provide focused instrument identity controls.');
assert.match(guitarDetail, /<TechDetailsSection[\s\S]*?updateNeckInspection=\{updateNeckInspection\}[\s\S]*?updateStringGauges=\{updateStringGauges\}/, 'Guitar Bench must reuse the established string and neck worksheet.');
assert.match(guitarDetail, /<DamageMapSection[\s\S]*?onChange=\{updateDamageMap\}[\s\S]*?onViewImageUpload=\{uploadDamageViewImage\}/, 'Guitar Bench must retain the established visual condition workflow.');
assert.match(techDetails, /className=\{className \|\| undefined\}/, 'The shared technical worksheet must support bench panel composition.');
assert.match(damageMap, /className=\{className \|\| undefined\}/, 'The shared Damage Map must support bench panel composition.');
assert.doesNotMatch(guitarDetail, /PartsList|Payments|TotalsSection|sendCustomerMessage|supabase|stripe/i, 'Guitar Bench must not duplicate shared commercial or persistence systems.');

console.log('Guitar Repair Bench checks passed.');
