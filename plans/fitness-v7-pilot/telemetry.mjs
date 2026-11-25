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

export function recoveryFor(samples, endAt, stopAt = Infinity) {
  const window = samples.filter(s => s.t >= endAt - 5000 && s.t <= endAt + 65000 && s.t < stopAt);
  const valid = window.filter(s => s.contact !== false && s.bpm > 0);
  const near = (start, end) => valid.filter(s => s.t >= endAt + start && s.t <= endAt + end);
  const peakWindow = near(-5000, 10000);
  const peak = peakWindow.length >= 3 && peakWindow.some(s => s.t >= endAt) ? Math.max(...peakWindow.map(s => s.bpm)) : null;
  const at = seconds => {
    const readings = near(seconds * 1000 - 3000, seconds * 1000 + 3000);
    if (readings.length < 3 || peak === null) return null;
    const last = readings.at(-1).t;
    const span = window.filter(s => s.t >= peakWindow[0].t && s.t <= last);
    if (span.some((s, i) => s.contact === false || !s.bpm || (i > 0 && s.t - span[i - 1].t > 4000))) return null;
    const sorted = readings.map(s => s.bpm).sort((a, b) => a - b);
    const bpm = sorted[Math.floor(sorted.length / 2)];
    return { bpm, dropFromNearSetPeakBpm: peak - bpm };
  };
  return { nearSetPeakBpm: peak, at30s: at(30), at60s: at(60) };
}
