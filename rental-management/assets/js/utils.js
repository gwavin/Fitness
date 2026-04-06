export const ENTRY_TYPES = {
  RENT_CHARGE: 'RENT_CHARGE',
  PAYMENT_RECEIVED: 'PAYMENT_RECEIVED',
  REPAIR_DEDUCTION: 'REPAIR_DEDUCTION',
  AGENT_FEE: 'AGENT_FEE',
  MANUAL_ADJUSTMENT: 'MANUAL_ADJUSTMENT',
};

export function uid(prefix = 'id') {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

export function nowIso() {
  return new Date().toISOString();
}

export function monthKey(date = new Date()) {
  const d = typeof date === 'string' ? new Date(date) : date;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function yearKey(date = new Date()) {
  const d = typeof date === 'string' ? new Date(date) : date;
  return String(d.getFullYear());
}

export function formatCurrency(value = 0) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(Number(value) || 0);
}

export function formatDate(isoDate) {
  if (!isoDate) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(isoDate));
}

export function toInputDate(isoDate) {
  if (!isoDate) return '';
  return new Date(isoDate).toISOString().split('T')[0];
}

export function readHash() {
  const hash = window.location.hash.replace(/^#\/?/, '');
  return hash || 'dashboard';
}

export function parseQueryString(queryString = '') {
  const params = new URLSearchParams(queryString);
  return Object.fromEntries(params.entries());
}

export function parseRoute(hash = readHash()) {
  const [pathPart, queryString = ''] = hash.split('?');
  const parts = pathPart.split('/').filter(Boolean);
  return {
    resource: parts[0] || 'dashboard',
    id: parts[1] || null,
    action: parts[2] || null,
    query: parseQueryString(queryString),
    raw: hash,
  };
}

export function sumBy(items, key) {
  return items.reduce((sum, item) => sum + (Number(item[key]) || 0), 0);
}

export function escapeHtml(str = '') {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function debounce(fn, wait = 150) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), wait);
  };
}

export function groupBy(items, keyFn) {
  return items.reduce((acc, item) => {
    const key = keyFn(item);
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});
}
