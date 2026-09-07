const ENTRY_TYPES = {
  RENT_CHARGE: 'RENT_CHARGE',
  PAYMENT_RECEIVED: 'PAYMENT_RECEIVED',
  REPAIR_DEDUCTION: 'REPAIR_DEDUCTION',
  AGENT_FEE: 'AGENT_FEE',
};

const entries = [];
for (let i = 0; i < 10000; i++) {
  const type = Object.values(ENTRY_TYPES)[Math.floor(Math.random() * 4)];
  entries.push({ type, amount: Math.random() * 1000 });
}

function original() {
  const byType = (type) => entries.filter(e => e.type === type).reduce((s, e) => s + Number(e.amount || 0), 0);
  const rentDue = byType(ENTRY_TYPES.RENT_CHARGE);
  const paid = byType(ENTRY_TYPES.PAYMENT_RECEIVED);
  const deductions = byType(ENTRY_TYPES.REPAIR_DEDUCTION);
  const fees = byType(ENTRY_TYPES.AGENT_FEE);
  const net = paid - deductions - fees;
  return net;
}

function optimized() {
  const totals = entries.reduce((acc, e) => {
    const amt = Number(e.amount || 0);
    if (e.type === ENTRY_TYPES.RENT_CHARGE) acc.rentDue += amt;
    else if (e.type === ENTRY_TYPES.PAYMENT_RECEIVED) acc.paid += amt;
    else if (e.type === ENTRY_TYPES.REPAIR_DEDUCTION) acc.deductions += amt;
    else if (e.type === ENTRY_TYPES.AGENT_FEE) acc.fees += amt;
    return acc;
  }, { rentDue: 0, paid: 0, deductions: 0, fees: 0 });

  const rentDue = totals.rentDue;
  const paid = totals.paid;
  const deductions = totals.deductions;
  const fees = totals.fees;
  const net = paid - deductions - fees;
  return net;
}

const startOriginal = performance.now();
for (let i = 0; i < 1000; i++) {
  original();
}
const endOriginal = performance.now();

const startOptimized = performance.now();
for (let i = 0; i < 1000; i++) {
  optimized();
}
const endOptimized = performance.now();

console.log(`Original: ${(endOriginal - startOriginal).toFixed(2)} ms`);
console.log(`Optimized: ${(endOptimized - startOptimized).toFixed(2)} ms`);
