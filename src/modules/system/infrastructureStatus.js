const STATUSPAGE_COMPONENT_STATES = {
  operational: { status: 'operational', statusLabel: 'Operational', priority: 0 },
  under_maintenance: { status: 'maintenance', statusLabel: 'Maintenance', priority: 1 },
  degraded_performance: { status: 'degraded', statusLabel: 'Degraded', priority: 2 },
  partial_outage: { status: 'degraded', statusLabel: 'Partial outage', priority: 3 },
  major_outage: { status: 'outage', statusLabel: 'Major outage', priority: 4 }
};

const COMBINED_INFRASTRUCTURE_STATES = {
  operational: { status: 'operational', statusLabel: 'Operational', priority: 0 },
  unknown: { status: 'unknown', statusLabel: 'Status unavailable', priority: 1 },
  maintenance: { status: 'maintenance', statusLabel: 'Maintenance', priority: 2 },
  degraded: { status: 'degraded', statusLabel: 'Degraded', priority: 3 },
  outage: { status: 'outage', statusLabel: 'Outage', priority: 4 }
};

export const INFRASTRUCTURE_PROVIDERS = [
  {
    key: 'supabase',
    label: 'Supabase',
    summaryUrl: 'https://status.supabase.com/api/v2/summary.json',
    incidentsUrl: 'https://status.supabase.com/api/v2/incidents.json',
    statusUrl: 'https://status.supabase.com',
    componentNames: ['API Gateway', 'Auth', 'Database', 'Realtime', 'Storage']
  },
  {
    key: 'cloudflare',
    label: 'Cloudflare',
    summaryUrl: 'https://www.cloudflarestatus.com/api/v2/summary.json',
    incidentsUrl: 'https://www.cloudflarestatus.com/api/v2/incidents.json',
    statusUrl: 'https://www.cloudflarestatus.com',
    componentNames: ['Pages', 'Workers', 'Workers Assets']
  }
];

export async function getInfrastructureStatus(fetchImpl = globalThis.fetch) {
  if (typeof fetchImpl !== 'function') {
    return INFRASTRUCTURE_PROVIDERS.map(unavailableProvider);
  }

  return Promise.all(INFRASTRUCTURE_PROVIDERS.map(async (provider) => {
    try {
      const [summaryResponse, incidentsResponse] = await Promise.all([
        fetchProviderJson(fetchImpl, provider.summaryUrl),
        fetchProviderJson(fetchImpl, provider.incidentsUrl)
      ]);
      if (!summaryResponse.ok || !incidentsResponse.ok) {
        throw new Error(`Provider status returned ${summaryResponse.status}/${incidentsResponse.status}.`);
      }
      return summarizeProviderStatus(
        provider,
        await summaryResponse.json(),
        await incidentsResponse.json()
      );
    } catch (error) {
      console.warn(`${provider.label} status check failed.`, error);
      return unavailableProvider(provider);
    }
  }));
}

export function summarizeProviderStatus(provider, summary = {}, incidentHistory = {}) {
  const selectedComponents = (summary.components || [])
    .filter((component) => provider.componentNames.includes(component.name));
  if (!selectedComponents.length) {
    return unavailableProvider(provider);
  }

  const state = selectedComponents.reduce((current, component) => {
    const next = STATUSPAGE_COMPONENT_STATES[component.status] || {
      status: 'unknown',
      statusLabel: 'Unavailable',
      priority: 5
    };
    return next.priority > current.priority ? next : current;
  }, STATUSPAGE_COMPONENT_STATES.operational);

  return {
    key: provider.key,
    label: provider.label,
    status: state.status,
    statusLabel: state.statusLabel,
    statusUrl: provider.statusUrl,
    operationalSince: getLatestRelevantRecovery(provider, incidentHistory.incidents),
    checkedAt: new Date().toISOString()
  };
}

export function getCombinedInfrastructureUptimeStart(providerStatuses = []) {
  if (
    !providerStatuses.length
    || providerStatuses.some((provider) => provider.status !== 'operational')
  ) {
    return null;
  }

  const recoveryTimes = providerStatuses
    .map((provider) => Date.parse(provider.operationalSince))
    .filter(Number.isFinite);
  if (!recoveryTimes.length) {
    return null;
  }
  return new Date(Math.max(...recoveryTimes)).toISOString();
}

export function getCombinedInfrastructureHealth(providerStatuses = []) {
  if (!providerStatuses.length) {
    return COMBINED_INFRASTRUCTURE_STATES.unknown;
  }
  return providerStatuses.reduce((current, provider) => {
    const next = COMBINED_INFRASTRUCTURE_STATES[provider.status]
      || COMBINED_INFRASTRUCTURE_STATES.unknown;
    return next.priority > current.priority ? next : current;
  }, COMBINED_INFRASTRUCTURE_STATES.operational);
}

export function formatInfrastructureUptime(startedAt, now = Date.now()) {
  const startedAtMs = Date.parse(startedAt);
  const elapsedSeconds = Number.isFinite(startedAtMs)
    ? Math.max(0, Math.floor((Number(now) - startedAtMs) / 1000))
    : 0;
  const days = Math.floor(elapsedSeconds / 86400);
  const hours = Math.floor((elapsedSeconds % 86400) / 3600);
  const minutes = Math.floor((elapsedSeconds % 3600) / 60);
  const seconds = elapsedSeconds % 60;
  return `${days} ${days === 1 ? 'day' : 'days'} ${hours} ${hours === 1 ? 'hour' : 'hours'} ${minutes} min ${seconds} sec`;
}

function fetchProviderJson(fetchImpl, url) {
  return fetchImpl(url, {
    cache: 'no-store',
    headers: { accept: 'application/json' }
  });
}

function getLatestRelevantRecovery(provider, incidents = []) {
  const recoveryTimes = (Array.isArray(incidents) ? incidents : [])
    .filter((incident) => (
      incident?.resolved_at
      && (incident.components || []).some((component) => provider.componentNames.includes(component.name))
    ))
    .map((incident) => Date.parse(incident.resolved_at))
    .filter(Number.isFinite);
  return recoveryTimes.length ? new Date(Math.max(...recoveryTimes)).toISOString() : null;
}

function unavailableProvider(provider) {
  return {
    key: provider.key,
    label: provider.label,
    status: 'unknown',
    statusLabel: 'Unavailable',
    statusUrl: provider.statusUrl,
    operationalSince: null,
    checkedAt: new Date().toISOString()
  };
}
