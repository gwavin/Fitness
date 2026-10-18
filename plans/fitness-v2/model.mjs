// Data-only programme adapter. The reviewed coaching prescription remains authoritative.
export const KEY = 'fitness-v2';
export const LEGACY_KEY = 'fitness-coaching-runner-v1';
export const LEGACY_BACKUP_KEY = 'fitness-v2-classic-backup';
export const IMPORT_BACKUP_KEY = 'fitness-v2-before-import';
export const clone = value => JSON.parse(JSON.stringify(value));
export const uid = () => globalThis.crypto.randomUUID();
export function dublinDate(now = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Dublin', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now).map(x => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}
export function recommendation(now = new Date(), tuesdayEnabled = false) {
  const day = new Date(`${dublinDate(now)}T12:00:00Z`).getUTCDay();
  return { template: ({ 1: 'sbd', 2: 'indoor-a', 3: 'sbd', 5: 'sbd', 6: 'indoor-b' })[day] || 'rest',
    note: ({ 0: 'Rest, walking or easy cycling.', 1: 'SBD this morning · Karate this evening.', 2: tuesdayEnabled ? 'Optional shoulders & biceps.' : 'Optional shoulders & biceps. Begin with Saturday B only; add Tuesday when recovery allows.', 3: 'SBD this morning.', 4: 'Karate this evening. No workout logging required.', 5: 'SBD this morning.', 6: 'Optional arms, shoulders & chest. Start here when easing into the plan.' })[day] };
}
export function holdEnd(start) {
  const date = new Date(`${start}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 28);
  return date.toISOString().slice(0, 10);
}
const indoor = (id, label, equipment, reps, notes, extra = {}) => ({ id, label, programme: 'indoor', version: 1, equipment, prescription: `Start with 2 sets × ${reps}. Keep about 2–3 reps in reserve.`, instructions: notes, restSeconds: 60,
  sets: [1, 2].map(n => ({ label: `Set ${n}`, load: equipment.includes('10 kg') ? '10' : 'Band / bodyweight', reps: '', target: reps })), ...extra });
export function catalogue(source) {
  const sbd = source.steps.filter(step => step.setPlan?.length).map(step => ({
    id: step.id, label: step.name, programme: 'sbd', version: source.id,
    equipment: 'Reviewed prescription', prescription: step.prescription,
    instructions: [step.technique, ...(step.instructions || []), step.guardrail].filter(Boolean).join('\n'),
    restSeconds: step.restSeconds, sets: step.setPlan.map(set => ({ ...clone(set), target: set.reps }))
  }));
  const lateral = indoor('band-lateral', 'Band lateral raises', 'Light / long band', '12–20', 'Controlled scapular-plane raise. Use a lighter band if needed; do not force the 7.5 kg kettlebell.', { workingTarget: '3 × 12–20 after introduction; add a set only manually.' });
  const curls = indoor('db-curl', 'Supinated dumbbell curls', 'Two adjustable dumbbells, currently 10 kg each', '10–15', 'Keep wrists comfortable. Reduce the load when needed.', { workingTarget: '3 × 10–15 after introduction; add a set only manually.' });
  const apart = indoor('pull-apart', 'Band pull-aparts', 'Comfortable long or short band', '15–25', 'Controlled upper-back and rear-delt work.', { workingTarget: '2 × 15–25.' });
  const push = indoor('push-up', 'Standard push-ups', 'Floor', '8–20', 'Regular floor push-ups, without unstable kettlebell supports. Skip if chest recovery suffers.', { workingTarget: '2 × 8–20; optional.' });
  const concentration = indoor('concentration-curl', 'Supported concentration curls', '10 kg adjustable dumbbell or comfortable alternative', '10–15 / arm', 'Support the arm comfortably. One set includes both sides; optional right-side reps can differ.', { sideSpecific: true, workingTarget: '3 × 10–15 per arm after introduction; add a set only manually.' });
  const triceps = indoor('triceps', 'Comfortable triceps extensions', 'Adjustable dumbbell or long band', '10–20', 'Choose a comfortable variant and lower load. Overhead tolerance is not assumed.', { variations: ['Comfortable band extension', 'Comfortable dumbbell extension'], workingTarget: '3 × 10–20 after introduction; add a set only manually.' });
  const template = (id, label, exercises, minutes, optional = false) => ({ id, label, version: id === 'sbd' ? source.id : 1, exercises, minutes, optional });
  return [template('sbd', 'Squat · Bench · Deadlift', sbd, source.trainingWindow || '40–50 minutes'), template('indoor-a', 'Indoor A · Shoulders & biceps', [lateral, curls, apart], '10–12 minutes', true), template('indoor-b', 'Indoor B · Arms, shoulders & chest', [push, concentration, triceps, lateral], '15–20 minutes', true)];
}
export function freshDb(legacyRaw = null) {
  const legacy = legacyRaw ? JSON.parse(legacyRaw) : { sessions: [] };
  if (!legacy || !Array.isArray(legacy.sessions)) throw Error('Classic data is not a recognised session database. Original data has not been changed.');
  return { schemaVersion: 2, revision: 0, sessions: [], legacySessions: clone(legacy.sessions), legacyRaw,
    settings: { restSeconds: 90, presets: [45, 60, 90, 120], sound: true, vibration: true, notifications: false, autoRest: false, tuesdayEnabled: false, holdStart: '2026-10-18', units: 'kg', theme: 'system' }, timer: emptyTimer(90) };
}
export function loadDb(storage) {
  const raw = storage.getItem(KEY);
  if (raw !== null) { const db = JSON.parse(raw); validateDb(db); return db; }
  const legacyRaw = storage.getItem(LEGACY_KEY);
  const db = freshDb(legacyRaw);
  // Backup must succeed before any new database can be written. Never rewrite Classic.
  if (legacyRaw !== null && storage.getItem(LEGACY_BACKUP_KEY) === null) storage.setItem(LEGACY_BACKUP_KEY, legacyRaw);
  validateDb(db);
  storage.setItem(KEY, JSON.stringify(db));
  return db;
}
function recentSets(db, definition) {
  const candidates = db.sessions.map(s => ({ date: s.startedAt, sets: s.exercises.find(e => e.id === definition.id)?.sets }))
    .concat(db.legacySessions.map(s => ({ date: s.startedAt, sets: s.exerciseLogs?.[definition.id]?.sets })))
    .filter(s => s.sets?.length).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  return candidates[0]?.sets;
}
export function makeSession(template, db, now = new Date().toISOString()) {
  return { id: uid(), templateId: template.id, templateVersion: template.version, label: template.label, startedAt: now, endedAt: null, status: 'in_progress', activeIndex: 0, comments: '', audit: [],
    exercises: template.exercises.map(def => {
      const previous = recentSets(db, def);
      return { ...clone(def), skipped: false, previous: previous ? clone(previous) : [], sets: def.sets.map((plan, i) => ({ ...clone(plan), planned: clone(plan), load: String(previous?.[i]?.load ?? plan.load), reps: String(previous?.[i]?.reps ?? plan.reps), rightReps: String(previous?.[i]?.rightReps ?? ''), variation: String(previous?.[i]?.variation ?? def.variations?.[0] ?? ''), completedAt: null, skipped: false })) };
    }) };
}
export function audit(session, action, details = {}) { session.audit.push({ at: new Date().toISOString(), action, ...details }); }
export function emptyTimer(seconds) { return { state: 'idle', endAt: null, pausedRemainingMs: seconds * 1000, expiryId: null, alertedId: null, sessionId: null }; }
export function remaining(timer, now = Date.now()) { return timer.state === 'running' ? Math.max(0, timer.endAt - now) : timer.state === 'expired' ? 0 : timer.pausedRemainingMs; }
export function startTimer(timer, sessionId = null, now = Date.now()) {
  return { ...timer, state: 'running', endAt: now + timer.pausedRemainingMs, expiryId: uid(), sessionId };
}
export function adjustTimer(timer, deltaMs, now = Date.now()) {
  const ms = Math.max(0, Math.min(3600000, remaining(timer, now) + deltaMs));
  return { ...timer, pausedRemainingMs: ms, endAt: timer.state === 'running' ? now + ms : null, state: timer.state === 'expired' ? 'paused' : timer.state };
}
export function expireTimer(timer, now = Date.now()) {
  if (timer.state !== 'running' || remaining(timer, now) > 0) return false;
  timer.state = 'expired'; timer.pausedRemainingMs = 0;
  const shouldAlert = timer.alertedId !== timer.expiryId;
  timer.alertedId = timer.expiryId;
  return shouldAlert;
}
const assert = (condition, message) => { if (!condition) throw Error(`Invalid backup: ${message}`); };
const text = v => typeof v === 'string' && v.length <= 100000;
const iso = v => typeof v === 'string' && Number.isFinite(Date.parse(v));
export function validateDb(db) {
  const walk = value => {
    if (value && typeof value === 'object') for (const [key, v] of Object.entries(value)) { assert(!['__proto__', 'constructor', 'prototype'].includes(key), 'unsafe property'); walk(v); }
    else if (typeof value === 'number') assert(Number.isFinite(value), 'non-finite number');
  };
  walk(db);
  assert(db?.schemaVersion === 2, 'unsupported schema version');
  assert(Number.isInteger(db.revision) && db.revision >= 0, 'revision');
  assert(Array.isArray(db.sessions) && Array.isArray(db.legacySessions), 'session collections');
  assert(db.legacyRaw === null || typeof db.legacyRaw === 'string', 'Classic snapshot');
  if (db.legacyRaw !== null) assert(Array.isArray(JSON.parse(db.legacyRaw)?.sessions), 'Classic snapshot sessions');
  const s = db.settings;
  assert(s && Number.isFinite(s.restSeconds) && s.restSeconds >= 15 && s.restSeconds <= 3600, 'default rest');
  assert(Array.isArray(s.presets) && s.presets.length > 0 && s.presets.every(n => Number.isFinite(n) && n >= 15 && n <= 3600), 'presets');
  for (const key of ['sound', 'vibration', 'notifications', 'autoRest', 'tuesdayEnabled']) assert(typeof s[key] === 'boolean', key);
  assert(/^\d{4}-\d{2}-\d{2}$/.test(s.holdStart) && iso(s.holdStart) && new Date(`${s.holdStart}T12:00:00Z`).toISOString().slice(0, 10) === s.holdStart, 'hold date');
  assert(s.units === 'kg' && ['system', 'light', 'dark'].includes(s.theme), 'display / units');
  const t = db.timer;
  assert(t && ['idle', 'running', 'paused', 'expired'].includes(t.state), 'timer state');
  assert(Number.isFinite(t.pausedRemainingMs) && t.pausedRemainingMs >= 0 && t.pausedRemainingMs <= 3600000, 'timer remaining');
  assert(t.endAt === null || Number.isFinite(t.endAt), 'timer deadline');
  assert(t.state !== 'running' || (t.endAt !== null && typeof t.expiryId === 'string'), 'running timer');
  for (const key of ['expiryId', 'alertedId', 'sessionId']) assert(t[key] === null || text(t[key]), `timer ${key}`);
  const ids = new Set();
  db.sessions.forEach(session => {
    assert(text(session.id) && session.id && !ids.has(session.id), 'unique session ID'); ids.add(session.id);
    assert(text(session.label) && text(session.templateId) && ['string', 'number'].includes(typeof session.templateVersion), 'template snapshot');
    assert(iso(session.startedAt) && (session.endedAt === null || iso(session.endedAt)), 'session timestamps');
    assert(['in_progress', 'completed', 'abandoned'].includes(session.status) && text(session.comments), 'session status / comments');
    assert(Array.isArray(session.audit) && session.audit.every(a => iso(a.at) && text(a.action)), 'edit audit');
    assert(Array.isArray(session.exercises) && session.exercises.length > 0 && session.exercises.length <= 100, 'exercises');
    assert(Number.isInteger(session.activeIndex) && session.activeIndex >= 0 && session.activeIndex < session.exercises.length, 'active exercise');
    session.exercises.forEach(e => {
      assert(text(e.id) && text(e.label) && text(e.prescription) && text(e.instructions) && text(e.equipment), 'exercise snapshot');
      assert(typeof e.skipped === 'boolean' && Array.isArray(e.previous) && Array.isArray(e.sets) && e.sets.length > 0 && e.sets.length <= 100, 'exercise sets');
      assert(Number.isFinite(e.restSeconds) && e.restSeconds >= 0, 'exercise rest');
      if (e.variations !== undefined) assert(Array.isArray(e.variations) && e.variations.every(text), 'variations');
      e.sets.forEach(set => {
        assert(['label', 'load', 'reps', 'rightReps', 'variation', 'target'].every(k => text(set[k])), 'set values');
        assert(typeof set.skipped === 'boolean' && (set.completedAt === null || iso(set.completedAt)), 'set state');
        assert(set.planned && text(set.planned.load) && text(set.planned.reps), 'planned values');
      });
    });
  });
  db.legacySessions.forEach(s => assert(s && text(s.id) && typeof s.exerciseLogs === 'object' && s.exerciseLogs !== null, 'Classic session'));
  return db;
}
export function mergeDb(current, incoming) {
  validateDb(incoming);
  const next = clone(current);
  const combine = (a, b) => [...new Map([...a, ...b].map(s => [s.id, s])).values()];
  next.sessions = combine(next.sessions, incoming.sessions);
  next.legacySessions = combine(next.legacySessions, incoming.legacySessions);
  // Local preferences, Classic raw snapshot and live timer stay local on merge.
  validateDb(next);
  return next;
}
