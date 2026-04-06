import { buildStatementEmail, simulateEmailLogEntry } from './email.js';
import { generateMonthlyStatementData, generateYearlyStatementData } from './statements.js';
import { loadState, resetState, withState } from './store.js';
import { monthKey, nowIso, uid } from './utils.js';

function collection(name) {
  return loadState()[name] || [];
}

function getById(name, id) {
  return collection(name).find(item => item.id === id) || null;
}

function saveEntity(name, entity, prefix) {
  const now = nowIso();
  return withState((state) => {
    const arr = state[name] || [];
    const existingIndex = arr.findIndex(item => item.id === entity.id);
    const payload = {
      ...entity,
      id: entity.id || uid(prefix),
      createdAt: entity.createdAt || now,
      updatedAt: now,
    };
    if (existingIndex >= 0) arr[existingIndex] = payload;
    else arr.push(payload);
    state.activity.unshift({ id: uid('act'), message: `${name.slice(0, -1)} saved: ${payload.id}`, at: now, type: 'save' });
    state[name] = arr;
    return state;
  });
}

function deleteEntity(name, id) {
  return withState((state) => {
    state[name] = (state[name] || []).filter(item => item.id !== id);
    state.activity.unshift({ id: uid('act'), message: `${name.slice(0, -1)} deleted: ${id}`, at: nowIso(), type: 'delete' });
    return state;
  });
}

export const services = {
  getState: () => loadState(),

  getLandlords: () => collection('landlords'),
  getLandlord: (id) => getById('landlords', id),
  saveLandlord: (payload) => saveEntity('landlords', payload, 'landlord'),
  deleteLandlord: (id) => deleteEntity('landlords', id),

  getTenants: () => collection('tenants'),
  getTenant: (id) => getById('tenants', id),
  saveTenant: (payload) => saveEntity('tenants', payload, 'tenant'),
  deleteTenant: (id) => deleteEntity('tenants', id),

  getProperties: () => collection('properties'),
  getProperty: (id) => getById('properties', id),
  saveProperty: (payload) => saveEntity('properties', payload, 'property'),
  deleteProperty: (id) => deleteEntity('properties', id),

  getTenancies: () => collection('tenancies'),
  getTenancy: (id) => getById('tenancies', id),
  saveTenancy: (payload) => saveEntity('tenancies', payload, 'tenancy'),
  deleteTenancy: (id) => deleteEntity('tenancies', id),

  getLedgerEntries: (mKey = monthKey(), filter = {}) =>
    collection('ledgerEntries').filter(entry =>
      (!mKey || entry.monthKey === mKey) &&
      (!filter.propertyId || entry.propertyId === filter.propertyId) &&
      (!filter.landlordId || entry.landlordId === filter.landlordId)
    ),

  saveLedgerEntry: (payload) => saveEntity('ledgerEntries', payload, 'entry'),

  addDeduction: ({ propertyId, tenancyId, landlordId, tenantId, amount, description, notes, entryDate }) =>
    saveEntity('ledgerEntries', {
      propertyId, tenancyId, landlordId, tenantId, amount: Number(amount),
      description: description || 'Repair deduction', notes: notes || '',
      entryDate: entryDate || nowIso(),
      monthKey: monthKey(entryDate || new Date()), type: 'REPAIR_DEDUCTION',
    }, 'entry'),

  addAgentFee: ({ propertyId, tenancyId, landlordId, tenantId, amount, description, notes, entryDate }) =>
    saveEntity('ledgerEntries', {
      propertyId, tenancyId, landlordId, tenantId, amount: Number(amount),
      description: description || 'Agent fee', notes: notes || '',
      entryDate: entryDate || nowIso(),
      monthKey: monthKey(entryDate || new Date()), type: 'AGENT_FEE',
    }, 'entry'),

  addManualAdjustment: ({ propertyId, tenancyId, landlordId, tenantId, amount, description, notes, entryDate }) =>
    saveEntity('ledgerEntries', {
      propertyId, tenancyId, landlordId, tenantId, amount: Number(amount),
      description: description || 'Manual adjustment', notes: notes || '',
      entryDate: entryDate || nowIso(),
      monthKey: monthKey(entryDate || new Date()), type: 'MANUAL_ADJUSTMENT',
    }, 'entry'),

  getStatements: () => collection('statements'),

  generateMonthlyStatement: ({ month = monthKey(), landlordId = '', propertyId = '' }) => {
    const data = generateMonthlyStatementData({ month, landlordId, propertyId, entries: collection('ledgerEntries') });
    const statement = {
      id: uid('statement'),
      statementType: 'monthly',
      landlordId: landlordId || null,
      propertyId: propertyId || null,
      tenancyId: null,
      periodStart: data.periodStart,
      periodEnd: data.periodEnd,
      monthKey: month,
      yearKey: null,
      generatedAt: nowIso(),
      totals: data.totals,
      lineItems: data.lineItems,
    };
    withState((state) => {
      state.statements.unshift(statement);
      state.activity.unshift({ id: uid('act'), message: `Monthly statement generated for ${month}`, at: nowIso(), type: 'statement' });
      return state;
    });
    return statement;
  },

  generateYearlyStatement: ({ year = new Date().getFullYear(), landlordId = '', propertyId = '' }) => {
    const data = generateYearlyStatementData({ year, landlordId, propertyId, entries: collection('ledgerEntries') });
    const statement = {
      id: uid('statement'),
      statementType: 'yearly',
      landlordId: landlordId || null,
      propertyId: propertyId || null,
      tenancyId: null,
      periodStart: `${year}-01-01T00:00:00.000Z`,
      periodEnd: `${year}-12-31T23:59:59.000Z`,
      monthKey: null,
      yearKey: String(year),
      generatedAt: nowIso(),
      totals: data.totals,
      lineItems: data.monthlyBreakdown,
    };
    withState((state) => {
      state.statements.unshift(statement);
      state.activity.unshift({ id: uid('act'), message: `Yearly statement generated for ${year}`, at: nowIso(), type: 'statement' });
      return state;
    });
    return statement;
  },

  simulateEmailStatement: ({ statementId, landlordId }) => {
    const state = loadState();
    const statement = state.statements.find(s => s.id === statementId);
    if (!statement) throw new Error('Statement not found');
    const landlord = state.landlords.find(l => l.id === landlordId || l.id === statement.landlordId) || null;
    const preview = buildStatementEmail({ landlord, statement, settings: state.settings });
    const logEntry = simulateEmailLogEntry({ statementId, ...preview });
    withState((draft) => {
      draft.emailLog.unshift(logEntry);
      draft.activity.unshift({ id: uid('act'), message: `Statement email simulated to ${preview.recipient}`, at: nowIso(), type: 'email' });
      return draft;
    });
    return { preview, logEntry };
  },

  updateSettings: (payload) => withState((state) => {
    state.settings = { ...state.settings, ...payload };
    state.activity.unshift({ id: uid('act'), message: 'Settings updated', at: nowIso(), type: 'settings' });
    return state;
  }),

  resetDemoData: () => resetState(),
};
