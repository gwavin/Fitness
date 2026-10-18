export const BRIDGE_PACKAGE = 'ie.gavinhoran.fitnessclockbridge';
export function clockBridgeLink(seconds, requestId, issuedAt, fallbackUrl) {
  if (!Number.isInteger(seconds) || seconds < 15 || seconds > 3600) throw Error('Google Clock handoff supports 15 seconds to 60 minutes.');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(requestId)) throw Error('Invalid handoff request ID.');
  if (!Number.isSafeInteger(issuedAt) || !/^[0-9]{13}$/.test(String(issuedAt))) throw Error('Invalid handoff time.');
  const fallback = new URL(fallbackUrl);
  if (!['https:', 'http:'].includes(fallback.protocol)) throw Error('Invalid fallback URL.');
  const query = new URLSearchParams({ seconds: String(seconds), requestId, issuedAt: String(issuedAt) });
  return `intent://timer?${query}#Intent;scheme=fitnessclock;package=${BRIDGE_PACKAGE};S.browser_fallback_url=${encodeURIComponent(fallback.href)};end`;
}
