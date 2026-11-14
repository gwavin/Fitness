// Bluetooth SIG Heart Rate Measurement (0x2A37).
export function readBpm(value) {
  if (value.byteLength < 2) return null;
  const flags = value.getUint8(0);
  if ((flags & 6) === 4 || ((flags & 1) && value.byteLength < 3)) return null;
  const bpm = flags & 1 ? value.getUint16(1, true) : value.getUint8(1);
  return bpm > 0 ? bpm : null;
}

const SIGNAL_TIMEOUT = 5000;

export class EffortSignal {
  reset() {
    this.phase = 'waiting';
    this.samples = [];
    this.last = null;
    this.bpm = null;
    this.smooth = null;
    this.baseline = null;
    this.candidate = null;
    this.peak = null;
    this.low = null;
  }

  constructor() { this.reset(); }

  expire(now) {
    if (this.last !== null && now - this.last >= SIGNAL_TIMEOUT) this.reset();
  }

  change(phase, now) {
    this.phase = phase;
    this.since = now;
    this.candidate = null;
    if (phase === 'effort') this.peak = this.smooth;
    if (phase === 'recovery' && this.peak == null) this.peak = this.smooth;
    if (phase === 'ready') this.peak = null;
  }

  sustain(condition, now, duration) {
    if (!condition) { this.candidate = null; return false; }
    if (this.candidate?.condition !== condition) this.candidate = { condition, now };
    return now - this.candidate.now >= duration;
  }

  ingest(bpm, now) {
    this.expire(now);
    this.last = now;
    this.bpm = bpm;
    this.samples.push({ bpm, now });
    this.samples = this.samples.filter(sample => now - sample.now <= 4000).slice(-20);
    const sorted = this.samples.map(sample => sample.bpm).sort((a, b) => a - b);
    this.smooth = sorted[Math.floor(sorted.length / 2)];

    if (this.phase === 'waiting') {
      this.calibrationStart = now;
      this.change('calibrating', now);
    }
    if (this.phase === 'calibrating') {
      if (now - this.calibrationStart >= 8000 && sorted.length >= 3) {
        this.baseline = this.smooth;
        this.change('ready', now);
      }
      return;
    }
    if (this.phase === 'ready') {
      if (this.sustain(this.smooth >= this.baseline + 8, now, 2000)) this.change('effort', now);
      else if (this.smooth <= this.baseline + 3) this.baseline += (this.smooth - this.baseline) * 0.05;
      return;
    }

    this.peak = Math.max(this.peak, this.smooth);
    if (this.phase === 'effort') {
      if (this.sustain(this.smooth <= this.peak - 5 && now - this.since >= 5000, now, 3000)) {
        this.change('recovery', now);
        this.low = this.smooth;
      }
      return;
    }

    this.low = Math.min(this.low, this.smooth);
    const target = this.baseline + Math.max(4, (this.peak - this.baseline) * 0.35);
    // A distinct rise during recovery can begin the next effort before green.
    const next = this.smooth >= this.low + 8 ? 'effort' : this.smooth <= target ? 'ready' : null;
    if (this.sustain(next, now, 3000)) this.change(next, now);
  }

  manual(now) {
    this.expire(now);
    if (this.baseline === null) return;
    if (this.phase === 'effort') {
      this.change('recovery', now);
      this.low = this.smooth;
    } else {
      this.change('effort', now);
    }
  }
}
