import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { KEY, LEGACY_KEY, LEGACY_BACKUP_KEY, catalogue, dublinDate, recommendation, holdEnd, freshDb, loadDb, makeSession, validateDb, mergeDb, emptyTimer, startTimer, remaining, adjustTimer, expireTimer, clone } from '../plans/fitness-v2/model.mjs';
const scope = { window: {} };
vm.runInNewContext(fs.readFileSync(new URL('../plans/coaching-runner/current-workout.js', import.meta.url), 'utf8'), scope);
// Normalise the VM's array prototypes to the host realm, like a JSON handoff.
const source = JSON.parse(JSON.stringify(scope.window.CURRENT_WORKOUT));
const templates = catalogue(source);
const memory = () => { const map = new Map(); return { getItem: k => map.get(k) ?? null, setItem: (k,v) => map.set(k,v) }; };
test('Dublin schedule, UTC midnight, DST boundaries, manual catalogue', () => {
  for (const [date, id] of [['2026-10-19','sbd'],['2026-10-20','indoor-a'],['2026-10-21','sbd'],['2026-10-22','rest'],['2026-10-23','sbd'],['2026-10-24','indoor-b'],['2026-10-25','rest']]) assert.equal(recommendation(new Date(`${date}T12:00:00Z`)).template, id);
  assert.equal(dublinDate(new Date('2026-10-18T23:30:00Z')), '2026-10-19');
  assert.equal(recommendation(new Date('2026-10-18T23:30:00Z')).template, 'sbd');
  assert.equal(dublinDate(new Date('2026-10-25T23:30:00Z')), '2026-10-25');
  assert.equal(dublinDate(new Date('2026-03-29T23:30:00Z')), '2026-03-30');
  assert.equal(holdEnd('2026-10-18'), '2026-11-15');
  assert.deepEqual(templates.map(t => t.id), ['sbd','indoor-a','indoor-b']);
});
test('all original SBD sets, warmups, accessories and guidance survive the adapter', () => {
  const steps = source.steps.filter(s => s.setPlan.length);
  assert.equal(templates[0].exercises.length, steps.length);
  steps.forEach((step,i) => {
    const e = templates[0].exercises[i];
    assert.equal(e.id, step.id); assert.equal(e.prescription, step.prescription);
    assert.deepEqual(e.sets.map(({ target, ...set }) => set), JSON.parse(JSON.stringify(step.setPlan)));
    assert.ok(e.instructions.includes(step.guardrail));
  });
  for (const t of templates.slice(1)) assert.ok(t.exercises.every(e => e.sets.length === 2));
});
const legacyDb = () => ({ schemaVersion: 1, sessions: [{ id: 'fake-classic', workoutId: source.id, startedAt: '2026-10-17T09:00:00Z', exerciseLogs: { [templates[0].exercises[0].id]: { sets: [{ label:'Warm-up 1', load:'19.5 kg', reps:'9', completed:true }] } } }] });
test('migration backs up exact original text, keeps all records and reloads without rewriting Classic', () => {
  const storage = memory(), raw = JSON.stringify(legacyDb(), null, 3); storage.setItem(LEGACY_KEY, raw);
  const db = loadDb(storage);
  assert.equal(storage.getItem(LEGACY_KEY), raw); assert.equal(storage.getItem(LEGACY_BACKUP_KEY), raw);
  assert.equal(db.legacyRaw, raw); assert.equal(db.legacySessions.length, 1);
  assert.deepEqual(loadDb(storage), db);
  const s = makeSession(templates[0], db); assert.equal(s.exercises[0].sets[0].load, '19.5 kg'); assert.equal(s.exercises[0].sets[0].completedAt, null);
  const large = legacyDb(); large.sessions = Array.from({length:55}, (_,i) => ({ ...large.sessions[0], id:`fake-${i}` }));
  assert.equal(freshDb(JSON.stringify(large)).legacySessions.length, 55);
});
test('invalid existing storage or failed backup blocks migration without overwrite', () => {
  const storage = memory(); storage.setItem(KEY, '{bad'); assert.throws(() => loadDb(storage)); assert.equal(storage.getItem(KEY), '{bad');
  const blocked = { getItem:k => k === LEGACY_KEY ? JSON.stringify(legacyDb()) : null, setItem:() => { throw Error('quota'); } };
  assert.throws(() => loadDb(blocked), /quota/);
});
test('draft/snapshot + Unicode export/import roundtrip, manual changes do not change prescription', () => {
  const db = freshDb(); const s = makeSession(templates[0], db); db.sessions.push(s);
  s.comments = 'Énergie 💪 — Dublin'; s.activeIndex = 2; s.exercises[0].sets[0].load = '17.5 kg';
  s.exercises[0].sets[0].completedAt = '2026-10-18T09:00:00Z';
  const restored = validateDb(JSON.parse(JSON.stringify(db))); assert.deepEqual(restored, db);
  assert.equal(templates[0].exercises[0].sets[0].load, '20 kg');
  assert.equal(restored.sessions[0].exercises[0].sets[0].planned.load, '20 kg');
});
test('malformed imports, unsupported schemas, duplicate IDs, bad state and unsafe keys rejected', () => {
  const good = freshDb(); good.sessions.push(makeSession(templates[1], good));
  for (const mutate of [d => d.schemaVersion = 99, d => d.settings.restSeconds = -1, d => d.settings.holdStart = '2026-02-30', d => d.timer.state = 'unknown', d => d.timer.endAt = 'tomorrow', d => d.sessions.push(clone(d.sessions[0])), d => d.sessions[0].activeIndex = -1, d => d.sessions[0].exercises[0].sets[0].load = {}, d => d.sessions[0].exercises[0].sets[0].completedAt = 'bad']) {
    const d = clone(good); mutate(d); assert.throws(() => validateDb(d));
  }
  assert.throws(() => validateDb(JSON.parse('{"__proto__":{"polluted":true}}')), /unsafe property/);
});
test('merge retains distinct sessions, incoming same IDs wins, local live timer/settings retained', () => {
  const a = freshDb(), b = freshDb(); const s = makeSession(templates[2], a); a.sessions.push(s); b.sessions.push(clone(s));
  b.sessions[0].comments = 'updated'; b.sessions.push(makeSession(templates[1], b)); b.settings.sound = false;
  a.timer = startTimer(emptyTimer(90), null, 1000);
  const merged = mergeDb(a,b); assert.equal(merged.sessions.length,2); assert.equal(merged.sessions[0].comments,'updated'); assert.equal(merged.settings.sound,true); assert.deepEqual(merged.timer,a.timer); assert.equal(a.sessions[0].comments,'');
});
test('deadline timer ±15, pause/resume/reload, delayed expiry and deduplication', () => {
  let t = startTimer(emptyTimer(90), 'fake-session', 1000); assert.equal(t.endAt,91000);
  t = adjustTimer(t,15000,11000); assert.equal(t.endAt,106000);
  t = adjustTimer(t,-15000,11000); assert.equal(t.endAt,91000);
  t.pausedRemainingMs = remaining(t,21000); t.endAt = null; t.state = 'paused';
  t = JSON.parse(JSON.stringify(t)); assert.equal(remaining(t,999999),70000);
  t = startTimer(t,'fake-session',100000); assert.equal(t.endAt,170000);
  const restored = JSON.parse(JSON.stringify(t)); assert.equal(remaining(restored,169000),1000);
  assert.equal(expireTimer(restored,180000),true); assert.equal(restored.state,'expired'); assert.equal(expireTimer(restored,190000),false);
  assert.equal(expireTimer(JSON.parse(JSON.stringify(restored)),200000),false);
});
