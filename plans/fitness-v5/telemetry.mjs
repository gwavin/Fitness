// Bluetooth Heart Rate Measurement (0x2A37). RR units are 1/1024 second.
export function decodeMeasurement(value) {
  if (value.byteLength < 2) return null;
  const flags = value.getUint8(0);
  const wide = Boolean(flags & 1);
  let offset = wide ? 3 : 2;
  if (value.byteLength < offset) return null;
  const bpm = wide ? value.getUint16(1, true) : value.getUint8(1);
  const contact = flags & 4 ? Boolean(flags & 2) : null;
  let energy = null;
  if (flags & 8) {
    if (value.byteLength < offset + 2) return null;
    energy = value.getUint16(offset, true);
    offset += 2;
  }
  const rr1024 = [];
  if (flags & 16) {
    if ((value.byteLength - offset) % 2 || offset === value.byteLength) return null;
    for (; offset < value.byteLength; offset += 2) rr1024.push(value.getUint16(offset, true));
  }
  return { bpm, contact, rr1024, energy };
}

