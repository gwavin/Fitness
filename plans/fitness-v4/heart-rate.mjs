import { decodeMeasurement } from './telemetry.mjs';

const panel = document.querySelector('#hr-panel');
const button = document.querySelector('#hr-connect');
const status = document.querySelector('#hr-status');
const available = window.isSecureContext && Boolean(navigator.bluetooth);
const captures = new Map();
let sessionId = null, device, characteristic, busy = false, message = '';

function capture(id) {
  if (!captures.has(id)) {
    const key = 'fitness-v4-hr:' + id;
    let raw = null;
    let samples = [];
    let error = '';
    try { raw = localStorage.getItem(key); samples = raw ? JSON.parse(raw) : []; if (!Array.isArray(samples)) throw Error(); }
    catch { samples = []; error = 'Previous HR data could not be opened. Export this session before closing.'; }
    captures.set(id, { key, raw, samples, error, locked: Boolean(error), dirty: false });
  }
  return captures.get(id);
}

function flush(id = sessionId) {
  if (!id) return;
  const item = capture(id);
  if (!item.dirty || item.locked) return;
  try {
    if (localStorage.getItem(item.key) !== item.raw) {
      item.locked = true;
      throw Error('Another tab saved HR data. Export this tab before closing.');
    }
    const json = JSON.stringify(item.samples);
    localStorage.setItem(item.key, json);
    item.raw = json;
    item.dirty = false;
    item.error = '';
  } catch (error) {
    item.error = item.locked ? error.message : 'HR data could not be saved. Export this session before closing.';
  }
}

function paint() {
  panel.hidden = !sessionId;
  if (!sessionId) return;
  const item = capture(sessionId);
  const connected = Boolean(device?.gatt.connected && characteristic);
  const last = item.samples.at(-1);
  const label = item.error || (!available ? 'Bluetooth unavailable in this browser' : message ||
    (connected ? (!last || Date.now() - last.t > 5000 ? 'Waiting for readings' : last.contact === false ? 'Check strap contact' : 'Recording HR in this workout') : 'Garmin optional'));
  if (status.textContent !== label) status.textContent = label;
  button.textContent = busy ? 'Connecting…' : connected ? 'Disconnect HRM' : 'Add Garmin HRM';
  button.disabled = busy || !available;
}

function receive(event) {
  if (!sessionId || event.target !== characteristic) return;
  const data = decodeMeasurement(event.target.value);
  if (!data) return;
  const item = capture(sessionId);
  item.samples.push({ t: Date.now(), ...data });
  item.dirty = true;
}

function disconnect(note = '') {
  characteristic?.removeEventListener('characteristicvaluechanged', receive);
  characteristic = null;
  const previous = device;
  device = null;
  previous?.removeEventListener('gattserverdisconnected', lost);
  if (previous?.gatt.connected) previous.gatt.disconnect();
  message = note;
  flush();
  paint();
}
function lost() { disconnect('Strap disconnected · reconnect to resume'); }

button.onclick = async () => {
  if (device?.gatt.connected) { disconnect(); return; }
  const requestedSession = sessionId;
  busy = true;
  message = '';
  paint();
  try {
    const selected = await navigator.bluetooth.requestDevice({ filters: [{ services: ['heart_rate'] }] });
    if (sessionId !== requestedSession) return;
    device = selected;
    device.addEventListener('gattserverdisconnected', lost);
    const server = await selected.gatt.connect();
    const service = await server.getPrimaryService('heart_rate');
    const stream = await service.getCharacteristic('heart_rate_measurement');
    if (device !== selected || sessionId !== requestedSession) { if (selected.gatt.connected) selected.gatt.disconnect(); return; }
    characteristic = stream;
    stream.addEventListener('characteristicvaluechanged', receive);
    await stream.startNotifications();
  } catch (error) {
    if (sessionId === requestedSession) disconnect(error.name === 'NotFoundError' ? 'No strap selected' : 'Could not connect · check the strap');
  } finally { busy = false; paint(); }
};

export function collectFor(id) {
  if (id === sessionId) return;
  disconnect();
  sessionId = id;
  paint();
}
export function readCapture(id) {
  flush(id);
  return capture(id).samples;
}
export function checkpointCapture() { flush(); paint(); }

setInterval(checkpointCapture, 5000);
setInterval(paint, 1000);
document.addEventListener('visibilitychange', checkpointCapture);
window.addEventListener('pagehide', () => disconnect());
