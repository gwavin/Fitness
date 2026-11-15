import { KEY, LEGACY_KEY, IMPORT_BACKUP_KEY, clone, uid, dublinDate, recommendation, holdEnd, catalogue, loadDb, makeSession, audit, emptyTimer, remaining, startTimer, expireTimer, validateDb, mergeDb } from './model.mjs';
import { collectFor, readCapture, checkpointCapture } from './heart-rate.mjs';
import { recoveryFor } from './telemetry.mjs';

const app = document.querySelector('#app');
const status = document.querySelector('#storage-status');
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]);
const clock = ms => { const n = Math.ceil(Math.max(0, ms) / 1000); return `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`; };
const stamp = v => new Date(v).toLocaleString('en-IE', { timeZone: 'Europe/Dublin', dateStyle: 'medium', timeStyle: 'short' });
let db, templates, activeId = null, view = 'today', selected = null, expectedRevision, conflict = false;
let displayedDate = null, displayedDirection = null;
let context, audioReady = false, wakeLock, wakePending = false, anchor = null, registration;
const offlineStatus = document.querySelector('#offline-status');

try {
  templates = catalogue(window.CURRENT_WORKOUT);
  db = loadDb(localStorage);
  expectedRevision = db.revision;
  const draft = db.sessions.find(s => s.status === 'in_progress');
  if (draft) activeId = draft.id;
  render();
} catch (error) {
  status.classList.add('error');
  status.textContent = 'Storage could not be loaded safely. Nothing has been overwritten.';
  app.innerHTML = `<section class="card"><h1>Your data needs attention</h1><p>${esc(error.message)}</p><p>Export the stored text before attempting recovery, or return to Classic. Browser storage must be available to start v4.</p><button id="rescue">Download stored data</button><p><a href="../todays-workout-classic.html">Open Classic</a></p></section>`;
  document.querySelector('#rescue').onclick = () => {
    try { download('fitness-recovery.json', JSON.stringify({ v4: localStorage.getItem(KEY), v3: localStorage.getItem('fitness-v3'), v2: localStorage.getItem('fitness-v2'), classic: localStorage.getItem(LEGACY_KEY) }, null, 2)); }
    catch { alert('Browser storage is unavailable. Do not clear it; use browser recovery tools.'); }
  };
}
function current() { return db.sessions.find(s => s.id === activeId); }
function save(message = 'Saved on this browser · Export regularly for a backup') {
  if (conflict) return false;
  try {
    const stored = localStorage.getItem(KEY);
    if (stored === null || JSON.parse(stored).revision !== expectedRevision) {
      conflict = true;
      throw Error('Another tab changed this database. Export this tab’s work, then reload to load the other copy.');
    }
    const nextRevision = expectedRevision + 1;
    localStorage.setItem(KEY, JSON.stringify({ ...db, revision: nextRevision }));
    db.revision = expectedRevision = nextRevision;
    status.classList.remove('error'); status.textContent = message;
    return true;
  } catch (e) {
    status.classList.add('error');
    status.textContent = `NOT SAVED: ${e.message} Keep this tab open and export your work in Settings & backup.`;
    return false;
  }
}
function download(name, body) {
  const url = URL.createObjectURL(new Blob([body], { type: 'application/json' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name }); a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function exportAll() { download(`fitness-v4-${dublinDate()}.json`, JSON.stringify(db, null, 2)); }
function recoveryReport(session, samples) {
  const sets = session.exercises.flatMap(exercise => exercise.sets.map((set, i) => ({
    exercise: exercise.label, exerciseId: exercise.id, setNumber: i + 1, label: set.label,
    load: set.load, reps: set.reps, rightReps: set.rightReps, variation: set.variation,
    rir: set.rir || '', startedAt: set.startedAt || null, completedAt: set.completedAt
  })));
  const times = sets.map(set => Date.parse(set.startedAt)).filter(Number.isFinite);
  const ends = sets.map(set => Date.parse(set.completedAt)).filter(Number.isFinite);
  return sets.filter(set => set.completedAt).map(set => {
    const end = Date.parse(set.completedAt);
    const nextStart = Math.min(...times.filter(t => t > end), Infinity);
    const nextEnd = Math.min(...ends.filter(t => t > end), Infinity);
    const observedStart = nextStart < nextEnd ? nextStart : Infinity;
    return { ...set, restToNextMarkedSetSeconds: Number.isFinite(observedStart) ? Math.round((observedStart - end) / 1000) : null,
      recovery: recoveryFor(samples, end, Math.min(observedStart, nextEnd)) };
  });
}
function exportWorkout(session) {
  const samples = readCapture(session.id);
  download(`fitness-v4-workout-${session.startedAt.slice(0, 10)}.json`, JSON.stringify({
    format: 'fitness-v4-workout-v1', workout: session,
    measurement: { source: 'Bluetooth Heart Rate Measurement', timestamp: 'phone/browser receipt time, Unix ms', rrUnit: '1/1024 second', sampleCount: samples.length, samples },
    completedSets: recoveryReport(session, samples),
    interpretation: 'Recovery windows use Complete set tap time. Without a marked next-set start, a later effort may overlap. Missing measurements are null.'
  }, null, 2));
}
function render(focus = false) {
  if (!db) return;
  document.documentElement.dataset.theme = db.settings.theme;
  for (const button of document.querySelectorAll('[data-view]')) {
    const tab = ['exercise', 'summary'].includes(view) ? 'today' : view;
    if (button.dataset.view === tab) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
  }
  ({ today: todayView, exercise: exerciseView, summary: summaryView, history: historyView, settings: settingsView })[view]();
  collectFor(['exercise', 'summary'].includes(view) && current()?.status === 'in_progress' ? activeId : null);
  drawTimer(); manageWake();
  if (focus) { app.focus({ preventScroll: true }); window.scrollTo(0, 0); }
}
function go(next) { view = next; render(true); }
function holdNotice() { return `<p class="callout">Flat barbell loads: ${esc(db.settings.holdStart)} to ${esc(holdEnd(db.settings.holdStart))} (end exclusive). No automatic increases, during or after this period. Manual changes are recorded.</p>`; }
function todayView() {
  const rec = recommendation(new Date(), db.settings.tuesdayEnabled);
  const date = dublinDate();
  if (displayedDate && displayedDate !== date) selected = null;
  displayedDate = date; displayedDirection = rec.dayLabel;
  selected ||= rec.template;
  const template = templates.find(t => t.id === selected);
  const recommended = templates.find(t => t.id === rec.template);
  const drafts = db.sessions.filter(s => s.status === 'in_progress');
  app.innerHTML = `<section class="card hero"><p class="eyebrow">${esc(dublinDate())} · Europe/Dublin</p><h1>${esc(rec.dayLabel)}</h1><h2>Today: ${esc(recommended?.label || 'Recovery / rest')}${recommended?.optional ? ' · optional' : ''}</h2><p>${esc(rec.note)}</p><p class="muted">Choose a different session below whenever you need to.</p></section>
    ${drafts.map(s => `<section class="card"><h2>Pick up where you left off</h2><p>${esc(s.label)} · ${esc(stamp(s.startedAt))}</p><button class="primary wide large" data-resume="${esc(s.id)}">Resume workout</button></section>`).join('')}
    <section class="card"><p class="eyebrow">Choose your session</p><label>Workout<select id="choose"><option value="rest" ${selected === 'rest' ? 'selected' : ''}>Rest / walking / easy cycling</option>${templates.map(t => `<option value="${t.id}" ${selected === t.id ? 'selected' : ''}>${esc(t.label)}${t.optional ? ' · optional' : ''}</option>`).join('')}</select></label>
    ${template ? `<h2 style="margin-top:20px">${esc(template.label)}</h2><p class="muted">${esc(template.minutes)} · ${template.exercises.length} exercise screens</p><section aria-labelledby="equipment-title"><h3 id="equipment-title">Gather your equipment</h3><ul id="equipment-list">${template.equipmentChecklist.map(item => `<li>${esc(item)}</li>`).join('')}</ul></section><h3>Your exercises</h3><ol>${template.exercises.map(e => `<li><strong>${esc(e.label)}</strong><br><small>${esc(e.prescription)}</small></li>`).join('')}</ol>${template.optional ? '<p class="callout">Start with Saturday B only. Two sets each for at least the first fortnight. Targets are guidance; add sets manually only when ready.</p>' : `<details><summary>Reviewed programme & safety guidance</summary><p>Source: ${esc(window.CURRENT_WORKOUT.publishedFor)}. This is the existing prescription, not a new progression or a newly reviewed programme.</p><p>${esc(window.CURRENT_WORKOUT.safetySummary)}</p></details>`}<button class="primary wide large" id="start">Start workout →</button>` : '<h2 style="margin-top:20px">Room to recover</h2><p>No logging needed. You can choose any session above.</p>'}</section>${holdNotice()}`;
  document.querySelector('#choose').onchange = e => { selected = e.target.value; render(); };
  document.querySelector('#start')?.addEventListener('click', async () => {
    if (conflict) return alert('Reload after exporting your work; another tab changed the data.');
    const existing = drafts.find(s => s.templateId === template.id);
    if (existing) activeId = existing.id;
    else { const s = makeSession(template, db); db.sessions.unshift(s); activeId = s.id; save(); }
    unlockAudio(); go('exercise');
  });
  bindResume();
}
function bindResume() {
  document.querySelectorAll('[data-resume]').forEach(b => b.onclick = () => { activeId = b.dataset.resume; unlockAudio(); go('exercise'); });
}
function field(set, index, key, label, numeric = false) {
  const name = `${index}-${key}`;
  return `<label for="${name}">${esc(label)}${numeric ? `<div class="stepper"><button data-step="-1" data-index="${index}" data-key="${key}" aria-label="Decrease ${esc(label)} for set ${index + 1}">−</button><input id="${name}" aria-label="${esc(label)} for set ${index + 1}" data-index="${index}" data-key="${key}" inputmode="${key === 'load' ? 'decimal' : 'numeric'}" value="${esc(set[key])}"><button data-step="1" data-index="${index}" data-key="${key}" aria-label="Increase ${esc(label)} for set ${index + 1}">+</button></div>` : `<input id="${name}" data-index="${index}" data-key="${key}" value="${esc(set[key])}">`}</label>`;
}
function exerciseView() {
  const session = current(); if (!session) return go('today');
  const index = session.activeIndex, exercise = session.exercises[index];
  const numericLoad = exercise.programme === 'sbd' || exercise.equipment.includes('10 kg');
  app.innerHTML = `<div class="row"><p class="eyebrow">${index + 1} of ${session.exercises.length} · ${esc(session.label)}</p><span class="badge">${session.status === 'completed' ? 'Editing history' : 'Auto-save on'}</span></div><div class="progress" role="progressbar" aria-label="Exercise position" aria-valuemin="0" aria-valuemax="${session.exercises.length}" aria-valuenow="${index + 1}"><span style="width:${(index + 1) / session.exercises.length * 100}%"></span></div>
    <h1>${esc(exercise.label)}</h1><p>${esc(exercise.prescription)}</p><p class="muted">${esc(exercise.equipment)}</p>${exercise.workingTarget ? `<p class="muted">${esc(exercise.workingTarget)}</p>` : ''}
    <details><summary>Technique & safety cues</summary><p class="cues">${esc(exercise.instructions)}</p></details>
    <details><summary>Previous performance & load</summary><div class="previous">${exercise.previous.length ? exercise.previous.map(s => `<p>${esc(s.label)}: ${esc(s.load)} · ${esc(s.reps)}${s.rightReps ? ` / right ${esc(s.rightReps)}` : ''} ${s.completedAt || s.completed ? '✓ completed' : '(saved suggestion / not recorded complete)'}</p>`).join('') : '<p>No comparable local record. Defaults are from the reviewed prescription or equipment guidance, not completed work.</p>'}</div></details>
    <label class="jump">Jump to exercise<select id="jump">${session.exercises.map((e, i) => `<option value="${i}" ${i === index ? 'selected' : ''}>${i + 1}. ${esc(e.label)}${e.skipped ? ' · skipped' : ''}</option>`).join('')}</select></label>
    ${exercise.skipped ? '<p class="callout">Exercise skipped. Existing completed sets are retained. Resume it to continue.</p><button id="unskip">Resume exercise</button>' : ''}
    ${exercise.sets.map((s, i) => `<section class="card set ${s.completedAt ? 'done' : ''} ${s.skipped ? 'skipped' : ''}"><div class="set-header"><h2>${esc(s.label)}</h2><span>${s.completedAt ? '✓ Done' : s.skipped ? 'Skipped' : 'Not done'}</span></div><p class="muted">Target: ${esc(s.target)}</p><div class="set-fields">${field(s, i, 'load', 'Load (kg) / band', numericLoad)}${field(s, i, 'reps', exercise.sideSpecific ? 'Reps (left / both)' : 'Reps / seconds', true)}${exercise.sideSpecific ? field(s, i, 'rightReps', 'Right reps (optional)', true) : ''}${field(s, i, 'rir', 'RIR (optional)')}${exercise.variations ? `<label>Variation<select data-index="${i}" data-key="variation">${exercise.variations.map(v => `<option ${s.variation === v ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></label>` : ''}</div><div class="actions"><button class="${s.completedAt ? '' : 'primary'}" data-set="${i}" data-action="${s.completedAt || s.skipped ? 'undo' : 'complete'}">${s.completedAt || s.skipped ? 'Undo' : 'Complete set'}</button><button data-set="${i}" data-action="skip">Skip</button>${session.status === 'in_progress' && !s.completedAt && !s.skipped ? `<button data-set-start="${i}" ${s.startedAt ? 'disabled' : ''}>${s.startedAt ? 'Start marked' : 'Mark start (optional)'}</button>` : ''}${s.timerSeconds ? `<button data-carry="${s.timerSeconds}">Time ${s.timerSeconds}s</button>` : ''}</div></section>`).join('')}
    ${exercise.programme === 'indoor' ? '<button id="add-set" class="wide">Add a set manually</button>' : ''}
    <div class="actions"><button id="skip-exercise">Skip exercise</button><button id="quit">Quit & resume later</button></div>
    <div class="exercise-nav"><button class="large" id="back" ${index === 0 ? 'disabled' : ''}>← Back</button><button class="primary large" id="next">${index === session.exercises.length - 1 ? 'Summary →' : 'Next →'}</button></div><button class="wide" style="margin-top:12px" id="summary">Review workout</button>`;
  const edit = (i, key, value) => {
    const set = exercise.sets[i], before = set[key]; if (before === value) return;
    set[key] = value; audit(session, 'set-edit', { exerciseId: exercise.id, setIndex: i, field: key, before, after: value }); save();
  };
  app.querySelectorAll('input[data-key],select[data-key]').forEach(input => input.addEventListener('input', () => edit(Number(input.dataset.index), input.dataset.key, input.value)));
  app.querySelectorAll('[data-step]').forEach(b => b.onclick = () => {
    const i = Number(b.dataset.index), key = b.dataset.key, raw = exercise.sets[i][key];
    // Keep Classic units/side annotations when stepping the leading numeric value.
    const match = raw.match(/^(\d+(?:\.\d+)?)(.*)$/);
    if (raw !== '' && !match) return alert('Edit this band / variant description directly.');
    const value = String(Math.max(0, Number(match?.[1] || 0) + Number(b.dataset.step) * (key === 'load' ? .5 : 1))) + (match?.[2] || '');
    edit(i, key, value); document.getElementById(`${i}-${key}`).value = value;
  });
  app.querySelectorAll('[data-set-start]').forEach(button => button.onclick = () => {
    const set = exercise.sets[Number(button.dataset.setStart)];
    if (set.startedAt || set.completedAt || set.skipped) return;
    set.startedAt = new Date().toISOString();
    save();
    render();
  });
  app.querySelectorAll('[data-set]').forEach(b => b.onclick = () => {
    const i = Number(b.dataset.set), set = exercise.sets[i], action = b.dataset.action;
    if (action === 'complete' && (!set.load.trim() || !set.reps.trim())) return alert('Enter the actual load / variant and reps or seconds first.');
    audit(session, `set-${action}`, { exerciseId: exercise.id, setIndex: i, before: clone(set) });
    set.completedAt = action === 'complete' ? new Date().toISOString() : null; set.skipped = action === 'skip';
    if (action === 'complete') exercise.skipped = false;
    else delete set.startedAt;
    save(); unlockAudio();
    if (action === 'complete') checkpointCapture();
    render();
  });
  app.querySelectorAll('[data-carry]').forEach(b => b.onclick = () => runTimedSet(Number(b.dataset.carry)));
  const navigate = i => { session.activeIndex = i; save(); render(true); };
  document.querySelector('#jump').onchange = e => navigate(Number(e.target.value));
  document.querySelector('#back').onclick = () => navigate(index - 1);
  document.querySelector('#next').onclick = () => index === session.exercises.length - 1 ? go('summary') : navigate(index + 1);
  document.querySelector('#summary').onclick = () => go('summary');
  document.querySelector('#quit').onclick = () => { save(); go('today'); };
  document.querySelector('#skip-exercise').onclick = () => { exercise.skipped = true; audit(session, 'exercise-skip', { exerciseId: exercise.id }); save(); render(); };
  document.querySelector('#unskip')?.addEventListener('click', () => { exercise.skipped = false; audit(session, 'exercise-resume', { exerciseId: exercise.id }); save(); render(); });
  document.querySelector('#add-set')?.addEventListener('click', () => {
    if (exercise.sets.length >= 100) return;
    const set = clone(exercise.sets.at(-1)); set.label = `Set ${exercise.sets.length + 1}`; set.completedAt = null; set.skipped = false; delete set.startedAt; delete set.rir;
    exercise.sets.push(set); audit(session, 'add-set', { exerciseId: exercise.id }); save(); render();
  });
}
function paintRecoveryReport() {
  if (view !== 'summary') return;
  const session = current();
  const overview = document.querySelector('#hr-overview');
  if (!overview || !session) return;
  const samples = readCapture(session.id);
  const report = recoveryReport(session, samples);
  overview.textContent = samples.length ? `${samples.length} readings · drops from the near-set peak. If the next set’s start wasn’t marked, its effort may overlap a recovery window.` : 'No Garmin readings for this workout.';
  const details = document.querySelector('#hr-details');
  const lines = report.filter(set => set.recovery.at30s || set.recovery.at60s).map(set => {
    const readings = [[30, set.recovery.at30s], [60, set.recovery.at60s]].filter(([, reading]) => reading)
      .map(([seconds, reading]) => `${seconds}s: ${reading.dropFromNearSetPeakBpm} bpm drop`);
    return `<li>${esc(set.exercise)} · ${esc(set.label)} · ${esc(readings.join(' · '))}</li>`;
  }).join('');
  if (details.innerHTML !== lines) details.innerHTML = lines;
}
setInterval(paintRecoveryReport, 5000);
function summaryView() {
  const session = current(); if (!session) return go('today');
  const elapsed = Math.max(0, Date.parse(session.endedAt || new Date().toISOString()) - Date.parse(session.startedAt));
  app.innerHTML = `<p class="eyebrow">Workout summary</p><h1>Your work, recorded.</h1><p>${esc(session.label)} · ${Math.round(elapsed / 60000)} minutes elapsed (includes breaks)</p>${session.exercises.map(e => `<section class="card"><h2>${esc(e.label)}</h2><p>${e.skipped ? 'Exercise skipped · ' : ''}${e.sets.filter(s => s.completedAt).length}/${e.sets.length} sets completed</p><ul>${e.sets.map(s => `<li>${esc(s.label)}: ${s.completedAt ? `${esc(s.load)} × ${esc(s.reps)}${s.rightReps ? ` / right ${esc(s.rightReps)}` : ''}${s.variation ? ` · ${esc(s.variation)}` : ''}` : s.skipped ? 'Skipped' : 'Not recorded complete'}</li>`).join('')}</ul></section>`).join('')}
    <section class="card"><h2>Garmin recovery observations</h2><p id="hr-overview" class="muted"></p><ul id="hr-details"></ul><button id="export-workout">Download workout + HR data</button></section>
    <section class="card"><label>Comments (optional)<textarea id="comments" maxlength="100000" placeholder="Anything you want to remember…">${esc(session.comments)}</textarea></label><div class="actions"><button id="edit">Edit workout</button><button class="primary" id="finish">${session.status === 'completed' ? 'Save changes' : 'Save & finish'}</button></div><button id="abandon" class="danger wide" style="margin-top:12px">Mark abandoned · keep records</button></section><details><summary>Edit history (${session.audit.length} events)</summary><ul class="audit">${session.audit.map(a => `<li>${esc(stamp(a.at))}: ${esc(a.action)} ${esc(a.field || '')}${a.before !== undefined && typeof a.before !== 'object' ? ` · ${esc(a.before)} → ${esc(a.after)}` : ''}</li>`).join('')}</ul></details>`;
  document.querySelector('#export-workout').onclick = () => exportWorkout(session);
  paintRecoveryReport();
  document.querySelector('#comments').oninput = e => { const before = session.comments; session.comments = e.target.value; audit(session, 'comments-edit', { before, after: session.comments }); save(); };
  document.querySelector('#edit').onclick = () => go('exercise');
  document.querySelector('#finish').onclick = () => {
    const missing = session.exercises.some(e => !e.skipped && e.sets.some(s => !s.completedAt && !s.skipped));
    if (missing && !confirm('Some sets are not marked complete or skipped. Finish with those sets unrecorded?')) return;
    session.status = 'completed'; session.endedAt ||= new Date().toISOString(); audit(session, 'finish');
    db.timer = emptyTimer(db.settings.restSeconds); anchor = null;
    if (save()) go('history');
  };
  document.querySelector('#abandon').onclick = () => {
    if (!confirm('Mark this workout abandoned? All entries will remain in history.')) return;
    session.status = 'abandoned'; session.endedAt ||= new Date().toISOString(); audit(session, 'abandon');
    db.timer = emptyTimer(db.settings.restSeconds); anchor = null; if (save()) go('history');
  };
}
function historyView() {
  app.innerHTML = `<p class="eyebrow">Local history</p><h1>Every session counts.</h1><p>Tap a v4 session to edit its sets and comments. Classic records are preserved exactly; matching current Classic sessions can be edited in Classic.</p><ul class="log-list">${db.sessions.map(s => `<li><strong>${esc(s.label)}</strong><small>${esc(stamp(s.startedAt))} · ${esc(s.status)} · ${s.exercises.reduce((n, e) => n + e.sets.filter(s => s.completedAt).length, 0)} completed sets</small><button data-history="${esc(s.id)}">${s.status === 'in_progress' ? 'Resume / review' : 'View / edit'}</button></li>`).join('') || '<li>No v4 sessions yet.</li>'}</ul><h2>Preserved Classic history (${db.legacySessions.length})</h2><p><a href="../todays-workout-classic.html">Open Classic history / unfinished workout ↗</a></p><p class="muted">This is the initial Classic snapshot. To include later Classic edits, use “Refresh Classic snapshot” in Settings. Older prescription recaps remain downloadable as part of the full backup.</p>${db.legacySessions.map(s => `<details class="card"><summary>${esc(s.workoutDate || s.startedAt || s.id)} · ${s.completedAt ? 'Completed' : 'Unfinished'}</summary><pre style="white-space:pre-wrap">${esc(JSON.stringify(s, null, 2))}</pre></details>`).join('')}`;
  app.querySelectorAll('[data-history]').forEach(b => b.onclick = () => { activeId = b.dataset.history; go('summary'); });
}
function settingsView() {
  const s = db.settings;
  app.innerHTML = `<p class="eyebrow">Make it yours</p><h1>Settings & backup</h1><section class="card stack"><h2>Garmin capture & timed sets</h2><p>Add your Garmin after starting a workout. Capture runs while the workout or its summary is open. Keep the page visible for reliable readings. Complete set marks the end, and the optional Mark start button records when the next set begins. Download the combined workout and HR file from the workout summary.</p>${[['sound','Timed-set sound'],['vibration','Timed-set vibration where supported'],['tuesdayEnabled','Tuesday A enabled in my plan']].map(([key, label]) => `<label class="check"><input type="checkbox" data-setting="${key}" ${s[key] ? 'checked' : ''}>${label}</label>`).join('')}<div class="actions"><button id="test-sound">Test sound</button><button id="test-notification">Test notification / enable</button></div><label class="check"><input type="checkbox" data-setting="notifications" ${s.notifications ? 'checked' : ''}>Notifications (permission via test button)</label><p id="alert-status" role="status">Audio: ${audioReady ? 'unlocked for this page' : 'tap Test sound to unlock'} · Notifications: ${'Notification' in window ? Notification.permission : 'unsupported'}</p><p>Timed-set alerts and screen wake lock work on a best-effort basis. <a href="../fitness-v2/index.html">Open v2 for the rest timer and Google Clock handoff</a>.</p></section>
    <section class="card stack"><h2>Programme & display</h2><label>Four-week barbell hold starts<input id="hold-start" type="date" value="${esc(s.holdStart)}"></label>${holdNotice()}<p>No automatic load or set increases. User-edited loads stay editable suggestions; completion is always explicit.</p><label>Appearance<select id="theme">${['system','light','dark'].map(v => `<option ${s.theme === v ? 'selected' : ''}>${v}</option>`).join('')}</select></label></section>
    <section class="card stack"><h2>Your data, on this browser</h2><p>On first use, v4 copies existing v3 history from this browser, or v2 history if v3 is absent. Later changes are independent. You can import a compatible workout-history backup here. The separate workout + HR download is for analysis.</p><p>No sign-in, uploads or analytics. Clearing browser data or changing device can lose records. An installed app is still local storage, not a backup.</p><button class="primary" id="export">Export all data as JSON</button><label>Import JSON backup<input id="import-file" type="file" accept=".json,application/json"></label><label>Import action<select id="import-mode"><option value="merge">Merge sessions (incoming wins matching IDs)</option><option value="replace">Replace v4 database with backup</option></select></label><p id="import-status" role="status"></p><button id="refresh-classic">Refresh Classic snapshot (confirm first)</button><button id="previous-import">Download backup from before last import</button><p>Classic’s original storage is never overwritten. Imports require confirmation and make a local recovery copy first.</p></section>`;
  app.querySelectorAll('[data-setting]').forEach(input => input.onchange = () => { s[input.dataset.setting] = input.checked; save(); if (input.dataset.setting === 'sound' && input.checked) unlockAudio(); });
  document.querySelector('#hold-start').onchange = e => { const old = s.holdStart; s.holdStart = e.target.value; try { validateDb(db); save(); render(); } catch { s.holdStart = old; e.target.value = old; alert('Choose a valid start date.'); } };
  document.querySelector('#theme').onchange = e => { s.theme = e.target.value; save(); render(); };
  document.querySelector('#test-sound').onclick = async () => { await unlockAudio(); const played = await cue(true); document.querySelector('#alert-status').textContent = played ? 'Sound cue requested. Confirm you heard it on your device.' : 'Audio unavailable or blocked. Use the visible timer or Android Clock.'; };
  document.querySelector('#test-notification').onclick = async () => {
    const result = document.querySelector('#alert-status');
    try {
      if (!('Notification' in window)) throw Error('Notifications unsupported');
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') throw Error(`Notification permission ${permission}`);
      if (!registration) throw Error('Offline worker not ready; try again once cache is ready');
      await registration.showNotification('Fitness test', { body: 'This tests delivery now, not a scheduled background alarm.', tag: 'fitness-test' });
      s.notifications = true; save(); result.textContent = 'Test notification requested. Background expiry remains best effort.';
      app.querySelector('[data-setting=notifications]').checked = true;
    } catch (e) { result.textContent = e.message; }
  };
  document.querySelector('#export').onclick = exportAll;
  document.querySelector('#previous-import').onclick = () => { const raw = localStorage.getItem(IMPORT_BACKUP_KEY); raw ? download('fitness-before-import.json', raw) : alert('No previous import backup exists on this browser.'); };
  document.querySelector('#import-file').onchange = importFile;
  document.querySelector('#refresh-classic').onclick = () => {
    try {
      const raw = localStorage.getItem(LEGACY_KEY); if (raw === null) return alert('No Classic records on this browser.');
      const next = clone(db); next.legacyRaw = raw; next.legacySessions = JSON.parse(raw).sessions; validateDb(next);
      if (!confirm(`Refresh the preserved snapshot with ${next.legacySessions.length} Classic records? Existing snapshot will be backed up first. Classic itself stays unchanged.`)) return;
      localStorage.setItem(IMPORT_BACKUP_KEY, JSON.stringify(db)); db = next; if (save()) render();
    } catch (e) { alert(`Classic refresh rejected: ${e.message}`); }
  };
}
async function importFile(event) {
  const output = document.querySelector('#import-status');
  try {
    if (conflict) throw Error('Export and reload before importing; another tab changed the database.');
    const file = event.target.files[0]; if (!file) return;
    output.textContent = 'Validating backup…';
    if (file.size > 10 * 1024 * 1024) throw Error('File exceeds 10 MB. Original data is unchanged.');
    const incoming = validateDb(JSON.parse(await file.text()));
    const replace = document.querySelector('#import-mode').value === 'replace';
    const next = replace ? { ...clone(incoming), timer: emptyTimer(incoming.settings.restSeconds) } : mergeDb(db, incoming);
    if (!confirm(`${replace ? 'REPLACE all v4 data' : 'MERGE sessions; incoming records replace matching IDs'} with ${incoming.sessions.length} workout and ${incoming.legacySessions.length} Classic records? A local pre-import backup will be saved. Classic storage will not change.`)) { output.textContent = 'Import cancelled. No data changed.'; return; }
    localStorage.setItem(IMPORT_BACKUP_KEY, JSON.stringify(db));
    const previous = db; db = next;
    if (!save('Import saved locally. Export a fresh backup.')) { db = previous; throw Error('Import not saved; existing stored data retained.'); }
    anchor = null; activeId = db.sessions.find(s => s.status === 'in_progress')?.id || null;
    render();
    document.querySelector('#import-status').textContent = 'Import complete. A pre-import recovery copy is available below.';
  } catch (e) { output.textContent = `Import rejected: ${e.message}`; }
  event.target.value = '';
}

async function unlockAudio() {
  try {
    const Audio = window.AudioContext || window.webkitAudioContext; if (!Audio) return false;
    context ||= new Audio(); await context.resume(); audioReady = context.state === 'running'; return audioReady;
  } catch { return false; }
}
async function cue(test = false) {
  if (!test && db.settings.vibration) navigator.vibrate?.([200, 100, 200]);
  if ((!test && !db.settings.sound) || !context || context.state !== 'running') return false;
  try {
    const start = context.currentTime + .03;
    [0, .35, .7].forEach((offset, i) => {
      const o = context.createOscillator(), gain = context.createGain();
      o.frequency.value = i === 2 ? 980 : 820;
      gain.gain.setValueAtTime(.001, start + offset); gain.gain.exponentialRampToValueAtTime(.25, start + offset + .02); gain.gain.exponentialRampToValueAtTime(.001, start + offset + .25);
      o.connect(gain).connect(context.destination); o.start(start + offset); o.stop(start + offset + .26);
    }); return true;
  } catch { return false; }
}
function setAnchor() { anchor = db.timer.state === 'running' ? { expiryId: db.timer.expiryId, mono: performance.now(), remaining: remaining(db.timer) } : null; }
function runTimedSet(seconds) {
  if (db.timer.state === 'running' && !confirm('Replace the running timer?')) return;
  unlockAudio(); db.timer = startTimer(emptyTimer(seconds), activeId); setAnchor(); save(); drawTimer();
}
function effectiveRemaining() {
  const t = db.timer;
  let ms = remaining(t);
  // Within a live page, a backwards wall-clock adjustment must not lengthen a timed set.
  // Reload/resume always has the persisted wall deadline as its fallback.
  if (t.state === 'running' && anchor?.expiryId === t.expiryId) ms = Math.min(ms, Math.max(0, anchor.remaining - (performance.now() - anchor.mono)));
  return ms;
}
function drawTimer() {
  if (!db) return;
  const t = db.timer;
  const ms = effectiveRemaining();
  if (t.state === 'running' && ms <= 0) {
    const notify = expireTimer(t, Math.max(Date.now(), t.endAt));
    save(); anchor = null;
    if (notify && !conflict) {
      cue(); document.querySelector('#timer-announcement').textContent = 'Timer complete. Background alerts may be delayed.';
      if (db.settings.notifications && 'Notification' in window && Notification.permission === 'granted' && registration) registration.showNotification('Timer complete', { body: 'Return to your workout. This alert may be delayed in the background.', tag: t.expiryId }).catch(() => {});
    }
  }
  document.querySelector('#timer-display').textContent = clock(ms);
  document.querySelector('#timer-state').textContent = t.state === 'expired' ? 'TIMED SET COMPLETE' : 'TIMED SET';
  document.querySelector('#hold-timer').hidden = !['running', 'expired'].includes(t.state);
}
async function manageWake() {
  if (!('wakeLock' in navigator)) return;
  const should = document.visibilityState === 'visible' && view === 'exercise' && current()?.status === 'in_progress';
  if (!should && wakeLock) { await wakeLock.release().catch(() => {}); wakeLock = null; }
  else if (should && !wakeLock && !wakePending) {
    wakePending = true;
    try {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
      if (!(document.visibilityState === 'visible' && view === 'exercise' && current()?.status === 'in_progress')) { await wakeLock.release(); wakeLock = null; }
    } catch { /* Battery saver and browser policy may refuse a visible-screen lock. */ }
    finally { wakePending = false; }
  }
}
document.querySelectorAll('[data-view]').forEach(b => b.onclick = () => { if (db) go(b.dataset.view); });
document.querySelector('#timer-reset').onclick = () => {
  if (!db) return;
  db.timer = emptyTimer(db.settings.restSeconds); anchor = null; save(); drawTimer();
};
function refreshDayDirection() {
  if (db && view === 'today' && document.visibilityState === 'visible' && (displayedDate !== dublinDate() || displayedDirection !== recommendation().dayLabel)) render();
}
document.addEventListener('visibilitychange', () => { refreshDayDirection(); drawTimer(); manageWake(); });
window.addEventListener('pageshow', () => { refreshDayDirection(); drawTimer(); manageWake(); });
window.addEventListener('pagehide', () => { wakeLock?.release().catch(() => {}); });
window.addEventListener('storage', e => { if (e.key === KEY && db) { conflict = true; status.classList.add('error'); status.textContent = 'Another tab changed workout data. Export this tab’s unsaved work, then reload before continuing.'; } });
setInterval(drawTimer, 250);
new ResizeObserver(entries => { document.documentElement.style.setProperty('--timer-height', `${entries[0].target.getBoundingClientRect().height}px`); }).observe(document.querySelector('#timer'));
// Use the visual viewport so the dock follows the keyboard; scroll padding keeps
// fields/navigation above its measured height without guessing a phone size.
function viewport() {
  const v = window.visualViewport;
  document.querySelector('#timer').style.bottom = v ? `${Math.max(0, window.innerHeight - v.height - v.offsetTop)}px` : '0';
  document.documentElement.style.scrollPaddingBottom = `${document.querySelector('#timer').offsetHeight + 24}px`;
}
window.visualViewport?.addEventListener('resize', viewport); window.visualViewport?.addEventListener('scroll', viewport); viewport();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').then(async r => {
  registration = r;
  const update = () => { if (r.waiting && navigator.serviceWorker.controller) offlineStatus.textContent = 'Update ready. Finish or save your workout, then close all v4 tabs and reopen to update safely.'; };
  r.addEventListener('updatefound', () => r.installing?.addEventListener('statechange', update)); update();
  await navigator.serviceWorker.ready;
  offlineStatus.textContent = 'Offline cache ready · Install from your browser menu for quick access.';
  update();
}).catch(e => { offlineStatus.textContent = `Offline cache unavailable: ${e.message}. Online use only until this succeeds.`; });
