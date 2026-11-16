import { collectFor, readCapture, checkpointCapture } from './heart-rate.mjs';
import { classReport } from './report.mjs';

const key = 'fitness-v5-karate';
const byId = id => document.getElementById(id);
const date = new Intl.DateTimeFormat('en-IE', {dateStyle:'medium', timeStyle:'short', timeZone:'Europe/Dublin'});
const clock = ms => {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return [Math.floor(seconds / 60), seconds % 60].map(n => String(n).padStart(2, '0')).join(':');
};
const announce = message => { byId('notice').textContent = message; };
const show = (id, visible) => { byId(id).hidden = !visible; };
let raw, state = { active: null, history: [] }, selected, wakeLock, wakePending = false, blocked = false;

try {
  raw = localStorage.getItem(key);
  if (raw !== null) state = JSON.parse(raw);
  if (!state || !Array.isArray(state.history)) throw Error();
} catch {
  state = { active: null, history: [] };
  blocked = true;
  announce('Class history could not be opened. Existing data has been kept.');
}

function save(next) {
  try {
    if (blocked || localStorage.getItem(key) !== raw) throw Error('History changed in another tab. Reopen this page before editing.');
    const json = JSON.stringify(next);
    localStorage.setItem(key, json);
    raw = json;
    state = next;
    announce('');
    return true;
  } catch (error) {
    announce(error.message || 'Could not save this class.');
    return false;
  }
}

async function manageScreen() {
  if (!navigator.wakeLock || wakePending) return;
  const wanted = () => Boolean(state.active) && !document.hidden;
  if (!wanted()) {
    const lock = wakeLock;
    wakeLock = null;
    await lock?.release().catch(() => {});
  } else if (!wakeLock) {
    wakePending = true;
    try {
      const lock = await navigator.wakeLock.request('screen');
      if (!wanted()) await lock.release();
      else {
        wakeLock = lock;
        lock.addEventListener('release', () => { if (wakeLock === lock) wakeLock = null; }, { once: true });
      }
    } catch { /* Capture can still run with the page visible. */ }
    finally { wakePending = false; }
  }
}
function updateClock() {
  byId('elapsed').textContent = clock(state.active ? Date.now() - state.active.startedAt : 0);
}
function render() {
  const active = state.active;
  show('start', !active && !blocked);
  show('finish', Boolean(active));
  show('markers', Boolean(active));
  byId('instructions').textContent = active
    ? 'Wait for live BPM and a rising sample count. Keep the phone nearby and this screen visible.'
    : 'Start the session, then add your Garmin. Leave this page visible while recording.';
  byId('current-phase').textContent = active?.markers.at(-1)?.label || '';
  collectFor(active?.id ?? null);
  updateClock();
  manageScreen();

  const past = byId('history');
  past.replaceChildren();
  show('empty', !state.history.length);
  for (const session of state.history) {
    const li = document.createElement('li');
    const button = document.createElement('button');
    button.textContent = `${date.format(session.startedAt)} · ${clock(session.endedAt - session.startedAt)}`;
    button.onclick = () => { selected = session.id; renderSummary(); byId('report').scrollIntoView({block:'start'}); };
    li.append(button);
    past.append(li);
  }
  renderSummary();
}
function renderSummary() {
  const session = state.history.find(s => s.id === selected);
  show('report', Boolean(session));
  if (!session) return;
  const report = classReport(session, readCapture(session.id));
  byId('metrics').textContent = report.medianBpm === null
    ? 'No usable heart-rate readings for this class.'
    : `Median ${report.medianBpm} bpm · 95th-percentile HR ${report.p95Bpm} bpm`;
  byId('coverage').textContent = `${report.coveragePct}% of class seconds have usable HR · ${report.sampleCount} total packets`;
  const blocks = byId('blocks');
  blocks.replaceChildren();
  for (const block of report.blocks) {
    const row = blocks.insertRow();
    for (const text of [`${clock(block.startMs)}–${clock(block.endMs)}`, block.medianBpm ?? '—', block.coveragePct + '%']) {
      row.insertCell().textContent = text;
    }
  }
  byId('phase-summary').textContent = report.phases.length ? report.phases.map(p =>
    `${p.label} ${clock(p.startMs)}: ${p.medianBpm ?? '—'} bpm median (${p.coveragePct}% coverage)`).join(' · ') : 'No phases marked.';
  byId('effort').value = session.effort ?? '';
}
byId('start').onclick = () => {
  if (state.active) return;
  if (save({ ...state, active: { id: crypto.randomUUID(), startedAt: Date.now(), markers: [], effort: null } })) {
    selected = null;
    render();
  }
};
byId('finish').onclick = () => {
  if (!state.active) return;
  checkpointCapture();
  const session = { ...state.active, endedAt: Date.now() };
  if (save({ active: null, history: [session, ...state.history] })) {
    selected = session.id;
    render();
    byId('report').scrollIntoView({block:'start'});
  }
};
for (const button of document.querySelectorAll('[data-phase]')) {
  button.onclick = () => {
    const active = state.active;
    if (!active || active.markers.at(-1)?.label === button.dataset.phase) return;
    if (save({ ...state, active: { ...active, markers: [...active.markers, { t: Date.now(), label: button.dataset.phase }] } })) {
      byId('current-phase').textContent = button.dataset.phase;
    }
  };
}
byId('effort').onchange = event => {
  const { value, validity } = event.target;
  if (!validity.valid) { announce('Enter a whole number from 0 to 10.'); return; }
  save({ ...state, history: state.history.map(s => s.id === selected ? { ...s, effort: value === '' ? null : Number(value) } : s) });
};
byId('download').onclick = () => {
  const session = state.history.find(s => s.id === selected);
  if (!session) return;
  const samples = readCapture(session.id);
  const json = JSON.stringify({
    format: 'fitness-v5-karate-v1', session, report: classReport(session, samples),
    measurement: { source: 'Bluetooth Heart Rate Measurement', rrUnit: '1/1024 second', timestamp: 'Unix milliseconds, browser receipt time', samples }
  }, null, 2);
  const url = URL.createObjectURL(new Blob([json], {type:'application/json'}));
  Object.assign(document.createElement('a'), {href:url, download:`karate-${new Date(session.startedAt).toISOString().slice(0, 10)}.json`}).click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
document.addEventListener('visibilitychange', manageScreen);
setInterval(updateClock, 1000);
render();
