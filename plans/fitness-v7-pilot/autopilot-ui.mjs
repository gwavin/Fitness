// Fitness v7 · hands-free overlay. Full-screen colour, voice, wake lock, one-tap override,
// replay demo. Detection and the session state machine live in hr-autopilot.mjs.
import { createSetDetector, createSession, planFromSession, expectationFor, COLOURS, ZONE_DEFAULTS } from './hr-autopilot.mjs';

const COLOUR_EXTRA = { maybe: { bg: '#a8661c', label: 'Effort starting?' } };
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const clock = ms => { const n = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`; };
const short = label => String(label || '').split(' — ')[0];

export function createAutopilotUI(host) {
  // host: { getSession, save, audit, onSample(fn), connectStrap(), strapConnected(), render, finish(session), settings() }
  let root, run = null, raf = null, wakeLock = null, voiceOn = true, lastCaption = '';
  const listeners = [];

  function el() {
    if (root) return root;
    root = document.createElement('div');
    root.id = 'autopilot';
    root.className = 'autopilot';
    root.hidden = true;
    root.setAttribute('role', 'application');
    root.setAttribute('aria-label', 'Hands-free workout');
    root.innerHTML = `
      <div class="ap-top"><span class="ap-mode"></span><span class="ap-hr" aria-live="off"></span>
        <button class="ap-btn ap-mute" data-ap="mute" aria-label="Toggle voice">🔊</button><button class="ap-btn" data-ap="exit">Exit</button></div>
      <div class="ap-main">
        <p class="ap-state" aria-live="polite"></p>
        <p class="ap-big"></p>
        <p class="ap-set"></p>
        <p class="ap-next"></p>
        <div class="ap-panel"></div>
      </div>
      <p class="ap-caption" aria-live="polite"></p>
      <canvas class="ap-spark" width="600" height="80" aria-hidden="true"></canvas>
      <div class="ap-foot"><span>Tap anywhere: start / finish set · Hold 1 s: undo</span>
        <button class="ap-btn" data-ap="skip">Skip exercise</button><button class="ap-btn ap-stop" data-ap="symptoms">Symptoms · stop</button></div>`;
    document.body.append(root);
    bindGestures();
    return root;
  }

  // ---------------------------------------------------------------- gestures
  function bindGestures() {
    let downAt = 0, holdTimer = null, held = false, startX = 0;
    root.addEventListener('pointerdown', e => {
      if (e.target.closest('button,select,input,textarea,label')) return;
      downAt = performance.now(); held = false; startX = e.clientX;
      holdTimer = setTimeout(() => { held = true; act('undo'); navigator.vibrate?.(60); }, 900);
    });
    const cancel = () => { clearTimeout(holdTimer); holdTimer = null; };
    root.addEventListener('pointerup', e => {
      if (!holdTimer && !held) return;
      cancel();
      if (held || e.target.closest('button,select,input,textarea,label')) return;
      if (Math.abs(e.clientX - startX) > 80) return; // a swipe is not a tap
      act('tap');
    });
    root.addEventListener('pointercancel', cancel);
    root.addEventListener('click', e => {
      const b = e.target.closest('[data-ap]'); if (!b) return;
      e.stopPropagation();
      const a = b.dataset.ap;
      if (a === 'rir') act('rir', Number(b.dataset.value));
      else act(a);
    });
  }

  // ---------------------------------------------------------------- audio
  let audioCtx = null;
  function beep(freq = 880, ms = 140, times = 1) {
    try {
      audioCtx ??= new (window.AudioContext || window.webkitAudioContext)();
      for (let i = 0; i < times; i++) {
        const o = audioCtx.createOscillator(), g = audioCtx.createGain(), t = audioCtx.currentTime + i * (ms / 1000 + 0.08);
        o.frequency.value = freq; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
        o.connect(g).connect(audioCtx.destination); o.start(t); o.stop(t + ms / 1000 + 0.02);
      }
    } catch { /* audio optional */ }
  }
  function speak(text) {
    lastCaption = text;
    if (!voiceOn || !('speechSynthesis' in window) || (run?.replay && run.speed > 2)) return;
    const u = new SpeechSynthesisUtterance(text);
    const v = speechSynthesis.getVoices().find(v => /en[-_](IE|GB)/i.test(v.lang)) || speechSynthesis.getVoices().find(v => /^en/i.test(v.lang));
    if (v) u.voice = v;
    u.rate = 1.05;
    speechSynthesis.speak(u);
  }
  async function wake(on) {
    try {
      if (on && !wakeLock && 'wakeLock' in navigator && document.visibilityState === 'visible') {
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', () => { wakeLock = null; });
      } else if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
    } catch { /* battery saver may refuse */ }
  }
  document.addEventListener('visibilitychange', () => { if (run && !root.hidden) wake(true); });

  // ---------------------------------------------------------------- motion (optional, secondary)
  let motionOn = false, motionBuf = [];
  async function enableMotion() {
    try {
      if (typeof DeviceMotionEvent?.requestPermission === 'function' && await DeviceMotionEvent.requestPermission() !== 'granted') return false;
      window.addEventListener('devicemotion', onMotion); motionOn = true; return true;
    } catch { return false; }
  }
  function onMotion(e) {
    if (!run || run.replay) return;
    const a = e.accelerationIncludingGravity; if (!a) return;
    const m = Math.hypot(a.x || 0, a.y || 0, a.z || 0), t = Date.now();
    motionBuf.push({ t, m }); while (motionBuf.length && motionBuf[0].t < t - 2000) motionBuf.shift();
    if (motionBuf.length > 20) {
      const mean = motionBuf.reduce((s, x) => s + x.m, 0) / motionBuf.length;
      const sd = Math.sqrt(motionBuf.reduce((s, x) => s + (x.m - mean) ** 2, 0) / motionBuf.length);
      if (sd > 1.5) run.detector.motion(t); // rhythmic movement: lowers the HR rise needed to call a start
    }
  }

  // ---------------------------------------------------------------- run lifecycle
  function makeRun({ session, plan, replay = null, speed = 10, persist }) {
    const now = replay ? replay.samples[0].t : Date.now();
    const sess = createSession(plan, { now, zones: host.settings?.().zones || {} });
    const detector = createSetDetector();
    return { session, plan, sess, detector, replay, speed, persist, clock: now, wallStart: performance.now(), feedIndex: 0, spark: [], ended: false };
  }
  function now() { return run?.replay ? run.clock : Date.now(); }

  function start(opts) {
    el();
    run = makeRun(opts);
    run.sess.start(now());
    root.hidden = false;
    document.documentElement.classList.add('ap-open');
    wake(true);
    if (!run.replay) {
      const off = host.onSample((id, sample) => { if (run && !run.replay && id === run.session.id) feed(sample); });
      if (off) listeners.push(off);
    }
    loop();
    paint();
  }
  function stop() {
    if (!run) return;
    run.ended = true;
    cancelAnimationFrame(raf); raf = null;
    speechSynthesis?.cancel?.();
    wake(false);
    root.hidden = true;
    document.documentElement.classList.remove('ap-open');
    const finished = run; run = null;
    return finished;
  }

  function feed(sample) {
    if (!run) return;
    const t = run.replay ? sample.t : Date.now();
    for (const ev of run.detector.push(sample)) {
      if (ev.type === 'hr') { run.spark.push(ev.hr); if (run.spark.length > 240) run.spark.shift(); }
      const before = run.sess.state.log.length;
      run.sess.onDetector(ev, t);
      afterEvents(before);
    }
    // Sequence prior for the detector: the planned rest of the set just finished.
    run.detector.expect(expectationFor(run.plan, run.sess.state.index));
  }

  function loop() {
    if (!run) return;
    if (run.replay) {
      const target = run.replay.samples[0].t + (performance.now() - run.wallStart) * run.speed;
      const S = run.replay.samples;
      while (run.feedIndex < S.length && S[run.feedIndex].t <= target) {
        const s = S[run.feedIndex++];
        while (run.clock + 1000 <= s.t) { run.clock += 1000; tick(); }
        run.clock = s.t; feed(s);
      }
      if (run.feedIndex >= S.length && !run.replayDone) { run.replayDone = true; lastCaption = `Replay finished: the recording ends at ${new Date(S.at(-1).t).toISOString().slice(11, 19)} UTC.`; }
    }
    tick();
    raf = requestAnimationFrame(() => setTimeout(loop, run?.replay ? 16 : 200));
  }

  let lastColour = null;
  function tick() {
    if (!run) return;
    const before = run.sess.state.log.length;
    const colour = run.sess.tick(now());
    afterEvents(before);
    if (colour !== lastColour) {
      if (colour === 'ready') { beep(988, 120, 2); navigator.vibrate?.([80, 60, 80]); }
      if (colour === 'alarm') { beep(440, 300, 3); navigator.vibrate?.([300, 100, 300]); }
      if (colour === 'rest' && lastColour === 'work') beep(660, 160, 1);
      lastColour = colour;
    }
    paint();
  }

  // Apply state-machine log entries to the stored v7 session (live mode only) and speak.
  function afterEvents(fromIndex) {
    const log = run.sess.state.log.slice(fromIndex);
    for (const text of run.sess.drainSpeech()) speak(text);
    if (!log.length || !run.persist) return;
    const session = run.session;
    for (const e of log) {
      const p = e.key ? run.plan.find(x => x.key === e.key) : null;
      const set = p ? session.exercises[p.exerciseIndex].sets[p.setIndex] : null;
      if (e.type === 'set-complete' && set) {
        set.completedAt = new Date(e.at).toISOString();
        if (p.startAt) set.startedAt = new Date(p.startAt).toISOString();
        set.autoSet = { source: e.source, startAt: p.startAt ?? null, endAt: e.at, detectedAt: run.sess.state.now ?? e.at, peakBpm: p.peak ?? null, troughBpm: p.trough ?? null };
        set.skipped = false; session.exercises[p.exerciseIndex].skipped = false;
        session.activeIndex = p.exerciseIndex;
        host.audit(session, 'autopilot-set-complete', { exerciseId: session.exercises[p.exerciseIndex].id, setIndex: p.setIndex, source: e.source });
      } else if (e.type === 'set-assumed' && set) {
        set.completedAt = new Date(e.at).toISOString(); set.autoSet = { source: 'assumed', startAt: null, endAt: e.at, detectedAt: e.at, peakBpm: null, troughBpm: null };
        host.audit(session, 'autopilot-set-assumed', { exerciseId: session.exercises[p.exerciseIndex].id, setIndex: p.setIndex });
      } else if (e.type === 'undo') {
        // Undo reverts the latest completion for the current plan item.
        const cur = run.sess.current; if (cur) { const s2 = session.exercises[cur.exerciseIndex].sets[cur.setIndex]; s2.completedAt = null; delete s2.autoSet; if (e.op === 'start') delete s2.startedAt; }
        host.audit(session, 'autopilot-undo', { op: e.op });
      } else if (e.type === 'rir') {
        for (const q of run.plan) if (q.exerciseIndex === e.exerciseIndex && q.working && q.doneAt) session.exercises[q.exerciseIndex].sets[q.setIndex].rir = String(e.value);
        host.audit(session, 'autopilot-rir', { exerciseId: session.exercises[e.exerciseIndex].id, value: e.value });
      } else {
        host.audit(session, 'autopilot-' + e.type, { ...(e.key ? { key: e.key } : {}), ...(e.reason ? { reason: e.reason } : {}), ...(e.exercise ? { exercise: e.exercise } : {}) });
      }
    }
    host.save();
  }

  function act(what, value) {
    if (!run) return;
    const t = now(), before = run.sess.state.log.length;
    if (what === 'exit') { const r = stop(); if (r) host.finish?.(r); return; }
    if (what === 'mute') { voiceOn = !voiceOn; speechSynthesis?.cancel?.(); paint(); return; }
    if (what === 'connect') { host.connectStrap?.(); return; }
    if (what === 'motion') { enableMotion().then(ok => { lastCaption = ok ? 'Motion sensor on (phone must move with you).' : 'Motion sensor unavailable.'; paint(); }); return; }
    if (what === 'speed' && run.replay) { const speeds = [1, 5, 10, 30]; const i = (speeds.indexOf(run.speed) + 1) % speeds.length; run.wallStart = performance.now() - (run.clock - run.replay.samples[0].t) / speeds[i]; run.speed = speeds[i]; paint(); return; }
    if (what === 'fallback') {
      const cur = run.sess.current, fb = fallbackFor(cur); if (!fb) return;
      for (const p of run.plan) if (p.exerciseIndex === cur.exerciseIndex && p.working && !p.doneAt) {
        p.load = fb;
        if (run.persist) run.session.exercises[p.exerciseIndex].sets[p.setIndex].load = fb;
      }
      if (run.persist) { host.audit(run.session, 'autopilot-fallback', { exerciseId: run.session.exercises[cur.exerciseIndex].id, load: fb }); host.save(); }
      speak(`Working sets changed to ${fb}. Stop if symptoms increase.`);
      run.sess.tap(t); afterEvents(before); paint(); return;
    }
    if (what === 'tap') { const r = run.sess.tap(t); navigator.vibrate?.(30); if (r === 'start') beep(740, 90); }
    if (what === 'undo') run.sess.undo(t);
    if (what === 'rir') run.sess.rir(value, t);
    if (what === 'skip') run.sess.skipExercise(t);
    if (what === 'symptoms') { if (!confirm('Stop loaded work for symptoms? This ends the hands-free session.')) return; run.sess.symptoms(t); }
    afterEvents(before);
    paint();
  }

  // ---------------------------------------------------------------- paint
  function paint() {
    if (!run || !root) return;
    const st = run.sess.state, t = now();
    let colour = run.sess.colour(t);
    const cur = run.sess.current;
    if (colour === 'work' && cur?.startSource === 'hr' && st.provisional && st.hr != null && st.provisional.ev.trough != null) {
      const gate = cur.working ? st.z.working.amp : st.z.warmup.amp;
      if (st.hr - st.provisional.ev.trough < gate) colour = 'maybe';
    }
    const c = COLOURS[colour] || COLOUR_EXTRA[colour] || COLOURS.rest;
    root.style.setProperty('--ap-bg', c.bg);
    root.dataset.state = colour;
    q('.ap-mode').textContent = run.replay ? `REPLAY ${run.replay.label} · ${run.speed}× · ${new Date(t).toISOString().slice(11, 19)}` : 'LIVE';
    const signal = t - st.hrAt < 6000 && st.hr != null;
    q('.ap-hr').textContent = signal ? `♥ ${Math.round(st.hr)}` : '♥ –';
    q('.ap-mute').textContent = voiceOn ? '🔊' : '🔇';
    q('.ap-state').textContent = c.label;
    let big = '';
    if (colour === 'rest' || colour === 'wait') big = st.restEnd > t ? clock(st.restEnd - t) : signal ? `${Math.round(st.hr)}` : '0:00';
    else if (colour === 'work' || colour === 'maybe') big = st.carryEnd ? clock(st.carryEnd - t) : clock(t - (cur?.startAt ?? t)).replace(/^0:/, '') + 's';
    else if (colour === 'alarm') big = `${Math.round(st.hr)}`;
    else if (colour === 'ready') big = 'GO';
    else if (colour === 'done') big = '✓';
    q('.ap-big').textContent = big;
    q('.ap-set').innerHTML = cur ? `<strong>${esc(cur.exercise)}</strong><br>${esc(short(cur.label))} · ${esc(cur.load)} × ${esc(cur.reps)}` : st.stopped ? 'Stopped for symptoms' : 'All planned sets done';
    const nxt = run.plan[st.index + 1];
    q('.ap-next').textContent = colour === 'wait' ? 'Timer done. Waiting for heart rate to settle (max 60 s more).'
      : nxt && cur ? `Then: ${nxt.exercise === cur.exercise ? '' : nxt.exercise + ' · '}${short(nxt.label)} ${nxt.load}` : '';
    const panel = q('.ap-panel');
    let html = '';
    if (colour === 'rir' || st.mode === 'rir') html = `<p>${esc(run.plan[st.index - 1]?.exercise ?? '')}: reps in reserve on the last working set? (target ${esc(rirTarget(run.plan[st.index - 1]))}) · tap anywhere else to skip</p><div class="ap-rir">${[0, 1, 2, 3, 4, 5].map(n => `<button class="ap-btn big" data-ap="rir" data-value="${n}">${n}${n === 5 ? '+' : ''}</button>`).join('')}</div>`;
    else if (st.mode === 'check') {
      const fb = fallbackFor(cur);
      html = `<p class="ap-check">${esc(cur?.gateText || '')}</p><p>Tap anywhere = all clear.</p>${fb ? `<p><button class="ap-btn big" data-ap="fallback">Not settled: use ${esc(fb)}</button></p>` : ''}`;
    }
    else if (st.mode === 'done') html = summaryHtml();
    if (!run.replay && !signal) html += `<p><button class="ap-btn big" data-ap="connect">Connect HR strap</button> <button class="ap-btn" data-ap="motion">Use phone motion (optional)</button></p><p class="ap-small">No heart rate: the app runs as a timer. Tap at the start and end of each set.</p>`;
    if (run.replay) html += `<p><button class="ap-btn" data-ap="speed">Speed ${run.speed}×</button></p>`;
    if (panel.dataset.html !== html) { panel.innerHTML = html; panel.dataset.html = html; }
    q('.ap-caption').textContent = lastCaption;
    spark();
  }
  const q = s => root.querySelector(s);
  // Plan fallback load (e.g. "Fallback: 72.5 kg") for the exercise of plan item p.
  function fallbackFor(p) {
    if (!p) return null;
    const ex = run.session.exercises[p.exerciseIndex];
    return ex?.prescription?.match(/Fallback:\s*([\d.]+\s*kg)/i)?.[1] ?? null;
  }
  function rirTarget(p) { return !p ? '' : /bench/i.test(p.exercise) ? '2–3' : '3–4'; }
  function summaryHtml() {
    const rows = run.plan.map(p => `<li>${esc(p.exercise.split(' ')[0])} · ${esc(short(p.label))}: ${p.doneAt ? esc(p.endSource) + (p.rir ? ' · RIR ' + esc(p.rir) : '') : p.missed ? 'not detected' : p.skipped ? 'skipped' : 'not done'}${p.checkSkipped ? ' · back check not confirmed' : ''}</li>`).join('');
    return `<details open class="ap-summary"><summary>What was logged</summary><ul>${rows}</ul><p>Exit to review loads, add RIR/back notes and fix anything in the normal list view.</p></details>`;
  }
  function spark() {
    const cv = q('.ap-spark'), ctx = cv.getContext('2d'), d = run.spark;
    ctx.clearRect(0, 0, cv.width, cv.height);
    if (d.length < 2) return;
    const lo = Math.min(...d) - 3, hi = Math.max(...d) + 3;
    ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 3; ctx.beginPath();
    d.forEach((v, i) => { const x = i / 239 * cv.width, y = cv.height - (v - lo) / (hi - lo) * cv.height; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    ctx.stroke();
  }

  // ---------------------------------------------------------------- public
  return {
    // Live: hands-free over the stored session.
    startLive(session, settings = {}) {
      const plan = planFromSession(session, settings);
      if (!plan.length) { alert('Nothing left to do in this workout.'); return false; }
      voiceOn = true; lastCaption = '';
      start({ session, plan, persist: true });
      return true;
    },
    // Replay: feed the recorded 25 Nov HR through the same code. Nothing is saved.
    async startReplay(sessionFactory, speed = 10, provided = null) {
      let data = provided;
      if (!data) { const res = await fetch('./data/session-2026-11-25.json'); if (!res.ok) throw Error('demo data not deployed'); data = await res.json(); }
      if (!data?.measurement?.samples?.length || !data.workout) throw Error('not a v6/v7 workout export with heart rate');
      const samples = data.measurement.samples;
      const session = sessionFactory(data);
      let plan = planFromSession(session);
      // The recording started after the squat warm-ups; begin the plan at the first set logged after it.
      const first = samples[0].t + 12000;
      const idx = plan.findIndex(p => { const s = data.workout.exercises[p.exerciseIndex]?.sets[p.setIndex]; return s?.completedAt && Date.parse(s.completedAt) >= first; });
      plan = plan.slice(Math.max(0, idx));
      voiceOn = speed <= 2; lastCaption = 'Replaying recorded heart rate through the v7 autopilot. Nothing is saved.';
      start({ session, plan, replay: { samples, label: String(data.workout.startedAt || '').slice(0, 10) || 'recording' }, speed, persist: false });
    },
    get running() { return Boolean(run); },
    stop,
    _debug: () => run
  };
}
