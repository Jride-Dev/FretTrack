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
import {
  formatInfrastructureUptime,
  getCombinedInfrastructureHealth,
  getCombinedInfrastructureUptimeStart,
  getInfrastructureStatus,
  INFRASTRUCTURE_PROVIDERS,
  summarizeProviderStatus
} from '../src/modules/system/infrastructureStatus.js';

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
const infrastructureStatus = read('src/modules/system/infrastructureStatus.js');
const service = read('src/modules/system/systemService.js');
const operatorPanel = read('src/modules/operator/SystemStatusOperatorPanel.jsx');
const styles = read('src/styles.css');
const headers = read('public/_headers');
const worker = read('cloudflare/frettrack-coming-soon/src/index.js');
const migration = read('supabase/migrations/20260730080400_system_notices_and_uptime.sql');
const packageJson = read('package.json');

assert.match(appNotice, /system-status-banner/, 'The authenticated app must render a compact system status banner.');
assert.match(appNotice, /Unexpected errors may be related to this incident\./, 'Active incidents must explain their possible relationship to unexpected errors.');
assert.match(appNotice, />\s*Sound\s*</, 'The app must expose a compact accessible notice sound preference.');
assert.match(appNotice, /setInterval\(loadAnnouncements, ANNOUNCEMENT_REFRESH_INTERVAL_MS\)/, 'Status and notices must refresh without a page reload.');
assert.doesNotMatch(appNotice, /updateSystemStatus|\.insert\(|\.update\(/, 'The app status timer must not write to the backend.');
assert.match(appNotice, /getInfrastructureStatus\(\)/, 'The app must load infrastructure health independently of the manual FretTrack status.');
assert.match(appNotice, /infrastructure-status-chip/, 'Supabase and Cloudflare health must render in the compact status UI.');
assert.match(appNotice, /INFRASTRUCTURE_REFRESH_INTERVAL_MS = 30 \* 60 \* 1000/, 'Provider health and incident history must refresh every 30 minutes.');
assert.match(appNotice, /formatInfrastructureUptime\(infrastructureUptimeStart,\s*clock\)/, 'FretTrack uptime must advance locally between provider refreshes.');
assert.match(appNotice, /hasFretTrackIncident && \([\s\S]*systemStatus\?\.publicNoticeTitle/, 'Operational status must not repeat the default public notice title.');
assert.match(appNotice, /displayedStatus = hasFretTrackIncident \? systemStatus : infrastructureHealth/, 'The single headline must reflect provider degradation when FretTrack has no manual incident.');
assert.doesNotMatch(appNotice, /<strong>\{provider\.statusLabel\}<\/strong>/, 'Provider chips must not repeat Operational in visible copy.');
assert.match(styles, /\.system-status-banner\s*{[\s\S]*border:\s*1px[\s\S]*gap:\s*6px;[\s\S]*padding:\s*7px 10px;/, 'The authenticated status banner must use the compact layout.');
assert.doesNotMatch(styles, /@keyframes plug-connect|@keyframes socket-pulse/, 'The database status indicator must not animate.');
assert.match(headers, /connect-src[^;]*https:\/\/status\.supabase\.com[^;]*https:\/\/www\.cloudflarestatus\.com/, 'The production CSP must allow only the official provider status feeds used by the compact banner.');
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

assert.deepEqual(
  INFRASTRUCTURE_PROVIDERS.map((provider) => provider.label),
  ['Supabase', 'Cloudflare'],
  'Infrastructure status must report the two hosting dependencies.'
);
assert.match(infrastructureStatus, /https:\/\/status\.supabase\.com\/api\/v2\/summary\.json/, 'Supabase health must come from its official status feed.');
assert.match(infrastructureStatus, /https:\/\/status\.supabase\.com\/api\/v2\/incidents\.json/, 'Supabase uptime must use its official incident history.');
assert.match(infrastructureStatus, /https:\/\/www\.cloudflarestatus\.com\/api\/v2\/summary\.json/, 'Cloudflare health must come from its official status feed.');
assert.match(infrastructureStatus, /https:\/\/www\.cloudflarestatus\.com\/api\/v2\/incidents\.json/, 'Cloudflare uptime must use its official incident history.');
assert.match(infrastructureStatus, /'API Gateway', 'Auth', 'Database', 'Realtime', 'Storage'/, 'Supabase health must cover the FretTrack backend services.');
assert.match(infrastructureStatus, /'Pages', 'Workers', 'Workers Assets'/, 'Cloudflare health must cover FretTrack hosting and Worker services.');

const cloudflareProvider = INFRASTRUCTURE_PROVIDERS.find((provider) => provider.key === 'cloudflare');
assert.equal(
  summarizeProviderStatus(cloudflareProvider, {
    components: [
      { name: 'Pages', status: 'operational' },
      { name: 'Workers', status: 'degraded_performance' },
      { name: 'Unrelated data center', status: 'major_outage' }
    ]
  }).status,
  'degraded',
  'Relevant Cloudflare component degradation must be shown without allowing unrelated components to mislabel FretTrack.'
);

const providerResponses = new Map([
  ['https://status.supabase.com/api/v2/summary.json', {
    components: INFRASTRUCTURE_PROVIDERS[0].componentNames.map((name) => ({ name, status: 'operational' }))
  }],
  ['https://status.supabase.com/api/v2/incidents.json', {
    incidents: [{
      resolved_at: '2026-07-28T22:07:03.000Z',
      components: [{ name: 'Auth' }]
    }]
  }],
  ['https://www.cloudflarestatus.com/api/v2/summary.json', {
    components: INFRASTRUCTURE_PROVIDERS[1].componentNames.map((name) => ({ name, status: 'operational' }))
  }],
  ['https://www.cloudflarestatus.com/api/v2/incidents.json', {
    incidents: [{
      resolved_at: '2026-07-29T20:31:15.000Z',
      components: [{ name: 'Workers' }]
    }]
  }]
]);
const providerHealth = await getInfrastructureStatus(async (url) => (
  new Response(JSON.stringify(providerResponses.get(url)), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  })
));
assert.deepEqual(
  providerHealth.map(({ label, status }) => ({ label, status })),
  [
    { label: 'Supabase', status: 'operational' },
    { label: 'Cloudflare', status: 'operational' }
  ],
  'Official provider summaries must resolve to the compact infrastructure health display.'
);
assert.equal(
  getCombinedInfrastructureUptimeStart(providerHealth),
  '2026-07-29T20:31:15.000Z',
  'Combined uptime must begin at the latest relevant provider recovery.'
);
assert.deepEqual(
  getCombinedInfrastructureHealth(providerHealth),
  { status: 'operational', statusLabel: 'Operational', priority: 0 },
  'Healthy dependencies must produce one Operational headline.'
);
assert.equal(
  getCombinedInfrastructureHealth([
    providerHealth[0],
    { ...providerHealth[1], status: 'degraded' }
  ]).status,
  'degraded',
  'A degraded dependency must replace the Operational headline.'
);
assert.equal(
  formatInfrastructureUptime('2026-07-29T20:31:15.000Z', Date.parse('2026-07-31T08:04:25.000Z')),
  '1 day 11 hours 33 min 10 sec',
  'FretTrack uptime must use the requested readable duration.'
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
