import { services } from './services.js';
import { ENTRY_TYPES, escapeHtml, formatCurrency, formatDate, monthKey, toInputDate } from './utils.js';

const appEl = document.getElementById('app');
const toastEl = document.getElementById('toast');
const modalEl = document.getElementById('modal');

export function toast(message) {
  toastEl.textContent = message;
  toastEl.classList.add('show');
  setTimeout(() => toastEl.classList.remove('show'), 2600);
}

function layout(content, title = 'Dashboard') {
  return `<section class="page"><header class="page-header"><h1>${title}</h1></header>${content}</section>`;
}

function entityOptions(items, currentId) {
  return `<option value="">— Select —</option>${items
    .map(item => `<option value="${item.id}" ${item.id === currentId ? 'selected' : ''}>${escapeHtml(item.name || item.addressLine1)}</option>`)
    .join('')}`;
}

function cardStat(label, value) {
  return `<article class="card stat"><p>${label}</p><h3>${value}</h3></article>`;
}

function renderDashboard() {
  const state = services.getState();
  const currentMonth = monthKey();
  const entries = services.getLedgerEntries(currentMonth);
  const byType = (type) => entries.filter(e => e.type === type).reduce((s, e) => s + Number(e.amount || 0), 0);
  const rentDue = byType(ENTRY_TYPES.RENT_CHARGE);
  const paid = byType(ENTRY_TYPES.PAYMENT_RECEIVED);
  const deductions = byType(ENTRY_TYPES.REPAIR_DEDUCTION);
  const fees = byType(ENTRY_TYPES.AGENT_FEE);
  const net = paid - deductions - fees;

  const recent = (state.activity || []).slice(0, 8)
    .map(item => `<li><strong>${escapeHtml(item.message)}</strong><span>${formatDate(item.at)}</span></li>`).join('');

  appEl.innerHTML = layout(`
    <div class="grid stats-grid">
      ${cardStat('Total properties', state.properties.length)}
      ${cardStat('Total landlords', state.landlords.length)}
      ${cardStat('Total tenants', state.tenants.length)}
      ${cardStat('Rent due this month', formatCurrency(rentDue))}
      ${cardStat('Payments received', formatCurrency(paid))}
      ${cardStat('Deductions', formatCurrency(deductions))}
      ${cardStat('Agent fees', formatCurrency(fees))}
      ${cardStat('Net payable', formatCurrency(net))}
    </div>
    <div class="grid split-grid">
      <article class="card"><h3>Recent activity</h3><ul class="activity-list">${recent || '<li>No activity yet.</li>'}</ul></article>
      <article class="card"><h3>Upcoming statement run</h3><p>Next run target: 1st business day of next month.</p><p>Entries in ${currentMonth}: <strong>${entries.length}</strong></p><a class="btn" href="#/monthly-statement">Preview monthly statement</a></article>
    </div>
  `, 'Dashboard');
}

function simpleTable(headers, rows) {
  return `<div class="table-wrap"><table><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows || '<tr><td colspan="10">No records found.</td></tr>'}</tbody></table></div>`;
}

function renderEntityList({ type, title, fields }) {
  const items = services[`get${type}`]();
  const rows = items.map(item => `<tr>${fields.map(f => `<td>${escapeHtml(item[f] ?? '—')}</td>`).join('')}<td><a href="#/${type.toLowerCase()}/${item.id}">View</a></td></tr>`).join('');
  appEl.innerHTML = layout(`
    <div class="toolbar"><a class="btn" href="#/${type.toLowerCase()}/new">Add ${title.slice(0, -1)}</a></div>
    ${simpleTable([...fields, ''], rows)}
  `, title);
}

function renderDetailForm({ entityName, id, fields }) {
  const getFn = services[`get${entityName}`].bind(services);
  const saveFn = services[`save${entityName}`].bind(services);
  const delFn = services[`delete${entityName}`].bind(services);
  const record = id === 'new' ? {} : getFn(id);
  if (id !== 'new' && !record) return void (appEl.innerHTML = layout('<p>Record not found.</p>', `${entityName} detail`));

  const state = services.getState();
  appEl.innerHTML = layout(`
    <form id="entity-form" data-entity="${entityName}" data-id="${id}" class="card form-grid">
      ${fields.map(field => {
        const value = record[field.name] || '';
        if (field.type === 'select') {
          let options = '<option value="">— Select —</option>';
          if (field.source === 'landlords') options += entityOptions(state.landlords, value);
          if (field.source === 'tenants') options += entityOptions(state.tenants, value);
          if (field.source === 'properties') options += entityOptions(state.properties, value);
          return `<label>${field.label}<select name="${field.name}" ${field.required ? 'required' : ''}>${options}</select></label>`;
        }
        return `<label>${field.label}<input type="${field.type || 'text'}" name="${field.name}" value="${escapeHtml(value)}" ${field.required ? 'required' : ''}></label>`;
      }).join('')}
      <label class="full">Notes<textarea name="notes">${escapeHtml(record.notes || '')}</textarea></label>
      <div class="form-actions full"><button class="btn" type="submit">Save</button>${id !== 'new' ? '<button class="btn danger" type="button" id="delete-btn">Delete</button>' : ''}</div>
    </form>
  `, `${entityName}${id === 'new' ? ' - Add' : ' - Edit'}`);

  document.getElementById('entity-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const payload = { ...(record || {}) };
    for (const [k, v] of fd.entries()) payload[k] = v;
    if (payload.monthlyRent) payload.monthlyRent = Number(payload.monthlyRent);
    if (payload.agentFeeValue) payload.agentFeeValue = Number(payload.agentFeeValue);
    if (payload.dueDay) payload.dueDay = Number(payload.dueDay);
    saveFn(payload);
    toast(`${entityName} saved`);
    window.location.hash = `#/${entityName.toLowerCase()}s`;
  });

  document.getElementById('delete-btn')?.addEventListener('click', () => {
    if (!confirm('Are you sure you want to delete this record?')) return;
    delFn(record.id);
    toast(`${entityName} deleted`);
    window.location.hash = `#/${entityName.toLowerCase()}s`;
  });
}

function renderLedger(query = {}) {
  const state = services.getState();
  const selectedMonth = query.month || monthKey();
  const entries = services.getLedgerEntries(selectedMonth, { propertyId: query.propertyId || '', landlordId: query.landlordId || '' });
  const rows = entries.map(entry => `<tr><td>${formatDate(entry.entryDate)}</td><td>${entry.type}</td><td>${escapeHtml(entry.description)}</td><td>${formatCurrency(entry.amount)}</td><td>${escapeHtml(entry.notes || '')}</td></tr>`).join('');

  appEl.innerHTML = layout(`
    <article class="card">
      <form id="ledger-filter" class="inline-form">
        <label>Month<input type="month" name="month" value="${selectedMonth}"></label>
        <label>Property<select name="propertyId">${entityOptions(state.properties, query.propertyId)}</select></label>
        <label>Landlord<select name="landlordId">${entityOptions(state.landlords, query.landlordId)}</select></label>
        <button class="btn" type="submit">Apply</button>
      </form>
    </article>
    <article class="card">
      <h3>Monthly ledger entries</h3>
      ${simpleTable(['Date', 'Type', 'Description', 'Amount', 'Notes'], rows)}
    </article>
    <article class="card">
      <h3>Add deduction / fee / adjustment</h3>
      <form id="entry-form" class="form-grid compact">
        <label>Type<select name="type" required><option value="REPAIR_DEDUCTION">Repair deduction</option><option value="AGENT_FEE">Agent fee</option><option value="MANUAL_ADJUSTMENT">Manual adjustment</option></select></label>
        <label>Tenancy<select name="tenancyId" required>${entityOptions(state.tenancies, '')}</select></label>
        <label>Date<input type="date" name="entryDate" value="${toInputDate(new Date().toISOString())}" required></label>
        <label>Amount<input type="number" min="0" step="0.01" name="amount" required></label>
        <label class="full">Description<input type="text" name="description" required></label>
        <label class="full">Notes<textarea name="notes"></textarea></label>
        <button class="btn" type="submit">Add entry</button>
      </form>
    </article>
  `, 'Monthly Ledger');

  document.getElementById('ledger-filter').addEventListener('submit', (e) => {
    e.preventDefault();
    const params = new URLSearchParams(new FormData(e.target));
    window.location.hash = `#/ledger?${params.toString()}`;
  });

  document.getElementById('entry-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const tenancy = state.tenancies.find(t => t.id === fd.get('tenancyId'));
    const payload = {
      ...Object.fromEntries(fd.entries()),
      propertyId: tenancy.propertyId,
      landlordId: tenancy.landlordId,
      tenantId: tenancy.tenantId,
      amount: Number(fd.get('amount')),
    };
    const type = payload.type;
    if (type === 'REPAIR_DEDUCTION') services.addDeduction(payload);
    if (type === 'AGENT_FEE') services.addAgentFee(payload);
    if (type === 'MANUAL_ADJUSTMENT') services.addManualAdjustment(payload);
    toast('Ledger entry added');
    window.location.hash = `#/ledger?month=${selectedMonth}`;
  });
}

function renderMonthlyStatement(query = {}) {
  const state = services.getState();
  const month = query.month || monthKey();
  const landlordId = query.landlordId || '';
  const propertyId = query.propertyId || '';
  const statement = services.generateMonthlyStatement({ month, landlordId, propertyId });
  const rows = statement.lineItems.map(li => `<tr><td>${formatDate(li.entryDate)}</td><td>${li.type}</td><td>${escapeHtml(li.description)}</td><td>${formatCurrency(li.amount)}</td></tr>`).join('');
  appEl.innerHTML = layout(`
    <article class="card no-print"><form id="statement-filter" class="inline-form"><label>Month<input type="month" name="month" value="${month}"></label><label>Landlord<select name="landlordId">${entityOptions(state.landlords, landlordId)}</select></label><label>Property<select name="propertyId">${entityOptions(state.properties, propertyId)}</select></label><button class="btn">Refresh</button></form></article>
    <article class="card statement">
      <header><h2>${escapeHtml(state.settings.organisationName)}</h2><p>Monthly Statement: ${month}</p></header>
      <p><strong>Landlord:</strong> ${escapeHtml(state.landlords.find(l => l.id === landlordId)?.name || 'All landlords')}</p>
      <p><strong>Property:</strong> ${escapeHtml(state.properties.find(p => p.id === propertyId)?.addressLine1 || 'All properties')}</p>
      ${simpleTable(['Date', 'Type', 'Description', 'Amount'], rows)}
      <div class="totals"><p>Rent due: ${formatCurrency(statement.totals.rentDue)}</p><p>Payments: ${formatCurrency(statement.totals.payments)}</p><p>Deductions: ${formatCurrency(statement.totals.deductions)}</p><p>Agent fees: ${formatCurrency(statement.totals.agentFees)}</p><h3>Net amount: ${formatCurrency(statement.totals.net)}</h3></div>
      <p><strong>Notes:</strong> Client-side generated preview only. Real issuance and immutable records require backend workflows.</p>
      <div class="no-print"><button class="btn" id="email-statement">Email statement</button> <button class="btn" id="print-statement">Download/Print</button></div>
    </article>
  `, 'Monthly Statement Preview');

  document.getElementById('statement-filter').addEventListener('submit', (e) => {
    e.preventDefault();
    const params = new URLSearchParams(new FormData(e.target));
    window.location.hash = `#/monthly-statement?${params.toString()}`;
  });
  document.getElementById('print-statement').addEventListener('click', () => window.print());
  document.getElementById('email-statement').addEventListener('click', () => {
    const targetLandlordId = landlordId || state.landlords[0]?.id;
    const { preview } = services.simulateEmailStatement({ statementId: statement.id, landlordId: targetLandlordId });
    modalEl.innerHTML = `<div class="modal-body"><h3>Email preview</h3><p><strong>To:</strong> ${escapeHtml(preview.recipient)}</p><p><strong>Subject:</strong> ${escapeHtml(preview.subject)}</p><pre>${escapeHtml(preview.bodyPreview)}</pre><p class="hint">Simulated only. Real email requires backend provider integration.</p><button class="btn" id="close-modal">Close</button></div>`;
    modalEl.classList.add('show');
    document.getElementById('close-modal').addEventListener('click', () => modalEl.classList.remove('show'));
    toast('Statement email simulated');
  });
}

function renderYearlyStatement(query = {}) {
  const state = services.getState();
  const year = query.year || String(new Date().getFullYear());
  const statement = services.generateYearlyStatement({ year, landlordId: query.landlordId || '', propertyId: query.propertyId || '' });
  const rows = statement.lineItems.map(row => `<tr><td>${row.monthKey}</td><td>${formatCurrency(row.rentDue)}</td><td>${formatCurrency(row.payments)}</td><td>${formatCurrency(row.deductions)}</td><td>${formatCurrency(row.agentFees)}</td><td>${formatCurrency(row.net)}</td></tr>`).join('');

  appEl.innerHTML = layout(`
    <article class="card no-print"><form id="yearly-filter" class="inline-form"><label>Year<input type="number" name="year" min="2020" max="2100" value="${year}"></label><label>Landlord<select name="landlordId">${entityOptions(state.landlords, query.landlordId)}</select></label><label>Property<select name="propertyId">${entityOptions(state.properties, query.propertyId)}</select></label><button class="btn">Refresh</button></form></article>
    <article class="card statement"><h2>Yearly Statement ${year}</h2>
    <div class="totals"><p>Total rent: ${formatCurrency(statement.totals.rentDue)}</p><p>Total payments: ${formatCurrency(statement.totals.payments)}</p><p>Total deductions: ${formatCurrency(statement.totals.deductions)}</p><p>Total agent fees: ${formatCurrency(statement.totals.agentFees)}</p><h3>Annual net paid: ${formatCurrency(statement.totals.net)}</h3></div>
    ${simpleTable(['Month', 'Rent', 'Payments', 'Deductions', 'Agent Fees', 'Net'], rows)}</article>
  `, 'Yearly Statement Preview');

  document.getElementById('yearly-filter').addEventListener('submit', (e) => {
    e.preventDefault();
    const params = new URLSearchParams(new FormData(e.target));
    window.location.hash = `#/yearly-statement?${params.toString()}`;
  });
}

function renderSettings() {
  const settings = services.getState().settings;
  appEl.innerHTML = layout(`
    <article class="card"><form id="settings-form" class="form-grid">
      <label>Organisation name<input name="organisationName" value="${escapeHtml(settings.organisationName)}" required></label>
      <label>Organisation email<input name="organisationEmail" value="${escapeHtml(settings.organisationEmail)}" type="email" required></label>
      <label>Logo placeholder<input name="logo" value="" placeholder="Logo URL (future backend asset)"></label>
      <label>Default agent fee type<select name="defaultAgentFeeType"><option value="percentage" ${settings.defaultAgentFeeType === 'percentage' ? 'selected' : ''}>Percentage</option><option value="fixed" ${settings.defaultAgentFeeType === 'fixed' ? 'selected' : ''}>Fixed</option></select></label>
      <label>Default agent fee value<input type="number" step="0.01" name="defaultAgentFeeValue" value="${settings.defaultAgentFeeValue}"></label>
      <label class="full">Statement footer<textarea name="statementFooter">${escapeHtml(settings.statementFooter)}</textarea></label>
      <label class="full">Email template preview<textarea readonly>Hello {{landlordName}}, your statement for {{period}} is ready.</textarea></label>
      <div class="form-actions full"><button class="btn" type="submit">Save settings</button><button class="btn danger" type="button" id="reset-data">Reset demo data</button></div>
    </form></article>
  `, 'Settings');

  document.getElementById('settings-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(e.target).entries());
    payload.defaultAgentFeeValue = Number(payload.defaultAgentFeeValue);
    services.updateSettings(payload);
    toast('Settings saved');
  });

  document.getElementById('reset-data').addEventListener('click', () => {
    if (!confirm('Reset all prototype data to demo defaults?')) return;
    services.resetDemoData();
    toast('Demo data reset');
    window.location.hash = '#/dashboard';
  });
}

export function renderRoute(route) {
  const key = route.resource;
  const id = route.id;

  if (key === 'dashboard') return renderDashboard();
  if (key === 'landlords') return renderEntityList({ type: 'Landlords', title: 'Landlords', fields: ['name', 'email', 'phone'] });
  if (key === 'landlord') return renderDetailForm({ entityName: 'Landlord', id, fields: [
    { name: 'name', label: 'Name', required: true }, { name: 'email', label: 'Email', type: 'email', required: true },
    { name: 'phone', label: 'Phone' }, { name: 'address', label: 'Address' },
    { name: 'preferredStatementEmail', label: 'Preferred statement email', type: 'email' }, { name: 'paymentReference', label: 'Payment reference' },
  ]});
  if (key === 'tenants') return renderEntityList({ type: 'Tenants', title: 'Tenants', fields: ['name', 'email', 'phone'] });
  if (key === 'tenant') return renderDetailForm({ entityName: 'Tenant', id, fields: [
    { name: 'name', label: 'Name', required: true }, { name: 'email', label: 'Email', type: 'email', required: true },
    { name: 'phone', label: 'Phone' },
  ]});
  if (key === 'properties') return renderEntityList({ type: 'Properties', title: 'Properties', fields: ['addressLine1', 'city', 'postcode', 'status'] });
  if (key === 'property') return renderDetailForm({ entityName: 'Property', id, fields: [
    { name: 'addressLine1', label: 'Address line 1', required: true }, { name: 'addressLine2', label: 'Address line 2' },
    { name: 'city', label: 'City', required: true }, { name: 'postcode', label: 'Postcode', required: true },
    { name: 'landlordId', label: 'Landlord', type: 'select', source: 'landlords' }, { name: 'currentTenantId', label: 'Tenant', type: 'select', source: 'tenants' },
    { name: 'monthlyRent', label: 'Monthly rent', type: 'number' }, { name: 'status', label: 'Status' },
  ]});
  if (key === 'tenancies') return renderEntityList({ type: 'Tenancies', title: 'Tenancies', fields: ['status', 'startDate', 'endDate', 'monthlyRent'] });
  if (key === 'tenancy') return renderDetailForm({ entityName: 'Tenancy', id, fields: [
    { name: 'propertyId', label: 'Property', type: 'select', source: 'properties', required: true },
    { name: 'landlordId', label: 'Landlord', type: 'select', source: 'landlords', required: true },
    { name: 'tenantId', label: 'Tenant', type: 'select', source: 'tenants', required: true },
    { name: 'startDate', label: 'Start date', type: 'date' }, { name: 'endDate', label: 'End date', type: 'date' },
    { name: 'monthlyRent', label: 'Monthly rent', type: 'number', required: true },
    { name: 'dueDay', label: 'Due day', type: 'number', required: true },
    { name: 'agentFeeType', label: 'Agent fee type' }, { name: 'agentFeeValue', label: 'Agent fee value', type: 'number' },
    { name: 'status', label: 'Status' },
  ]});
  if (key === 'ledger') return renderLedger(route.query);
  if (key === 'monthly-statement') return renderMonthlyStatement(route.query);
  if (key === 'yearly-statement') return renderYearlyStatement(route.query);
  if (key === 'settings') return renderSettings();

  appEl.innerHTML = layout('<p>Page not found.</p>', 'Not Found');
}
