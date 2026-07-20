const EMAIL_ADDRESS_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

export const BLOCKED_SENDERS = new Set([
  'k.lerner@fisher-estates.com'
]);

export const BLOCKED_DOMAINS = new Set([
  'fisher-estates.com'
]);

export function normalizeEmailAddress(value) {
  if (typeof value !== 'string') return '';

  const matches = value.match(EMAIL_ADDRESS_PATTERN);
  return (matches?.[0] || value).trim().toLowerCase();
}

export function extractHeaderEmailAddresses(value) {
  if (typeof value !== 'string') return [];

  return [...new Set((value.match(EMAIL_ADDRESS_PATTERN) || [])
    .map(normalizeEmailAddress)
    .filter(Boolean))];
}

export function getBlockedSenderReason({ envelopeSender, visibleFrom }) {
  const normalizedEnvelopeSender = normalizeEmailAddress(envelopeSender);
  const visibleFromAddresses = extractHeaderEmailAddresses(visibleFrom);
  const candidates = [
    { address: normalizedEnvelopeSender, source: 'envelope sender' },
    ...visibleFromAddresses.map((address) => ({ address, source: 'From header' }))
  ].filter(({ address }) => Boolean(address));

  for (const { address, source } of candidates) {
    if (BLOCKED_SENDERS.has(address)) {
      return `blocked sender matched in ${source}`;
    }
  }

  for (const { address, source } of candidates) {
    const domain = address.split('@')[1];
    if (domain && BLOCKED_DOMAINS.has(domain)) {
      return `blocked domain matched in ${source}`;
    }
  }

  return null;
}
