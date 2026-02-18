// === DOM Elements ===
const getEl = (id) => document.getElementById(id);
const runSecondsEl = getEl('runSeconds');
const walkSecondsEl = getEl('walkSeconds');
const bpmEl = getEl('bpm');
const goalLapsEl = getEl('goalLaps');
const startPauseBtn = getEl('startPauseBtn');
const resetBtn = getEl('resetBtn');
const phaseEl = getEl('phase');
const timerEl = getEl('timer');
const lapsEl = getEl('laps');
const canvas = getEl('progressCanvas');
const ctx = canvas.getContext('2d');
const metronomeEl = getEl('metronome');
const beepEl = getEl('beepAudio');

// === State ===
let state = 'idle'; // idle, countdown, running, walking, paused, completed
let pausedState = 'idle';
let currentPhase = 'running'; // running, walking
let lapCount = 0;
let remaining = 0;
let phaseStartTime = 0;
let totalPhaseDuration = 0;
let beatCount = 0;
let warningBeepsPlayed = [false, false, false];
let animationFrameId = null;
let wakeLock = null;
const countdownTimers = [];

// === User Settings ===
const defaultSettings = {
  runSec: 120,
  walkSec: 60,
  bpm: 170,
  goalLaps: 3
};

let settings = { ...defaultSettings };

// === Audio ===
let audioCtx = null;
let isMetronomeRunning = false;
let metronomeTimerId = null;
let metronomeStopTimerId = null;

function createAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
}

function createBeepDataUrl() {
  const sampleRate = 22050;
  const durationSec = 0.12;
  const frequency = 1700;
  const sampleCount = Math.floor(sampleRate * durationSec);
  const pcm = new Int16Array(sampleCount);

  for (let i = 0; i < sampleCount; i++) {
    const t = i / sampleRate;
    let envelope = 1;
    if (t < 0.005) {
      envelope = t / 0.005;
    } else if (t > durationSec - 0.02) {
      envelope = Math.max(0, (durationSec - t) / 0.02);
    }
    pcm[i] = Math.floor(32767 * 0.32 * envelope * Math.sin(2 * Math.PI * frequency * t));
  }

  const buffer = new ArrayBuffer(44 + pcm.length * 2);
  const view = new DataView(buffer);

  const writeString = (offset, value) => {
    for (let i = 0; i < value.length; i++) {
      view.setUint8(offset + i, value.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + pcm.length * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, pcm.length * 2, true);

  for (let i = 0; i < pcm.length; i++) {
    view.setInt16(44 + i * 2, pcm[i], true);
  }

  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return `data:audio/wav;base64,${btoa(binary)}`;
}

function initializeAudioElement() {
  if (!beepEl) {
    return;
  }

  if (!beepEl.src) {
    beepEl.src = createBeepDataUrl();
  }
  beepEl.preload = 'auto';
  beepEl.playsInline = true;
  beepEl.volume = 1;
}

function playSound({ freq = 1000, duration = 0.12, type = 'sine', pan = 0 } = {}) {
  createAudioContext();
  if (!audioCtx) {
    return false;
  }

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  const panner = audioCtx.createStereoPanner();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
  panner.pan.setValueAtTime(pan, audioCtx.currentTime);

  gain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.25, audioCtx.currentTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);

  osc.connect(gain).connect(panner).connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + duration + 0.01);
  return true;
}

function playBeep() {
  if (!beepEl) {
    return false;
  }

  try {
    beepEl.currentTime = 0;
    const playPromise = beepEl.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {});
    }
    return true;
  } catch {
    return false;
  }
}

function playCadenceBeep() {
  const isLeft = beatCount % 2 === 0;
  const usedAudio = playBeep();
  if (!usedAudio) {
    playSound({ freq: isLeft ? 880 : 800, duration: 0.1, pan: isLeft ? -0.7 : 0.7 });
  }
  metronomeEl.classList.add('active');
  setTimeout(() => metronomeEl.classList.remove('active'), 200);
  beatCount++;
}

function playToneSequence(tones) {
  createAudioContext();

  if (!audioCtx) {
    tones.forEach((_, index) => {
      setTimeout(() => {
        playBeep();
      }, index * 150);
    });
    return;
  }

  tones.forEach(({ freq, duration = 0.12, type = 'sine', pan = 0 }, index) => {
    setTimeout(() => {
      playSound({ freq, duration, type, pan });
    }, index * 150);
  });
}

const playPhaseChangeSound = () => playToneSequence([
  { freq: 880, duration: 0.13, type: 'triangle' },
  { freq: 1100, duration: 0.14, type: 'triangle' }
]);

const playCountdownSound = () => playToneSequence([
  { freq: 520, duration: 0.11, type: 'sine' },
  { freq: 660, duration: 0.11, type: 'sine' }
]);

const playWarningBeep = () => playBeep() || playSound({ freq: 1000, duration: 0.12, type: 'square' });

function startMetronome(bpm, durationSeconds) {
  stopMetronome();
  const intervalMs = (60 / bpm) * 1000;
  isMetronomeRunning = true;

  function scheduleBeep() {
    if (!isMetronomeRunning) {
      return;
    }
    playCadenceBeep();
    metronomeTimerId = setTimeout(scheduleBeep, intervalMs);
  }

  scheduleBeep();
  metronomeStopTimerId = setTimeout(() => {
    stopMetronome();
  }, durationSeconds * 1000);
}

function stopMetronome() {
  isMetronomeRunning = false;
  if (metronomeTimerId) {
    clearTimeout(metronomeTimerId);
    metronomeTimerId = null;
  }
  if (metronomeStopTimerId) {
    clearTimeout(metronomeStopTimerId);
    metronomeStopTimerId = null;
  }
}

// === Wake Lock ===
async function requestWakeLock() {
  if (!('wakeLock' in navigator) || wakeLock) {
    return;
  }

  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => {
      wakeLock = null;
    });
  } catch {
    wakeLock = null;
  }
}

async function releaseWakeLock() {
  if (!wakeLock) {
    return;
  }

  try {
    await wakeLock.release();
  } catch {
    // ignore release failures
  }
  wakeLock = null;
}

function clearCountdownTimers() {
  while (countdownTimers.length > 0) {
    clearTimeout(countdownTimers.pop());
  }
}

// === Notifications ===
function requestNotificationPermissionIfNeeded() {
  if (!('Notification' in window) || Notification.permission !== 'default') {
    return;
  }
  Notification.requestPermission().catch(() => {});
}

function notifyPhaseChange(title, body) {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return;
  }

  try {
    new Notification(title, { body, silent: true });
  } catch {
    // ignore notification failures
  }
}

// === Canvas Drawing ===
function drawProgress(progress, color) {
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const radius = centerX - 12;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.lineWidth = 14;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI * progress);
  ctx.strokeStyle = color;
  ctx.lineWidth = 14;
  ctx.lineCap = 'round';
  ctx.stroke();
}

// === UI Updates ===
function updateDisplay() {
  timerEl.textContent = remaining;
  lapsEl.textContent = `${lapCount} / ${settings.goalLaps}`;

  const progress = totalPhaseDuration > 0 ? (totalPhaseDuration - remaining) / totalPhaseDuration : 0;
  let phaseColor = 'gray';

  if (state === 'running' || (state === 'paused' && currentPhase === 'running')) {
    phaseColor = 'var(--run-color)';
    phaseEl.textContent = state === 'paused' ? 'Paused' : 'Run';
  } else if (state === 'walking' || (state === 'paused' && currentPhase === 'walking')) {
    phaseColor = 'var(--walk-color)';
    phaseEl.textContent = state === 'paused' ? 'Paused' : 'Walk';
  } else if (state === 'countdown') {
    phaseEl.textContent = 'Get Ready';
    phaseColor = 'var(--accent-color)';
  } else if (state === 'completed') {
    phaseEl.textContent = 'Completed!';
    phaseColor = 'var(--run-color)';
    drawProgress(1, phaseColor);
  } else {
    phaseEl.textContent = 'Ready';
    timerEl.textContent = settings.runSec;
    phaseColor = 'rgba(255, 255, 255, 0.3)';
    drawProgress(0, phaseColor);
  }

  if (state !== 'completed' && state !== 'idle') {
    drawProgress(progress, phaseColor);
  }
}

function setInputsDisabled(disabled) {
  runSecondsEl.disabled = disabled;
  walkSecondsEl.disabled = disabled;
  bpmEl.disabled = disabled;
  goalLapsEl.disabled = disabled;
}

// === Timer Logic ===
function mainLoop(timestamp) {
  if (state !== 'running' && state !== 'walking' && state !== 'countdown') {
    return;
  }

  const elapsed = (timestamp - phaseStartTime) / 1000;
  remaining = Math.max(0, Math.ceil(totalPhaseDuration - elapsed));

  if (state === 'walking' && remaining <= 3 && remaining > 0) {
    const secondsLeft = Math.ceil(totalPhaseDuration - elapsed);
    if (secondsLeft === 3 && !warningBeepsPlayed[0]) {
      playWarningBeep();
      warningBeepsPlayed[0] = true;
    } else if (secondsLeft === 2 && !warningBeepsPlayed[1]) {
      playWarningBeep();
      warningBeepsPlayed[1] = true;
    } else if (secondsLeft === 1 && !warningBeepsPlayed[2]) {
      playWarningBeep();
      warningBeepsPlayed[2] = true;
    }
  }

  updateDisplay();

  if (remaining <= 0) {
    handlePhaseEnd();
  }

  animationFrameId = requestAnimationFrame(mainLoop);
}

function startPhase(phase, duration) {
  phaseStartTime = performance.now();
  totalPhaseDuration = duration;
  remaining = duration;
  state = phase;
  warningBeepsPlayed = [false, false, false];

  if (phase === 'running') {
    currentPhase = 'running';
    beatCount = 0;
    startMetronome(settings.bpm, duration);
  } else if (phase === 'walking') {
    currentPhase = 'walking';
    stopMetronome();
  } else {
    stopMetronome();
  }

  requestWakeLock();
  animationFrameId = requestAnimationFrame(mainLoop);
}

function handlePhaseEnd() {
  playPhaseChangeSound();
  if (state === 'countdown') {
    startPhase('running', settings.runSec);
    notifyPhaseChange('Run started', `Run for ${settings.runSec}s`);
  } else if (state === 'running') {
    startPhase('walking', settings.walkSec);
    notifyPhaseChange('Walk started', `Walk for ${settings.walkSec}s`);
  } else if (state === 'walking') {
    lapCount++;
    if (lapCount >= settings.goalLaps) {
      completeWorkout();
    } else {
      startPhase('running', settings.runSec);
    }
  }
}

function completeWorkout() {
  state = 'completed';
  clearCountdownTimers();
  cancelAnimationFrame(animationFrameId);
  stopMetronome();
  releaseWakeLock();
  playCompletedSound();
  notifyPhaseChange('Workout complete', `Finished ${settings.goalLaps} laps`);

  startPauseBtn.textContent = 'Start';
  resetBtn.disabled = false;
  setInputsDisabled(false);
  updateDisplay();
}

// === Settings Persistence ===
function sanitizeInt(value, fallback, min = 1) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < min) {
    return fallback;
  }
  return parsed;
}

function normalizeSettings(rawSettings) {
  return {
    runSec: sanitizeInt(rawSettings?.runSec, defaultSettings.runSec),
    walkSec: sanitizeInt(rawSettings?.walkSec, defaultSettings.walkSec),
    bpm: sanitizeInt(rawSettings?.bpm, defaultSettings.bpm),
    goalLaps: sanitizeInt(rawSettings?.goalLaps, defaultSettings.goalLaps)
  };
}

function loadSettingsFromUI() {
  settings = normalizeSettings({
    runSec: runSecondsEl.value,
    walkSec: walkSecondsEl.value,
    bpm: bpmEl.value,
    goalLaps: goalLapsEl.value
  });

  runSecondsEl.value = settings.runSec;
  walkSecondsEl.value = settings.walkSec;
  bpmEl.value = settings.bpm;
  goalLapsEl.value = settings.goalLaps;
}

function saveSettings() {
  loadSettingsFromUI();
  localStorage.setItem('runWalkTimerSettings', JSON.stringify(settings));
}

function loadSettings() {
  const saved = localStorage.getItem('runWalkTimerSettings');

  if (saved) {
    try {
      settings = normalizeSettings(JSON.parse(saved));
    } catch {
      settings = { ...defaultSettings };
    }
  } else {
    settings = { ...defaultSettings };
  }

  runSecondsEl.value = settings.runSec;
  walkSecondsEl.value = settings.walkSec;
  bpmEl.value = settings.bpm;
  goalLapsEl.value = settings.goalLaps;
}

// === Event Handlers ===
function handleStartPause() {
  initializeAudioElement();
  createAudioContext();

  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }

  requestNotificationPermissionIfNeeded();

  if (state === 'idle' || state === 'completed') {
    loadSettingsFromUI();
    lapCount = 0;
    startPhase('countdown', 3);

    clearCountdownTimers();
    playCountdownSound();
    countdownTimers.push(setTimeout(playCountdownSound, 1000));
    countdownTimers.push(setTimeout(playCountdownSound, 2000));

    startPauseBtn.textContent = 'Pause';
    resetBtn.disabled = false;
    setInputsDisabled(true);
  } else if (state === 'paused') {
    state = pausedState;
    phaseStartTime = performance.now() - ((totalPhaseDuration - remaining) * 1000);
    animationFrameId = requestAnimationFrame(mainLoop);
    requestWakeLock();

    if (currentPhase === 'running') {
      startMetronome(settings.bpm, remaining);
    }
    startPauseBtn.textContent = 'Pause';
  } else {
    pausedState = state;
    state = 'paused';
    clearCountdownTimers();
    cancelAnimationFrame(animationFrameId);
    stopMetronome();
    releaseWakeLock();
    startPauseBtn.textContent = 'Resume';
    updateDisplay();
  }
}

function handleReset() {
  clearCountdownTimers();
  cancelAnimationFrame(animationFrameId);
  stopMetronome();
  releaseWakeLock();

  state = 'idle';
  pausedState = 'idle';
  currentPhase = 'running';
  lapCount = 0;
  remaining = 0;
  warningBeepsPlayed = [false, false, false];

  startPauseBtn.textContent = 'Start';
  resetBtn.disabled = true;
  setInputsDisabled(false);
  updateDisplay();
}

// Re-acquire wake lock when returning to visible tab while timer is active.
document.addEventListener('visibilitychange', () => {
  const sessionActive = state === 'running' || state === 'walking' || state === 'countdown';
  if (document.visibilityState === 'visible' && sessionActive) {
    requestWakeLock();
    if (currentPhase === 'running' && !isMetronomeRunning) {
      startMetronome(settings.bpm, remaining);
    }
    if (audioCtx?.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
  }
});

// === PWA Install ===
let deferredPrompt;
const installBtn = getEl('installButton');
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  if (installBtn) {
    installBtn.style.display = 'block';
  }
});

if (installBtn) {
  installBtn.addEventListener('click', async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log('User choice:', outcome);
      deferredPrompt = null;
      installBtn.style.display = 'none';
    } else if (isIOS && !isStandalone) {
      alert('To install this app on iOS:\n1. Tap the Share button\n2. Select "Add to Home Screen"\n3. Tap "Add"');
    }
  });

  if (isIOS && !isStandalone) {
    installBtn.style.display = 'block';
    installBtn.textContent = '📱 Add to Home Screen';
  }
}

// === Media Session ===
if ('mediaSession' in navigator) {
  navigator.mediaSession.metadata = new MediaMetadata({
    title: 'Run/Walk Cadence Timer',
    artist: 'Interval Training',
    artwork: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' }
    ]
  });

  navigator.mediaSession.setActionHandler('play', () => {
    if (state === 'paused') {
      handleStartPause();
    }
  });

  navigator.mediaSession.setActionHandler('pause', () => {
    if (state === 'running' || state === 'walking' || state === 'countdown') {
      handleStartPause();
    }
  });
}

// === Service Worker ===
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(() => console.log('Service Worker registered'))
      .catch((err) => console.error('Service Worker registration failed:', err));
  });
}

// === Init ===
function init() {
  initializeAudioElement();
  loadSettings();

  [runSecondsEl, walkSecondsEl, bpmEl, goalLapsEl].forEach((el) => {
    el.addEventListener('change', saveSettings);
  });

  startPauseBtn.addEventListener('click', handleStartPause);
  resetBtn.addEventListener('click', handleReset);

  updateDisplay();
}

init();
