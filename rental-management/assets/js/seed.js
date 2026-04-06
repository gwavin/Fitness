import { ENTRY_TYPES, monthKey, nowIso, uid } from './utils.js';

function iso(y, m, d) {
  return new Date(Date.UTC(y, m - 1, d)).toISOString();
}

export function getSeedData() {
  const createdAt = nowIso();
  const thisMonth = monthKey(new Date());
  const [year, month] = thisMonth.split('-').map(Number);

  const landlords = [
    {
      id: uid('landlord'),
      name: 'Horizon Lettings Ltd',
      email: 'accounts@horizonlettings.example',
      phone: '+44 20 7900 1234',
      address: '18 Brunswick Square, London',
      notes: 'Prefers statements by 3rd business day.',
      preferredStatementEmail: 'statements@horizonlettings.example',
      paymentReference: 'HZN-LL',
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: uid('landlord'),
      name: 'Emily Carter',
      email: 'emily.carter@example.com',
      phone: '+44 20 7000 9999',
      address: '4 Meadow Court, Reading',
      notes: 'Monthly maintenance budget enabled.',
      preferredStatementEmail: 'emily.carter@example.com',
      paymentReference: 'ECTR',
      createdAt,
      updatedAt: createdAt,
    },
  ];

  const tenants = [
    { id: uid('tenant'), name: 'James Patel', email: 'james.patel@example.com', phone: '+44 7700 900001', notes: 'Pays by bank transfer.', createdAt, updatedAt: createdAt },
    { id: uid('tenant'), name: 'Olivia Shaw', email: 'olivia.shaw@example.com', phone: '+44 7700 900002', notes: 'Requested digital receipts.', createdAt, updatedAt: createdAt },
  ];

  const properties = [
    {
      id: uid('property'),
      addressLine1: '12 Oakfield Road',
      addressLine2: 'Flat 2',
      city: 'London',
      postcode: 'SW11 4AB',
      landlordId: landlords[0].id,
      currentTenantId: tenants[0].id,
      monthlyRent: 1850,
      status: 'occupied',
      notes: 'Recently repainted lounge.',
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: uid('property'),
      addressLine1: '9 Birch Mews',
      addressLine2: '',
      city: 'Reading',
      postcode: 'RG1 5XY',
      landlordId: landlords[1].id,
      currentTenantId: tenants[1].id,
      monthlyRent: 1450,
      status: 'occupied',
      notes: 'Boiler serviced in January.',
      createdAt,
      updatedAt: createdAt,
    },
  ];

  const tenancies = [
    {
      id: uid('tenancy'),
      propertyId: properties[0].id,
      landlordId: landlords[0].id,
      tenantId: tenants[0].id,
      startDate: iso(year, Math.max(1, month - 6), 1),
      endDate: iso(year + 1, month, 1),
      monthlyRent: 1850,
      dueDay: 1,
      agentFeeType: 'percentage',
      agentFeeValue: 10,
      status: 'active',
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: uid('tenancy'),
      propertyId: properties[1].id,
      landlordId: landlords[1].id,
      tenantId: tenants[1].id,
      startDate: iso(year, Math.max(1, month - 3), 1),
      endDate: iso(year + 1, month + 2 > 12 ? 12 : month + 2, 1),
      monthlyRent: 1450,
      dueDay: 3,
      agentFeeType: 'fixed',
      agentFeeValue: 145,
      status: 'active',
      createdAt,
      updatedAt: createdAt,
    },
  ];

  const ledgerEntries = tenancies.flatMap((tenancy) => {
    const rent = tenancy.monthlyRent;
    const agentFee = tenancy.agentFeeType === 'percentage' ? (rent * tenancy.agentFeeValue) / 100 : tenancy.agentFeeValue;
    return [
      {
        id: uid('entry'), propertyId: tenancy.propertyId, tenancyId: tenancy.id, landlordId: tenancy.landlordId, tenantId: tenancy.tenantId,
        entryDate: iso(year, month, 1), monthKey: thisMonth, type: ENTRY_TYPES.RENT_CHARGE,
        description: 'Monthly rent charge', amount: rent, notes: '', createdAt, updatedAt: createdAt,
      },
      {
        id: uid('entry'), propertyId: tenancy.propertyId, tenancyId: tenancy.id, landlordId: tenancy.landlordId, tenantId: tenancy.tenantId,
        entryDate: iso(year, month, 2), monthKey: thisMonth, type: ENTRY_TYPES.PAYMENT_RECEIVED,
        description: 'Tenant payment received', amount: rent, notes: 'Auto matched', createdAt, updatedAt: createdAt,
      },
      {
        id: uid('entry'), propertyId: tenancy.propertyId, tenancyId: tenancy.id, landlordId: tenancy.landlordId, tenantId: tenancy.tenantId,
        entryDate: iso(year, month, 5), monthKey: thisMonth, type: ENTRY_TYPES.AGENT_FEE,
        description: 'Management fee', amount: agentFee, notes: '', createdAt, updatedAt: createdAt,
      },
      {
        id: uid('entry'), propertyId: tenancy.propertyId, tenancyId: tenancy.id, landlordId: tenancy.landlordId, tenantId: tenancy.tenantId,
        entryDate: iso(year, month, 7), monthKey: thisMonth, type: ENTRY_TYPES.REPAIR_DEDUCTION,
        description: 'Minor repair', amount: 75, notes: 'Kitchen tap replacement', createdAt, updatedAt: createdAt,
      },
    ];
  });

  return {
    landlords,
    tenants,
    properties,
    tenancies,
    ledgerEntries,
    statements: [],
    settings: {
      organisationName: 'Northstar Property Management',
      organisationEmail: 'ops@northstarpm.example',
      statementFooter: 'Thank you for partnering with Northstar Property Management.',
      defaultAgentFeeType: 'percentage',
      defaultAgentFeeValue: 10,
    },
    emailLog: [],
    activity: [
      { id: uid('act'), message: 'Demo data initialized', at: createdAt, type: 'system' },
    ],
  };
}
