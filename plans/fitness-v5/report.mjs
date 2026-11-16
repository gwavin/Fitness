const BLOCK_MS = 300000;
const median = sorted => Math.round((sorted[Math.floor((sorted.length - 1) / 2)] + sorted[Math.floor(sorted.length / 2)]) / 2);

export function classReport(session, samples) {
  const elapsedMs = session.endedAt - session.startedAt;
  const seconds = new Map();
  for (const sample of samples) {
    if (sample.contact === false || !(sample.bpm > 0) || !Number.isFinite(sample.t)) continue;
    const offset = sample.t - session.startedAt;
    if (offset < 0 || offset >= elapsedMs) continue;
    const slot = Math.floor(offset / 1000);
    const values = seconds.get(slot) ?? [];
    values.push(sample.bpm);
    seconds.set(slot, values);
  }
  const readings = [...seconds].map(([slot, values]) => [slot * 1000, median(values.sort((a, b) => a - b))]);
  const summarise = (start, end) => {
    const bpm = readings.filter(([at]) => at >= start && at < end).map(([, value]) => value).sort((a, b) => a - b);
    return {
      startMs: start, endMs: end,
      coveragePct: Math.min(100, Math.round(100 * bpm.length / Math.max(1, Math.ceil((end - start) / 1000)))),
      medianBpm: bpm.length ? median(bpm) : null,
      p95Bpm: bpm.length ? bpm[Math.ceil(bpm.length * .95) - 1] : null
    };
  };
  const blocks = [];
  for (let start = 0; start < elapsedMs; start += BLOCK_MS) blocks.push(summarise(start, Math.min(start + BLOCK_MS, elapsedMs)));
  const markers = session.markers.filter(mark => mark.t >= session.startedAt && mark.t < session.endedAt);
  const phases = markers.map((mark, i) => ({
    label: mark.label,
    ...summarise(Math.ceil((mark.t - session.startedAt) / 1000) * 1000,
      Math.min(elapsedMs, Math.ceil(((markers[i + 1]?.t ?? session.endedAt) - session.startedAt) / 1000) * 1000))
  }));
  return { ...summarise(0, elapsedMs), blocks, phases, sampleCount: samples.length };
}
