// Fitness v7 · hands-free autopilot core. Pure logic: no DOM, so the same code runs
// live (Bluetooth strap), in replay mode and in the Node backtest. Times are Unix ms.

export const DETECTOR_DEFAULTS = Object.freeze({
  emaAlpha: 0.4,        // smoothing of 1 s HR bins (≈2 s time constant)
  slopeWindowS: 6,      // least-squares slope window
  onSlope: 0.5,         // bpm/s rise needed to call a set start
  onRise: 6,            // bpm above the recent trough needed to call a set start
  troughWindowS: 40,    // trough = lowest smoothed HR in this window (and since the last set)
  offDrop: 4,           // bpm below the set peak needed to call the set finished
  offSlope: -0.25,      // and HR must be falling at least this fast…
  offHoldS: 3,          // …for this many seconds
  minWorkS: 10,         // shorter bouts are not sets
  maxWorkS: 110,        // longest set/carry before the peak is forced as the end
  minAmp: 8,            // peak − trough below this = fidget, not a set
  minRestS: 25,         // no new set within this many seconds of the last one ending
  earlyRestFraction: 0.45, // before this share of the planned rest has passed…
  earlyFactor: 1.5,     // …a start needs a 1.5× bigger rise (stops walking/plate-loading triggers)
  startLeadS: 2,        // HR trough lags the first rep by a couple of seconds
  endLagS: 6,           // HR peaks a few seconds after the bar is racked
  gapMs: 5000,          // signal gap that resets the detector
  motionBoost: 0.6      // optional: if phone motion confirms, the needed rise is × this
});

const median = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[s.length >> 1] : NaN; };

// Instantaneous HR from beat-to-beat intervals with a simple artefact filter; falls
// back to the strap's own bpm when no RR is present.
export function createHrCleaner() {
  const recent = [];
  return function clean(sample) {
    if (!sample || sample.contact === false || !(sample.bpm > 0)) return null;
    const good = [];
    for (const rr of sample.rr1024 || []) {
      const ms = rr * 1000 / 1024;
      if (ms < 300 || ms > 2000) continue;                         // 30–200 bpm
      const ref = recent.length >= 3 ? median(recent) : 60000 / sample.bpm;
      if (Math.abs(ms - ref) / ref > 0.25) continue;               // ectopic / dropped beat
      good.push(ms); recent.push(ms); if (recent.length > 7) recent.shift();
    }
    const hr = good.length ? 60000 / (good.reduce((a, b) => a + b, 0) / good.length) : sample.bpm;
    return { t: sample.t, hr };
  };
}

export function createSetDetector(options = {}) {
  const o = { ...DETECTOR_DEFAULTS, ...options };
  const clean = createHrCleaner();
  let bins, ema, series, state, trough, troughAt, onsetAt, onsetEst, peak, peakAt, fallCount, lastEndAt, lastT, expectation, motionUntil;
  function reset(keepExpectation = true) {
    bins = new Map(); ema = null; series = []; state = 'rest'; trough = Infinity; troughAt = null;
    onsetAt = null; onsetEst = null; peak = -Infinity; peakAt = null; fallCount = 0; lastT = null; motionUntil = 0;
    if (!keepExpectation) { lastEndAt = -Infinity; expectation = { restTargetS: 75, lastSetEndAt: -Infinity }; }
  }
  lastEndAt = -Infinity; expectation = { restTargetS: 75, lastSetEndAt: -Infinity };
  reset();

  // The session layer tells the detector what rest is planned (sequence prior).
  function expect(next) { expectation = { ...expectation, ...next }; }
  function motion(t) { motionUntil = t + 8000; }

  function slopeAt() {
    const w = series.slice(-o.slopeWindowS);
    if (w.length < 4) return 0;
    const n = w.length, mt = w.reduce((a, p) => a + p.s, 0) / n, mh = w.reduce((a, p) => a + p.h, 0) / n;
    let num = 0, den = 0;
    for (const p of w) { num += (p.s - mt) * (p.h - mh); den += (p.s - mt) ** 2; }
    return den ? num / den : 0;
  }

  function step(sec, hr) {
    ema = ema == null ? hr : ema + o.emaAlpha * (hr - ema);
    series.push({ s: sec, h: ema });
    if (series.length > 180) series.shift();
    const t = sec * 1000, slope = slopeAt(), out = [{ type: 'hr', t, hr: Math.round(ema * 10) / 10, raw: hr, slope: Math.round(slope * 100) / 100, state }];
    if (series.length < o.slopeWindowS) return out;
    if (state === 'rest') {
      const from = Math.max(sec - o.troughWindowS, lastEndAt / 1000 - o.endLagS);
      let lo = Infinity, loAt = null;
      for (const p of series) if (p.s >= from && p.h <= lo) { lo = p.h; loAt = p.s; }
      trough = lo; troughAt = loAt * 1000;
      const restS = (t - expectation.lastSetEndAt) / 1000;
      const early = restS < expectation.restTargetS * o.earlyRestFraction;
      let needRise = o.onRise * (early ? o.earlyFactor : 1);
      if (t < motionUntil) needRise *= o.motionBoost;
      if (slope >= o.onSlope && ema - trough >= needRise && t - lastEndAt >= o.minRestS * 1000) {
        state = 'work'; onsetAt = t; onsetEst = Math.min(t, troughAt - o.startLeadS * 1000);
        peak = ema; peakAt = t; fallCount = 0;
        out.push({ type: 'start', at: onsetEst, detectedAt: t, hr: Math.round(ema), trough: Math.round(trough), early });
      }
    } else {
      if (ema >= peak) { peak = ema; peakAt = t; fallCount = 0; }
      const falling = peak - ema >= o.offDrop && slope <= o.offSlope;
      fallCount = falling ? fallCount + 1 : 0;
      const long = t - onsetEst > o.maxWorkS * 1000;
      if ((fallCount >= o.offHoldS && t - onsetEst >= o.minWorkS * 1000) || long) {
        const amp = peak - trough;
        if (amp < o.minAmp && !long) {
          out.push({ type: 'cancel', at: t, amp: Math.round(amp * 10) / 10 });
        } else {
          const endAt = Math.max(onsetEst + o.minWorkS * 1000, peakAt - o.endLagS * 1000);
          lastEndAt = peakAt; expectation.lastSetEndAt = endAt;
          out.push({ type: 'end', at: endAt, startAt: onsetEst, detectedAt: t, peak: Math.round(peak), peakAt,
            trough: Math.round(trough), amp: Math.round(amp * 10) / 10, forced: long });
        }
        state = 'rest'; fallCount = 0;
      }
    }
    return out;
  }

  // Feed one raw strap sample. Returns zero or more events; 'hr' events once per second.
  function push(sample) {
    const c = clean(sample);
    if (!c) return [];
    if (lastT != null && c.t - lastT > o.gapMs) { const keep = lastEndAt; reset(); lastEndAt = keep; }
    if (lastT != null && c.t < lastT) return [];
    lastT = c.t;
    const sec = Math.floor(c.t / 1000);
    const out = [];
    // Close any finished whole seconds (fill short holes by carrying the last value).
    if (!bins.has(sec)) {
      const done = [...bins.keys()].sort((a, b) => a - b);
      for (const k of done) {
        const b = bins.get(k); bins.delete(k);
        out.push(...step(k, b.sum / b.n));
        for (let g = k + 1; g < sec && g - k <= 3; g++) out.push(...step(g, b.sum / b.n));
      }
      bins.set(sec, { sum: 0, n: 0 });
    }
    const b = bins.get(sec); b.sum += c.hr; b.n++;
    return out;
  }
  return { push, reset: () => reset(true), expect, motion, get state() { return state; }, options: o };
}

// ---------------------------------------------------------------------------
// Session state machine. Drives the colour, voice and logging from detector events.
// Plan items: { key, exerciseIndex, setIndex, exercise, label, load, reps, working,
//               restS, kind: 'lift'|'row'|'carry', timerS, gate }
export const COLOURS = Object.freeze({
  check:   { bg: '#5b2a86', label: 'Safety check' },
  ready:   { bg: '#0f7a3d', label: 'Ready · go when set' },
  work:    { bg: '#d9822b', label: 'Working' },
  rest:    { bg: '#1d4e89', label: 'Recovering' },
  wait:    { bg: '#b8a200', label: 'Timer done · HR still high' },
  alarm:   { bg: '#b3261e', label: 'HR too high · stop & breathe' },
  nosignal:{ bg: '#4a4f55', label: 'No HR · timer only' },
  rir:     { bg: '#2f6f73', label: 'How many reps left?' },
  done:    { bg: '#123e35', label: 'Workout complete' }
});

export const ZONE_DEFAULTS = Object.freeze({
  readyRecovery: 0.6,   // ready when 60 % of the set's rise has recovered…
  readyAbs: 95,         // …or HR is at/below this (his median between-set trough + 10)
  alarmBpm: 140,        // red: well above his heaviest-set peaks on 25 Nov (max 127)
  alarmHoldS: 5,
  maxExtraWaitS: 60,    // after the timer, never hold green back longer than this
  rirPromptS: 20,
  minRestFraction: 0.4, // ignore new efforts in the first 40 % of the planned rest
  // Gates applied when a bout ends (rise above trough in bpm, onset→peak seconds), from 25 Nov:
  // working sets rose 21–38 bpm over 22–51 s; warm-ups 14–19 bpm; fidgets/walking 8–17 bpm over 12–43 s.
  working: { amp: 18, durS: 15 },
  warmup: { amp: 10, durS: 10 },
  accessory: { amp: 10, durS: 10 },
  promoteAmp: 24, promoteRatio: 1.35,
  demoteRatio: 0.6, moveOnExtraS: 45,
  bothSidesMergeS: 35   // rows: second side counts as the same set
});

export function createSession(plan, { zones = {}, now = Date.now(), checks = true } = {}) {
  const z = { ...ZONE_DEFAULTS, ...zones };
  const s = {
    plan, z, index: 0, mode: 'ready', since: now, restEnd: null, lastSet: null, hr: null, hrAt: 0, alarmSince: null,
    history: [], log: [], pendingMerge: null, provisional: null, warmAmp: {}, carryEnd: null, checkDone: new Set(), rir: {}, checks
  };
  const say = [];
  const item = () => s.plan[s.index];
  const emit = (type, extra = {}) => { const e = { type, at: extra.at ?? s.now, index: s.index, ...extra }; s.log.push(e); return e; };
  function enter(mode, t) { s.mode = mode; s.since = t; }
  function describe(p) { return p ? `${p.exercise}, ${p.label.split(' — ')[0]}: ${p.load}, ${p.reps}` : ''; }
  function needsCheck(p) { return checks && p && p.gate && !s.checkDone.has(p.exerciseIndex) && p.setIndex === firstOpenSet(p.exerciseIndex); }
  function firstOpenSet(ex) { const i = s.plan.findIndex(p => p.exerciseIndex === ex && !p.doneAt && !p.skipped); return i < 0 ? -1 : s.plan[i].setIndex; }
  function announceNext(t) {
    const p = item();
    if (!p) { enter('done', t); say.push('Workout complete. Well done. Add RIR and back notes when you are ready.'); return; }
    if (needsCheck(p)) { enter('check', t); say.push(p.gateText || `Before ${p.exercise}: any new numbness, weakness or radiating pain? Tap anywhere if all clear.`); return; }
  }
  function begin(t, source, at = t) {
    const p = item(); if (!p) return;
    s.history.push({ op: 'start', index: s.index, prevMode: s.mode, prevSince: s.since, restEnd: s.restEnd });
    p.startAt = at; p.startSource = source;
    if (s.mode === 'check') { s.checkDone.add(p.exerciseIndex); p.checkSkipped = true; emit('check-skipped', { at: t, exercise: p.exercise }); }
    enter('work', t);
    if (p.kind === 'carry' && p.timerS) { s.carryEnd = at + p.timerS * 1000; say.push(`Carry. ${p.timerS} seconds.`); }
    else say.push(p.working ? `${p.label.split(' — ')[0]}. Controlled reps.` : `${p.label.split(' — ')[0]}.`);
    emit('set-start', { at, source, key: p.key });
  }
  function finish(t, source, at = t, ev = null) {
    const p = item(); if (!p) return;
    s.history.push({ op: 'finish', index: s.index, prevMode: s.mode, prevSince: s.since, restEnd: s.restEnd, startAt: p.startAt });
    p.doneAt = at; p.endSource = source; p.peak = ev?.peak ?? null; p.trough = ev?.trough ?? null;
    if (p.startAt == null) { p.startAt = ev?.startAt ?? null; p.startSource = ev ? 'hr' : null; }
    s.carryEnd = null;
    emit('set-complete', { at, source, key: p.key, startAt: p.startAt, peak: p.peak });
    s.lastSet = { peak: ev?.peak ?? s.hr, trough: ev?.trough ?? null, endAt: at, index: s.index };
    const finished = p;
    s.index++;
    const next = item();
    const lastOfExercise = !next || next.exerciseIndex !== finished.exerciseIndex;
    if (lastOfExercise && finished.working !== false && finished.rirAsk) {
      enter('rir', t); s.restEnd = t + finished.restS * 1000;
      say.push(`${finished.exercise} done. Reps in reserve on the last set? Tap a number, or skip.`);
      return;
    }
    if (!next) { announceNext(t); return; }
    s.restEnd = at + (finished.restAfterS ?? finished.restS) * 1000;
    enter('rest', t);
    const restS = Math.round((s.restEnd - t) / 1000);
    say.push(`Set done. Rest ${restS} seconds. Next: ${describe(next)}.`);
  }

  function classify(p, ev) {
    const dur = (ev.peakAt - ev.startAt) / 1000;
    // Moved on? Same-load working sets give similar HR rises (25 Nov: bench 27/36/34, deadlift 23/28).
    // After a long gap, a much smaller bout while a working set is pending = next exercise's warm-up.
    const done = s.plan.filter(q => q.exerciseIndex === p.exerciseIndex && q.working && q.doneAt && q.peak != null);
    const nextEx = s.plan.find(q => q.exerciseIndex !== p.exerciseIndex && s.plan.indexOf(q) > s.index);
    if (p.working && done.length && nextEx && s.lastSet && (ev.startAt - s.lastSet.endAt) / 1000 > p.restS + z.moveOnExtraS) {
      const meanAmp = done.reduce((a, q) => a + (q.peak - q.trough), 0) / done.length;
      if (ev.amp < z.demoteRatio * meanAmp && ev.amp >= z.warmup.amp && dur >= z.warmup.durS) return 'move-on';
    }
    const g = p.working ? z.working : p.kind === 'lift' ? z.warmup : z.accessory;
    if (ev.amp < g.amp || dur < g.durS) return 'reject';
    const seen = s.warmAmp[p.exerciseIndex] || 0;
    if (!p.working && p.kind === 'lift' && seen > 0 && ev.amp >= Math.max(z.promoteAmp, z.promoteRatio * seen)
        && s.plan.some(q => q.exerciseIndex === p.exerciseIndex && q.working)) return 'promote';
    return 'accept';
  }
  function revert(t, reason) {
    const prov = s.provisional, p = item();
    p.startAt = null; p.startSource = null; s.carryEnd = null;
    enter(prov?.prevMode && prov.prevMode !== 'work' ? prov.prevMode : 'ready', t);
    if (prov) s.since = prov.prevSince;
    emit('movement-ignored', { at: t, reason });
  }
  const api = {
    get state() { return s; },
    get current() { return item(); },
    drainSpeech() { return say.splice(0); },
    // Detector events from hr-autopilot createSetDetector
    onDetector(ev, t) {
      s.now = t;
      if (ev.type === 'hr') { s.hr = ev.hr; s.hrAt = t; return; }
      const p = item(); if (!p) return;
      if (ev.type === 'start') {
        if (s.mode === 'work' || s.mode === 'done') return;
        if (s.mode === 'check') {
          // He started lifting without confirming. Don't block the session, but flag it for the summary
          // and repeat the stop rule out loud.
          s.checkDone.add(p.exerciseIndex); p.checkSkipped = true; emit('check-skipped', { at: t, exercise: p.exercise });
          say.push('Back check not confirmed. Stop if you get new numbness, weakness or radiating pain.');
          s.mode = 'ready';
        }
        // Rows: second side within the merge window belongs to the same set.
        if (s.pendingMerge && t - s.pendingMerge.at <= z.bothSidesMergeS * 1000) { s.provisional = { ev, t, prevMode: s.mode, prevSince: s.since, merge: true }; return; }
        // Sequence prior: nobody starts the next heavy set a few seconds into the rest.
        const L = s.lastSet, planned = L ? (s.plan[L.index]?.restAfterS ?? s.plan[L.index]?.restS ?? 75) : 0;
        const quick = planned < 20;
        if (L && !quick && t - L.endAt < z.minRestFraction * planned * 1000) { emit('movement-ignored', { at: t, reason: 'early in rest' }); return; }
        // Provisional: colour goes orange straight away, but nothing is logged until the bout ends
        // and looks like the planned set (amplitude/duration gates in classify()).
        s.provisional = { ev, t, prevMode: s.mode, prevSince: s.since };
        if (s.mode === 'rir') s.provisional.prevMode = 'rest';
        p.startAt = ev.at; p.startSource = 'hr';
        enter('work', t);
        if (p.kind === 'carry' && p.timerS) { s.carryEnd = ev.at + p.timerS * 1000; say.push(`Carry. ${p.timerS} seconds.`); }
      } else if (ev.type === 'cancel') {
        if (s.provisional && s.mode === 'work' && p.startSource === 'hr') revert(t, 'small bump');
        s.provisional = null;
      } else if (ev.type === 'end') {
        const prov = s.provisional; s.provisional = null;
        if (s.mode === 'check') return;
        if (prov?.merge && s.pendingMerge) { const m = s.pendingMerge; s.pendingMerge = null; finish(t, 'hr', ev.at, { ...ev, startAt: m.ev.startAt, peak: Math.max(ev.peak, m.ev.peak), trough: Math.min(ev.trough, m.ev.trough) }); return; }
        if (s.mode !== 'work' || p.startSource !== 'hr') return;           // tap-started sets end by tap or carry timer
        if (p.kind === 'carry' && s.carryEnd && t < s.carryEnd - 10000) return; // carry timer owns the end
        const verdict = classify(p, ev);
        if (verdict === 'reject') { revert(t, `bump too small for ${p.working ? 'a working set' : 'this set'} (rise ${ev.amp} bpm)`); return; }
        if (verdict === 'move-on') {
          const from = p.exercise;
          while (item() && item().exerciseIndex === p.exerciseIndex) { const w = item(); w.missed = true; emit('set-not-detected', { at: t, key: w.key }); s.index++; }
          const wp = item(); wp.startAt = ev.startAt; wp.startSource = 'hr';
          say.push(`Looks like you've moved on to ${wp.exercise}. The rest of ${from} wasn't detected; confirm it at the end.`);
          if (wp.gate && !s.checkDone.has(wp.exerciseIndex)) { s.checkDone.add(wp.exerciseIndex); wp.checkSkipped = true; emit('check-skipped', { at: t, exercise: wp.exercise }); }
        }
        if (verdict === 'promote') {
          // A much bigger effort than the warm-ups so far: assume the remaining warm-ups were done.
          while (item() && !item().working && item().exerciseIndex === p.exerciseIndex) { const w = item(); w.doneAt = ev.startAt; w.endSource = 'assumed'; emit('set-assumed', { at: t, key: w.key }); s.index++; }
          const wp = item(); wp.startAt = ev.startAt; wp.startSource = 'hr';
          say.push('That looked like a working set. Logging it as working set 1.');
        }
        if (p.kind === 'row' && p.bothSides) { s.pendingMerge = { at: t, ev }; enter('rest', t); s.restEnd = t + z.bothSidesMergeS * 1000; say.push('Other side.'); return; }
        finish(t, 'hr', ev.at, ev);
        const ex = s.plan[s.index - 1];
        if (ex && !ex.working) { s.warmAmp[ex.exerciseIndex] = Math.max(s.warmAmp[ex.exerciseIndex] || 0, ev.amp); }
      }
    },
    tick(t) {
      s.now = t;
      const signal = t - s.hrAt < 6000;
      if (s.pendingMerge && t - s.pendingMerge.at > z.bothSidesMergeS * 1000) { const m = s.pendingMerge; s.pendingMerge = null; finish(t, 'hr', m.ev.at, m.ev); }
      if (s.mode === 'work' && s.carryEnd && t >= s.carryEnd) { say.push('Time. Put them down.'); finish(t, 'timer', s.carryEnd); }
      if (s.mode === 'work' && s.carryEnd && s.carryEnd - t <= 15000 && s.carryEnd - t > 14000) say.push('15 seconds.');
      if (s.hr != null && signal && s.hr >= z.alarmBpm) { s.alarmSince ??= t; } else s.alarmSince = null;
      if (s.mode === 'rir' && t - s.since > z.rirPromptS * 1000) { enter('rest', t); const n = item(); if (n) say.push(`Next: ${describe(n)}.`); else announceNext(t); }
      if (s.mode === 'rest' || s.mode === 'wait') {
        const timerDone = t >= s.restEnd;
        const L = s.lastSet;
        const target = L?.trough != null ? Math.max(L.trough + (1 - z.readyRecovery) * (L.peak - L.trough), Math.min(z.readyAbs, L.peak)) : z.readyAbs;
        const quickSwap = (s.restEnd - (L?.endAt ?? 0)) < 20000; // row → carry hand-over: no HR gate
        const recovered = quickSwap || !signal || s.hr == null || s.hr <= target;
        if (timerDone && (recovered || t - s.restEnd > z.maxExtraWaitS * 1000)) {
          const n = item();
          if (needsCheck(n)) announceNext(t);
          else { enter('ready', t); say.push(n ? `Ready. ${describe(n)}.` : 'Ready.'); }
        } else if (timerDone && s.mode !== 'wait') { enter('wait', t); say.push('Timer done. Heart rate still high, take a few more breaths.'); }
      }
      if (s.mode === 'ready' && !s.announcedAt) { s.announcedAt = t; }
      return api.colour(t);
    },
    colour(t = s.now) {
      const signal = t - s.hrAt < 6000;
      if (s.alarmSince != null && t - s.alarmSince >= z.alarmHoldS * 1000 && s.mode !== 'done') return 'alarm';
      if (!signal && ['ready', 'rest', 'wait', 'work'].includes(s.mode) && s.hrAt > 0) return s.mode === 'work' ? 'work' : s.mode === 'ready' ? 'ready' : 'nosignal';
      return s.mode;
    },
    // One big tap anywhere: advance the obvious way.
    tap(t) {
      s.now = t;
      if (s.mode === 'check') { const p = item(); s.checkDone.add(p.exerciseIndex); emit('check-clear', { at: t, exercise: p.exercise }); enter('ready', t); say.push(`All clear. ${describe(p)}.`); return 'check-clear'; }
      if (s.mode === 'rir') { enter('rest', t); return 'rir-skip'; }
      if (s.mode === 'work') { s.pendingMerge = null; finish(t, 'tap'); return 'finish'; }
      if (s.mode === 'ready' || s.mode === 'rest' || s.mode === 'wait') { begin(t, 'tap'); return 'start'; }
      return null;
    },
    rir(value, t) {
      const ex = s.plan[s.index - 1]?.exerciseIndex;
      if (ex == null) return;
      s.rir[ex] = value; emit('rir', { at: t, exerciseIndex: ex, value });
      for (const p of s.plan) if (p.exerciseIndex === ex && p.working && p.doneAt) p.rir = String(value);
      enter('rest', t); const n = item(); say.push(n ? `Got it, ${value} in reserve. Next: ${describe(n)}.` : `Got it.`);
      if (!n) announceNext(t);
    },
    symptoms(t) { s.now = t; enter('done', t); s.stopped = 'symptoms'; emit('stop-symptoms', { at: t }); say.push('Stopping loaded work. Note your symptoms and seek assessment for new numbness, weakness or radiating pain.'); },
    undo(t) {
      const h = s.history.pop(); if (!h) return null;
      s.now = t; s.index = h.index; const p = item();
      if (h.op === 'finish') { p.doneAt = null; p.endSource = null; s.restEnd = h.restEnd; enter('work', t); s.lastSet = null; say.push('Undone. Still working.'); }
      else { p.startAt = null; p.startSource = null; s.carryEnd = null; s.restEnd = h.restEnd; enter(h.prevMode === 'check' ? 'ready' : h.prevMode, t); say.push('Undone.'); }
      emit('undo', { at: t, op: h.op }); return h.op;
    },
    skipExercise(t) {
      const ex = item()?.exerciseIndex; if (ex == null) return;
      while (item() && item().exerciseIndex === ex) { item().skipped = true; s.index++; }
      emit('exercise-skip', { at: t, exerciseIndex: ex }); enter('rest', t); s.restEnd = t;
      if (!item()) announceNext(t);
    },
    start(t) { s.now = t; s.since = t; const p = item(); if (needsCheck(p)) announceNext(t); else { enter('ready', t); say.push(`Hands-free workout started. First: ${describe(p)}.`); } }
  };
  return api;
}

// Build the autopilot plan from a v6/v7 session object (model.mjs makeSession shape).
export function planFromSession(session, { squatBenchRestS = 90, warmupRestS = 75, accessoryRestS = 75 } = {}) {
  const out = [];
  session.exercises.forEach((ex, exerciseIndex) => {
    if (ex.skipped) return;
    const gate = /squat|deadlift/i.test(ex.id);
    ex.sets.forEach((set, setIndex) => {
      if (set.completedAt || set.skipped) return;
      const label = set.label || '';
      const working = /^working\b/i.test(set.planned?.label ?? label);
      const carry = /carry/i.test(label) || Boolean(set.timerSeconds);
      const row = /row/i.test(label);
      const deadlift = /deadlift/i.test(ex.id);
      // Plan rule kept: deadlift working sets ≥ 2 min. Squat/bench working rest is the
      // v6 setting (default 90 s). Warm-ups and accessories: his usual 75 s.
      const restS = working ? (deadlift ? Math.max(120, ex.restSeconds || 120) : squatBenchRestS) : (row || carry ? accessoryRestS : warmupRestS);
      out.push({ key: `${exerciseIndex}:${setIndex}`, exerciseIndex, setIndex, exercise: ex.label, label, load: set.load, reps: set.reps,
        working, kind: carry ? 'carry' : row ? 'row' : 'lift', bothSides: row && /both sides/i.test(label), timerS: set.timerSeconds || null,
        restS, restAfterS: row ? 5 : undefined, rirAsk: working && /squat|bench|deadlift/i.test(ex.id), gate: gate && setIndex === 0,
        gateText: gate ? (/deadlift/i.test(ex.id)
          ? 'Before deadlifts: how is your back after squats and bench? Any new numbness, weakness or radiating pain? If worse, use the 72.5 kilo fallback. Tap anywhere if all clear.'
          : 'Before squats: any new numbness, weakness or radiating pain? Check your back during warm-ups; use 72.5 kilos if it is not settled. Tap anywhere if all clear.') : null });
    });
  });
  return out;
}
