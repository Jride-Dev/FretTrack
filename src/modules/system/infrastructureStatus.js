const STATUSPAGE_COMPONENT_STATES = {
  operational: { status: 'operational', statusLabel: 'Operational', priority: 0 },
  under_maintenance: { status: 'maintenance', statusLabel: 'Maintenance', priority: 1 },
  degraded_performance: { status: 'degraded', statusLabel: 'Degraded', priority: 2 },
  partial_outage: { status: 'degraded', statusLabel: 'Partial outage', priority: 3 },
  major_outage: { status: 'outage', statusLabel: 'Major outage', priority: 4 }
};

export const INFRASTRUCTURE_PROVIDERS = [
  {
    key: 'supabase',
    label: 'Supabase',
    summaryUrl: 'https://status.supabase.com/api/v2/summary.json',
    statusUrl: 'https://status.supabase.com',
    componentNames: ['API Gateway', 'Auth', 'Database', 'Realtime', 'Storage']
  },
  {
    key: 'cloudflare',
    label: 'Cloudflare',
    summaryUrl: 'https://www.cloudflarestatus.com/api/v2/summary.json',
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
      const response = await fetchImpl(provider.summaryUrl, {
        cache: 'no-store',
        headers: { accept: 'application/json' }
      });
      if (!response.ok) {
        throw new Error(`Provider status returned ${response.status}.`);
      }
      return summarizeProviderStatus(provider, await response.json());
    } catch (error) {
      console.warn(`${provider.label} status check failed.`, error);
      return unavailableProvider(provider);
    }
  }));
}

export function summarizeProviderStatus(provider, summary = {}) {
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
    checkedAt: new Date().toISOString()
  };
}

function unavailableProvider(provider) {
  return {
    key: provider.key,
    label: provider.label,
    status: 'unknown',
    statusLabel: 'Unavailable',
    statusUrl: provider.statusUrl,
    checkedAt: new Date().toISOString()
  };
}
