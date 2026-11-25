// Causal heart-rate inference and rest timing. All times are Unix milliseconds.
const GAP = 4000;
const valid = sample => sample.contact !== false && Number.isFinite(sample.bpm) && sample.bpm > 0;
const mean = values => values.reduce((sum, value) => sum + value, 0) / values.length;

export function createDetector() {
  let samples = [], trend = [], last = null, active = null, lastRise = -Infinity;
  function reset() {
    samples = []; trend = []; last = null; active = null; lastRise = -Infinity;
  }
  function push(sample) {
    if (!valid(sample) || (last !== null && sample.t - last > GAP)) reset();
    if (!valid(sample) || (last !== null && sample.t < last)) return null;
    last = sample.t;
    samples.push(sample);
    while (samples[0].t < sample.t - 6000) samples.shift();
    if (samples.length < 4 || sample.t - samples[0].t < 3000) return null;
    if (trend.length && sample.t - trend.at(-1).t < 900) return null;
    const point = { t: sample.t, bpm: mean(samples.map(row => row.bpm)) };
    trend.push(point);
    while (trend[0].t < point.t - 12500) trend.shift();
    const old = trend.findLast(row => row.t <= point.t - 10000);
    if (!active && old && point.bpm - old.bpm >= 10 && point.t - lastRise >= 35000) {
      active = { startCandidateAt: old.t, riseAt: point.t, peak: point, fallingSince: null };
      lastRise = point.t;
    }
    if (!active) return null;
    if (point.bpm >= active.peak.bpm) active.peak = point;
    active.fallingSince = active.peak.bpm - point.bpm >= 5 ? active.fallingSince ?? point.t : null;
    if (point.t - active.riseAt > 75000) { active = null; return null; }
    if (active.fallingSince === null || point.t - active.fallingSince < 3000) return null;
    const result = { startCandidateAt: active.startCandidateAt, riseAt: active.riseAt,
      endCandidateAt: active.peak.t, detectedAt: point.t, peakBpm: Math.round(active.peak.bpm) };
    active = null;
    return result;
  }
  return { push, reset };
}

export const isWorking = set => /^working\b/i.test(set?.planned?.label ?? set?.label ?? '');
export const isResolved = set => Boolean(set.skipped || set.completedAt || set.pilotSet);
const hasWork = exercise => exercise.sets.some(isWorking);

export function nextSetIndex(exercise) {
  if (exercise.skipped) return -1;
  return exercise.sets.findIndex(set => !isResolved(set) && (!exercise.pilotWorking || isWorking(set)));
}

export function restTarget(exercise, squatBenchSeconds) {
  return /^(barbell-squat|bench-press)(-|$)/i.test(exercise.id)
    ? squatBenchSeconds : exercise.restSeconds;
}

export function restCue(exercise, now) {
  const pending = nextSetIndex(exercise);
  if (pending < 0 || !isWorking(exercise.sets[pending])) return null;
  const previous = exercise.sets.slice(0, pending).findLast(set => isWorking(set) && !set.skipped && set.pilotSet?.greenAt != null);
  const greenAt = previous?.pilotSet.greenAt;
  if (greenAt == null) return null;
  return { greenAt, remaining: Math.max(0, greenAt - now), ready: now >= greenAt };
}

export function saveBoundary(exercise, index, { startAt = null, endAt, observedAt = endAt, source, targetSeconds }) {
  const set = exercise.sets[index];
  const working = isWorking(set);
  if (working) exercise.pilotWorking = true;
  const following = working && exercise.sets.slice(index + 1).some(next => isWorking(next) && !isResolved(next));
  set.pilotSet = { startAt, endAt, observedAt, source, greenAt: following ? observedAt + targetSeconds * 1000 : null };
  if (source === 'tap') set.completedAt = new Date(endAt).toISOString();
  return set.pilotSet;
}

export function classifyCandidate(exercise, candidate, lastActionAt) {
  const index = nextSetIndex(exercise);
  if (index < 0 || !hasWork(exercise) || candidate.riseAt <= lastActionAt) return -1;
  const set = exercise.sets[index];
  // A marked working phase anchors the plan after any missed warm-ups.
  // During a rest, keep extra movement unassigned.
  const cue = restCue(exercise, candidate.riseAt);
  if (isWorking(set) && (!exercise.pilotWorking || (cue && !cue.ready && !set.startedAt))) return -1;
  return index;
}

function contiguous(rows, from, through) {
  return rows.length >= 3 && rows[0].t - from <= GAP && through - rows.at(-1).t <= GAP
    && rows.every((row, i) => valid(row) && (!i || row.t - rows[i - 1].t <= GAP));
}

export function observeRecovery(samples, { startAt, endAt, nextStartAt = null, bound = Infinity, asOf = Infinity }) {
  const cutoff = Math.min(nextStartAt ?? Infinity, bound, endAt + 120000, asOf);
  const candidates = samples.filter(row => row.t >= (startAt ?? endAt) - 20000 && row.t <= cutoff
    && (nextStartAt == null || row.t < nextStartAt));
  const baselineRows = startAt == null ? [] : candidates.filter(row => row.t >= startAt - 20000 && row.t <= startAt - 3000);
  const baselineBpm = startAt != null && contiguous(baselineRows, startAt - 20000, startAt - 3000)
    ? Math.round(mean(baselineRows.map(row => row.bpm))) : null;
  const recovery = candidates.filter(row => row.t >= endAt);
  const peakRows = recovery.filter(row => row.t <= endAt + 20000);
  const peak = peakRows.filter(valid).reduce((best, row) => !best || row.bpm > best.bpm ? row : best, null);
  const hasGap = !contiguous(recovery, endAt, cutoff);
  const point = t => {
    if (t > cutoff || (nextStartAt != null && t >= nextStartAt)) return null;
    const tail = recovery.filter(row => row.t >= t - 5000 && row.t <= t);
    return contiguous(tail, t - 5000, t) ? Math.round(mean(tail.map(row => row.bpm))) : null;
  };
  let experimentalGreenAt = null;
  // At each candidate decision, the peak window has already elapsed.
  if (baselineBpm !== null && peak && peak.bpm - baselineBpm >= 8) {
    for (let t = endAt + 45000; t <= cutoff; t += 1000) {
      const seen = recovery.filter(row => row.t <= t);
      if (!contiguous(seen, endAt, t)) break;
      const bpm = point(t);
      if (bpm !== null && bpm <= baselineBpm + 0.4 * (peak.bpm - baselineBpm)) {
        experimentalGreenAt = t;
        break;
      }
    }
  }
  const bpmAt45 = point(endAt + 45000);
  return { baselineBpm, peakBpm: peak?.bpm ?? null, peakAt: peak?.t ?? null, hasGap,
    bpmAt45, dropAt45: bpmAt45 == null || !peak ? null : peak.bpm - bpmAt45,
    experimentalGreenAt, status: experimentalGreenAt === null ? 'no_estimate' : 'estimated',
    rule: 'pilot-v1: 45s floor, 60% from peak toward baseline, continuous signal' };
}

export function buildPilotReport(session, samples) {
  const sets = session.exercises.flatMap(exercise => exercise.sets.flatMap((set, index) => {
    if (set.skipped || (!set.completedAt && !set.pilotSet)) return [];
    const data = set.pilotSet;
    const markedStart = set.startedAt ? Date.parse(set.startedAt) : null;
    return [{ exerciseId: exercise.id, lift: exercise.label, setNumber: index + 1, label: set.label,
      working: isWorking(set), confirmed: Boolean(set.completedAt), planned: set.planned,
      load: set.completedAt ? set.load : null, reps: set.completedAt ? set.reps : null,
      rir: set.completedAt ? set.rir || null : null,
      startAt: markedStart ?? data?.startAt ?? null,
      startSource: markedStart != null ? 'tap' : data?.startAt != null ? 'hr' : null,
      endAt: data?.endAt ?? Date.parse(set.completedAt), endSource: data?.source ?? 'tap',
      detectorObservedAt: data?.source === 'hr' ? data.observedAt : null,
      timerGreenAt: data?.greenAt ?? null }];
  })).sort((a, b) => a.endAt - b.endAt);
  const cutoff = Math.max(samples.at(-1)?.t ?? -Infinity, Date.parse(session.endedAt || session.startedAt));
  const rests = sets.flatMap((set, index) => {
    if (!set.working || set.timerGreenAt == null) return [];
    const next = sets[index + 1];
    const nextStartAt = next?.startAt > set.endAt ? next.startAt : null;
    const comparesSameLift = next?.exerciseId === set.exerciseId && next.working;
    const shadow = observeRecovery(samples, { startAt: set.startAt, endAt: set.endAt, nextStartAt,
      bound: next?.endAt ?? Infinity, asOf: cutoff });
    return [{ ...set, ...shadow, timerGreenReachedBeforeNextStart: nextStartAt == null ? null : set.timerGreenAt <= nextStartAt,
      nextStartAt, nextStartSource: nextStartAt != null ? next.startSource : null,
      nextReps: comparesSameLift ? next.reps : null, nextRir: comparesSameLift ? next.rir : null,
      secondsFrom45ToNextStart: nextStartAt == null ? null : Math.round((nextStartAt - set.endAt) / 1000) - 45 }];
  });
  return { version: 1, sets, rests, candidates: session.pilotEvents ?? [] };
}
