import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  getElapsedStatusText,
  normalizeSystemStatus
} from '../src/modules/system/systemStatus.js';
import {
  getNoticeSoundsEnabled,
  playImportantNoticeOnce,
  setNoticeSoundsEnabled
} from '../src/modules/system/noticeSound.js';

const root = process.cwd();
const read = (file) => readFileSync(resolve(root, file), 'utf8');
const memoryStorage = () => {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value))
  };
};

const appNotice = read('src/modules/system/SystemAnnouncements.jsx');
const service = read('src/modules/system/systemService.js');
const operatorPanel = read('src/modules/operator/SystemStatusOperatorPanel.jsx');
const worker = read('cloudflare/frettrack-coming-soon/src/index.js');
const migration = read('supabase/migrations/20260730080400_system_notices_and_uptime.sql');
const packageJson = read('package.json');

assert.match(appNotice, /system-status-banner/, 'The authenticated app must render a prominent system status banner.');
assert.match(appNotice, /Unexpected errors may be related to this active incident\./, 'Active incidents must explain their possible relationship to unexpected errors.');
assert.match(appNotice, /Notice sounds/, 'The app must expose an accessible notice sound preference.');
assert.match(appNotice, /setInterval\(loadAnnouncements, REFRESH_INTERVAL_MS\)/, 'Status and notices must refresh without a page reload.');
assert.doesNotMatch(appNotice, /updateSystemStatus|\.insert\(|\.update\(/, 'The app status timer must not write to the backend.');
assert.match(service, /rpc\('get_public_system_status'\)/, 'The app must use the shared persisted public status source.');
assert.match(operatorPanel, /updateSystemStatus/, 'Operators must have a status publishing control.');
assert.match(operatorPanel, /Do not include private infrastructure or customer details/, 'Operator copy must reinforce public-safe notice content.');

const notice = normalizeSystemStatus({
  status: 'outage',
  publicNoticeTitle: 'Service outage',
  publicNoticeMessage: 'Service is temporarily unavailable.',
  noticeType: 'outage',
  statusChangedAt: '2026-07-30T07:00:00.000Z',
  lastUpdatedAt: '2026-07-30T07:05:00.000Z'
});
const soundSession = memoryStorage();
let playCount = 0;
const playSound = async () => { playCount += 1; };
assert.equal(await playImportantNoticeOnce(notice, { storage: soundSession, playSound }), true, 'A new important notice should attempt one sound.');
assert.equal(await playImportantNoticeOnce(notice, { storage: soundSession, playSound }), false, 'A rerender must not replay the same notice.');
assert.equal(playCount, 1, 'The same notice must play only once.');

const updatedNotice = { ...notice, lastUpdatedAt: '2026-07-30T07:06:00.000Z' };
await playImportantNoticeOnce(updatedNotice, { storage: soundSession, playSound });
assert.equal(playCount, 2, 'A meaningful notice update may play once.');

const preferenceStorage = memoryStorage();
assert.equal(getNoticeSoundsEnabled(preferenceStorage), true, 'Notice sounds must default to enabled.');
setNoticeSoundsEnabled(false, preferenceStorage);
assert.equal(getNoticeSoundsEnabled(preferenceStorage), false, 'The mute preference must persist locally.');
await playImportantNoticeOnce({ ...notice, lastUpdatedAt: '2026-07-30T07:07:00.000Z' }, {
  enabled: false,
  storage: soundSession,
  playSound
});
assert.equal(playCount, 2, 'Muted notices must not play.');
await assert.doesNotReject(
  playImportantNoticeOnce({ ...notice, lastUpdatedAt: '2026-07-30T07:08:00.000Z' }, {
    storage: soundSession,
    playSound: async () => { throw new Error('Autoplay blocked'); }
  }),
  'Audio rejection must be non-fatal.'
);

assert.equal(
  getElapsedStatusText(notice, Date.parse('2026-07-30T08:05:00.000Z')),
  'Incident duration 1h 5m',
  'Non-operational state must show incident duration from the persisted transition.'
);
const recovered = normalizeSystemStatus({
  status: 'operational',
  statusChangedAt: '2026-07-30T08:00:00.000Z',
  lastUpdatedAt: '2026-07-30T08:00:00.000Z'
});
assert.equal(
  getElapsedStatusText(recovered, Date.parse('2026-07-30T08:05:00.000Z')),
  'Uptime 5m',
  'Recovery must start a new uptime period from its persisted timestamp.'
);

assert.match(migration, /create table if not exists public\.system_status/, 'A persisted singleton system status is required.');
assert.match(migration, /when current_status\.status is distinct from next_status then now\(\)[\s\S]*else current_status\.status_changed_at/, 'Same-status notice updates must preserve the authoritative transition timestamp.');
assert.match(migration, /when current_status\.status <> 'operational' then 'recovery'/, 'Returning to Operational must create a recovery notice.');
assert.match(migration, /if not private\.is_operator\(\)/, 'Only operators may update system status.');
assert.match(migration, /revoke all on public\.system_status from public, anon, authenticated/, 'The backing status row must not be directly exposed.');
assert.match(migration, /grant execute on function public\.get_public_system_status\(\) to anon, authenticated/, 'Only the public-safe status RPC may be read without authentication.');
assert.match(migration, /revoke all on function public\.update_system_status[\s\S]*grant execute[\s\S]*to authenticated/, 'The update RPC must not be executable anonymously.');

assert.match(worker, /url\.pathname === '\/api\/system-status'/, 'The public website must expose a same-origin status endpoint.');
assert.match(worker, /rpc\/get_public_system_status/, 'The public website must use the same persisted status source as the app.');
assert.match(worker, /FretTrack status could not be loaded/, 'The public display must fail gracefully.');
assert.match(worker, /window\.setInterval\(function\(\)[\s\S]*formatStatusDuration/, 'The public duration must update locally.');
const publicPayloadStart = worker.indexOf('const status = await response.json();', worker.indexOf('async function getPublicSystemStatus'));
const publicResponse = worker.slice(
  worker.indexOf('return jsonResponse({', publicPayloadStart),
  worker.indexOf('});', worker.indexOf('return jsonResponse({', publicPayloadStart)) + 3
);
for (const approvedField of ['status', 'statusLabel', 'publicNoticeTitle', 'publicNoticeMessage', 'statusChangedAt', 'lastUpdatedAt', 'incidentState']) {
  assert.match(publicResponse, new RegExp(`\\b${approvedField}\\b`), `Public response must include ${approvedField}.`);
}
assert.doesNotMatch(publicResponse, /operator|stack|user|infrastructure|metadata|latest_announcement/i, 'The public response must not expose internal fields.');
assert.doesNotMatch(read('src/modules/system/FeedbackReporter.jsx'), /playImportantNoticeOnce|playNoticeChime/, 'Inline validation and feedback must not invoke the global notice sound.');
assert.match(packageJson, /"check:system-notices-uptime": "node scripts\/check-system-notices-uptime\.mjs"/, 'The focused regression check must be registered.');

const originalFetch = globalThis.fetch;
try {
  globalThis.fetch = async () => new Response(JSON.stringify({
    status: 'degraded',
    publicNoticeTitle: 'Degraded service',
    publicNoticeMessage: 'Some features are temporarily unavailable.',
    noticeType: 'degraded',
    statusChangedAt: '2026-07-30T07:00:00.000Z',
    lastUpdatedAt: '2026-07-30T07:05:00.000Z',
    incidentState: true,
    operatorNotes: 'must never leave the server',
    latestAnnouncementId: 'private-id'
  }), { status: 200, headers: { 'content-type': 'application/json' } });
  const workerModule = await import('../cloudflare/frettrack-coming-soon/src/index.js');
  const response = await workerModule.default.fetch(
    new Request('https://frettrack-app.com/api/system-status'),
    { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_ANON_KEY: 'public-anon-key' }
  );
  assert.equal(response.status, 200, 'The public status route should return an available status.');
  const payload = await response.json();
  assert.deepEqual(
    Object.keys(payload).sort(),
    ['incidentState', 'lastUpdatedAt', 'publicNoticeMessage', 'publicNoticeTitle', 'status', 'statusChangedAt', 'statusLabel'].sort(),
    'The public endpoint must return only approved safe fields.'
  );
} finally {
  globalThis.fetch = originalFetch;
}

const changed = execFileSync('git', ['diff', '--name-only', 'HEAD'], { cwd: root, encoding: 'utf8' }).replaceAll('\\', '/');
assert.doesNotMatch(changed, /supabase\/functions\//, 'System notices must not change Edge Functions.');
assert.doesNotMatch(changed, /src\/modules\/billing\/|stripe/i, 'System notices must not change billing or Stripe.');
assert.doesNotMatch(changed, /Screenshots\/current_jobs_update7\.jpg/, 'The protected screenshot must remain untouched.');

console.log('System notices and uptime checks passed.');
