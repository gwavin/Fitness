import { EffortSignal, readBpm } from './effort-signal.mjs';

const signal = new EffortSignal();
const connect = document.querySelector('#hr-connect');
const manual = document.querySelector('#hr-manual');
const status = document.querySelector('#hr-status');
const bpm = document.querySelector('#hr-bpm');
const available = window.isSecureContext && Boolean(navigator.bluetooth);
const labels = {
  waiting: 'Waiting for heart-rate signal',
  calibrating: 'Establishing baseline · stay still',
  ready: 'Heart rate recovered',
  effort: 'Effort',
  recovery: 'Heart rate recovering',
};
let device, characteristic, busy = false, session = null, message = '';

function paint() {
  signal.expire(performance.now());
  const phase = session ? signal.phase : 'waiting';
  const connected = Boolean(device?.gatt.connected);
  document.documentElement.dataset.effort = phase;
  const label = message || (connected ? (session ? labels[phase] : 'Strap connected · open a workout') : 'Connect your Garmin HRM-Pro Plus');
  if (status.textContent !== label) status.textContent = label;
  const reading = signal.bpm === null ? '— bpm' : signal.bpm + ' bpm';
  if (bpm.textContent !== reading) bpm.textContent = reading;
  connect.textContent = busy ? 'Connecting…' : connected ? 'Disconnect' : 'Connect HRM';
  connect.disabled = busy || !available;
  manual.disabled = !session || signal.baseline === null;
  manual.textContent = phase === 'effort' ? 'Start recovery' : 'Start effort';
}

function receive(event) {
  if (event.target !== characteristic || document.hidden) return;
  const reading = readBpm(event.target.value);
  if (reading === null) { signal.reset(); paint(); return; }
  const now = performance.now();
  if (session) signal.ingest(reading, now);
  else { signal.last = now; signal.bpm = reading; }
  message = '';
  paint();
}

function disconnect(note) {
  characteristic?.removeEventListener('characteristicvaluechanged', receive);
  characteristic = null;
  const previous = device;
  device = null;
  previous?.removeEventListener('gattserverdisconnected', lost);
  previous?.gatt.disconnect();
  signal.reset();
  message = note;
  paint();
}

function lost() { disconnect('Strap disconnected · reconnect to resume'); }

connect.onclick = async () => {
  if (device?.gatt.connected) { disconnect('Strap disconnected'); return; }
  busy = true;
  message = '';
  paint();
  try {
    device = await navigator.bluetooth.requestDevice({ filters: [{ services: ['heart_rate'] }] });
    device.addEventListener('gattserverdisconnected', lost);
    const server = await device.gatt.connect();
    const service = await server.getPrimaryService('heart_rate');
    characteristic = await service.getCharacteristic('heart_rate_measurement');
    characteristic.addEventListener('characteristicvaluechanged', receive);
    await characteristic.startNotifications();
  } catch (error) {
    disconnect(error.name === 'NotFoundError' ? 'No strap selected' : 'Could not connect · check your strap and try again');
  } finally {
    busy = false;
    paint();
  }
};
manual.onclick = () => { signal.manual(performance.now()); paint(); };
if (!available) message = 'Bluetooth unavailable here · try Chrome on Android or Chrome/Edge on a supported computer';
setInterval(paint, 500);
document.addEventListener('visibilitychange', () => { if (document.hidden) signal.reset(); paint(); });
window.addEventListener('pagehide', () => { if (device) disconnect('Strap disconnected · reconnect to resume'); });
paint();

export function showEffortFor(workoutId) {
  if (session !== workoutId) { session = workoutId; signal.reset(); paint(); }
}

export function finishEffort() {
  signal.expire(performance.now());
  if (signal.phase === 'effort') { signal.manual(performance.now()); paint(); }
}
