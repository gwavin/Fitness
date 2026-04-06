import { uid, nowIso } from './utils.js';

export function buildStatementEmail({ landlord, statement, settings }) {
  const recipient = landlord?.preferredStatementEmail || landlord?.email || settings.organisationEmail;
  const subject = `${settings.organisationName} Statement ${statement.monthKey || statement.yearKey}`;
  const bodyPreview = `Hello ${landlord?.name || 'Landlord'},\n\nPlease find your statement attached for ${statement.monthKey || statement.yearKey}.\n\n${settings.statementFooter}`;
  return { recipient, subject, bodyPreview };
}

export function simulateEmailLogEntry({ statementId, recipient, subject, bodyPreview }) {
  return {
    id: uid('email'),
    statementId,
    recipient,
    subject,
    bodyPreview,
    sentAt: nowIso(),
    status: 'SENT_SIMULATED',
  };
}
