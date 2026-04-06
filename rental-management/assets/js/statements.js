import { ENTRY_TYPES, groupBy, monthKey, sumBy, yearKey } from './utils.js';

function totalsFromEntries(entries) {
  const rentDue = sumBy(entries.filter(e => e.type === ENTRY_TYPES.RENT_CHARGE), 'amount');
  const payments = sumBy(entries.filter(e => e.type === ENTRY_TYPES.PAYMENT_RECEIVED), 'amount');
  const deductions = sumBy(entries.filter(e => e.type === ENTRY_TYPES.REPAIR_DEDUCTION), 'amount');
  const agentFees = sumBy(entries.filter(e => e.type === ENTRY_TYPES.AGENT_FEE), 'amount');
  const manualAdjustments = sumBy(entries.filter(e => e.type === ENTRY_TYPES.MANUAL_ADJUSTMENT), 'amount');
  const net = payments - deductions - agentFees + manualAdjustments;
  return { rentDue, payments, deductions, agentFees, manualAdjustments, net };
}

export function generateMonthlyStatementData({ month, landlordId, propertyId, entries }) {
  const filtered = entries.filter(entry =>
    entry.monthKey === month &&
    (!landlordId || entry.landlordId === landlordId) &&
    (!propertyId || entry.propertyId === propertyId)
  );

  return {
    monthKey: month,
    periodStart: `${month}-01T00:00:00.000Z`,
    periodEnd: `${month}-31T23:59:59.000Z`,
    lineItems: filtered,
    totals: totalsFromEntries(filtered),
  };
}

export function generateYearlyStatementData({ year, landlordId, propertyId, entries }) {
  const filtered = entries.filter((entry) =>
    yearKey(entry.entryDate) === String(year) &&
    (!landlordId || entry.landlordId === landlordId) &&
    (!propertyId || entry.propertyId === propertyId)
  );

  const monthly = groupBy(filtered, (entry) => entry.monthKey || monthKey(entry.entryDate));
  const monthlyBreakdown = Object.entries(monthly)
    .map(([mKey, monthEntries]) => ({ monthKey: mKey, ...totalsFromEntries(monthEntries) }))
    .sort((a, b) => a.monthKey.localeCompare(b.monthKey));

  return {
    yearKey: String(year),
    lineItems: filtered,
    totals: totalsFromEntries(filtered),
    monthlyBreakdown,
  };
}
