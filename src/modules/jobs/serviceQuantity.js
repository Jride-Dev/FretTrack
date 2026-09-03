export const MIN_SERVICE_QUANTITY = 1;
export const MAX_SERVICE_QUANTITY = 9999;

export function normalizeServiceQuantity(value, fallback = MIN_SERVICE_QUANTITY) {
  const text = String(value ?? '').trim();
  if (!/^\d+$/.test(text)) {
    return fallback;
  }

  const quantity = Number(text);
  if (!Number.isSafeInteger(quantity)) {
    return fallback;
  }

  return Math.min(Math.max(quantity, MIN_SERVICE_QUANTITY), MAX_SERVICE_QUANTITY);
}

export function normalizeServiceQuantityInput(value) {
  const text = String(value ?? '');
  if (!text) {
    return '';
  }

  const digits = text.match(/^\d+/)?.[0] || '';
  if (!digits) {
    return '';
  }

  return String(Math.min(Number(digits), MAX_SERVICE_QUANTITY));
}
