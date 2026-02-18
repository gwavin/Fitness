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

// === State Management ===
let state = 'idle'; // idle, countdown, running, walking, paused, completed
let currentPhase = 'running'; // running, walking
let lapCount = 0;
let remaining = 0;
let phaseStartTime = 0;
let totalPhaseDuration = 0;
let beatCount = 0;
let animationFrameId = null;
let warningBeepsPlayed = [false, false, false]; // Tracks beeps at 3, 2, 1 seconds
let wakeLock = null;

// === User Settings ===
let settings = {
  runSec: 120,
  walkSec: 60,
  bpm: 170,
  goalLaps: 3
};

// === Audio Playback ===
let isMetronomeRunning = false;

function createBeepDataUrl() {
  const sampleRate = 22050;
  const durationSec = 0.18;
  const frequency = 900;
  const sampleCount = Math.floor(sampleRate * durationSec);
  const pcm = new Int16Array(sampleCount);

  for (let i = 0; i < sampleCount; i++) {
    const t = i / sampleRate;
    let envelope = 1;
    if (t < 0.008) {
      envelope = t / 0.008;
    } else if (t > durationSec - 0.03) {
      envelope = Math.max(0, (durationSec - t) / 0.03);
    }

    pcm[i] = Math.floor(32767 * 0.45 * envelope * Math.sin(2 * Math.PI * frequency * t));
// === Audio Context / HTML Audio ===
let audioCtx = null;
let beepAudio = null;

const createAudioContext = () => {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
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

function initAudioEngines() {
  if (!beepAudio) {
    beepAudio = new Audio(createBeepDataUrl());
    beepAudio.preload = 'auto';
    beepAudio.volume = 1;
    beepAudio.playsInline = true;
  }
  createAudioContext();
}

function playBeepAudio() {
  if (!beepAudio) {
    return false;
  }

  try {
    beepAudio.currentTime = 0;
    const playPromise = beepAudio.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {});
    }
    return true;
  } catch (err) {
    return false;
  }
}

// === Screen Wake Lock (prevents display sleeping during active sessions) ===
async function requestWakeLock() {
  if (!('wakeLock' in navigator) || wakeLock) {
    return;
  }

  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }

  return `data:audio/wav;base64,${btoa(binary)}`;
}
let metronomeTimerId = null;
let metronomeStopTimerId = null;

function initializeAudioElement() {
  if (!beepEl) {
    return;
  }

  beepEl.src = beepEl.src || createBeepDataUrl();
  beepEl.preload = 'auto';
  beepEl.playsInline = true;
  beepEl.volume = 1;
}

function playBeep() {
  if (!beepEl) {
    return;
  }

  beepEl.currentTime = 0;
  beepEl.play().catch(() => {});
}

function startMetronome(bpm, durationSeconds) {
  stopMetronome();
  const intervalMs = (60 / bpm) * 1000;
  isMetronomeRunning = true;

  function scheduleBeep() {
    if (!isMetronomeRunning) {
      return;
    }

    playBeep();
    metronomeEl.classList.add('active');
    setTimeout(() => metronomeEl.classList.remove('active'), 200);
    beatCount++;
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

const playCadenceBeep = () => {
  playBeep();
};

const playPhaseChangeSound = () => playBeep();
const playCountdownSound = () => playBeep();
const playWarningBeep = () => playBeep();
  const isLeft = beatCount % 2 === 0;
  const usedAudio = playBeepAudio();
  if (!usedAudio) {
    playSound({ freq: isLeft ? 880 : 800, duration: 0.1, pan: isLeft ? -0.7 : 0.7 });
  }
  metronomeEl.classList.add('active');
  setTimeout(() => metronomeEl.classList.remove('active'), 200);
  beatCount++;
};

const playPhaseChangeSound = () => playBeepAudio() || playSound({ freq: 1200, duration: 0.2, type: 'triangle' });
const playCountdownSound = () => playBeepAudio() || playSound({ freq: 600, duration: 0.15, type: 'sine' });
const playWarningBeep = () => playBeepAudio() || playSound({ freq: 1000, duration: 0.12, type: 'square' });
const playCompletedSound = () => {
  playBeep();
  setTimeout(playBeep, 160);
  setTimeout(playBeep, 320);
};

// === Canvas Drawing ===
function drawProgress(progress, color) {
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const radius = centerX - 12;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Background circle
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.lineWidth = 14;
  ctx.stroke();

  // Progress arc
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI * progress);
  ctx.strokeStyle = color;
  ctx.lineWidth = 14;
  ctx.lineCap = 'round';
  ctx.stroke();
}

// === UI Update Functions ===
const updateDisplay = () => {
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
  } else { // idle
    phaseEl.textContent = 'Ready';
    timerEl.textContent = settings.runSec;
    phaseColor = 'rgba(255, 255, 255, 0.3)';
    drawProgress(0, phaseColor);
  }

  if (state !== 'completed' && state !== 'idle') {
    drawProgress(progress, phaseColor);
  }
};

const setInputsDisabled = (disabled) => {
  runSecondsEl.disabled = disabled;
  walkSecondsEl.disabled = disabled;
  bpmEl.disabled = disabled;
  goalLapsEl.disabled = disabled;
};

// === Timer Logic ===
function mainLoop(timestamp) {
  if (state !== 'running' && state !== 'walking' && state !== 'countdown') return;

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
  warningBeepsPlayed = [false, false, false]; // Reset warning beeps for new phase
  
  if (phase === 'running') {
    currentPhase = 'running';
    beatCount = 0;
    startMetronome(settings.bpm, duration);
  } else if (phase === 'walking') {
    stopMetronome();
    currentPhase = 'walking';
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
  cancelAnimationFrame(animationFrameId);
  stopMetronome();
  releaseWakeLock();
  playCompletedSound();
  notifyPhaseChange('Workout complete', `Finished ${settings.goalLaps} laps`);
  startPauseBtn.textContent = 'Start';
  setInputsDisabled(false);
  updateDisplay();
}

// === Event Handlers & Control Flow ===
function handleStartPause() {
  initializeAudioElement();
  requestNotificationPermissionIfNeeded();
  
  if (state === 'idle' || state === 'completed') {
    loadSettingsFromUI();
    lapCount = 0;
    state = 'countdown';
    startPhase('countdown', 3);
    playCountdownSound(); // Initial sound
    setTimeout(playCountdownSound, 1000); // 2
    setTimeout(playCountdownSound, 2000); // 1
    
    startPauseBtn.textContent = 'Pause';
    resetBtn.disabled = false;
    setInputsDisabled(true);
  } else if (state === 'paused') {
    // Resuming
    state = currentPhase;
    phaseStartTime = performance.now() - ((totalPhaseDuration - remaining) * 1000);
    animationFrameId = requestAnimationFrame(mainLoop);
    requestWakeLock();
    if (currentPhase === 'running') {
      startMetronome(settings.bpm, remaining);
    }
    startPauseBtn.textContent = 'Pause';
  } else {
    // Pausing
    state = 'paused';
    cancelAnimationFrame(animationFrameId);
    stopMetronome();
    releaseWakeLock();
    startPauseBtn.textContent = 'Resume';
    updateDisplay();
  }
}

function handleReset() {
  cancelAnimationFrame(animationFrameId);
  stopMetronome();
  releaseWakeLock();
  state = 'idle';
  currentPhase = 'running';
  lapCount = 0;
  remaining = 0;
  warningBeepsPlayed = [false, false, false];
  startPauseBtn.textContent = 'Start';
  resetBtn.disabled = true;
  setInputsDisabled(false);
  updateDisplay();
}

// Re-acquire wake lock when returning to visible tab while timer is active
document.addEventListener('visibilitychange', () => {
  const sessionActive = state === 'running' || state === 'walking' || state === 'countdown';
  if (document.visibilityState === 'visible' && sessionActive) {
    requestWakeLock();
    if (currentPhase === 'running' && !isMetronomeRunning) {
      startMetronome(settings.bpm, remaining);
    if (audioCtx?.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    if (beepAudio && beepAudio.paused) {
      beepAudio.play().then(() => beepAudio.pause()).catch(() => {});
    }
  }
});

// === Settings Persistence ===
function saveSettings() {
  loadSettingsFromUI();
  localStorage.setItem('runWalkTimerSettings', JSON.stringify(settings));
}

function loadSettingsFromUI() {
  settings.runSec = parseInt(runSecondsEl.value, 10);
  settings.walkSec = parseInt(walkSecondsEl.value, 10);
  settings.bpm = parseInt(bpmEl.value, 10);
  settings.goalLaps = parseInt(goalLapsEl.value, 10);
}

function loadSettings() {
  const saved = localStorage.getItem('runWalkTimerSettings');
  if (saved) {
    settings = JSON.parse(saved);
  }
  runSecondsEl.value = settings.runSec;
  walkSecondsEl.value = settings.walkSec;
  bpmEl.value = settings.bpm;
  goalLapsEl.value = settings.goalLaps;
}

// === PWA Install Functionality ===
let deferredPrompt;
const installBtn = getEl('installButton');

// iOS Detection
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
      if (outcome === 'accepted') {
        console.log('PWA installed!');
      }
      deferredPrompt = null;
      installBtn.style.display = 'none';
    } else if (isIOS && !isStandalone) {
      // Show iOS instructions
      alert('To install this app on iOS:\n1. Tap the Share button\n2. Select "Add to Home Screen"\n3. Tap "Add"');
    }
  });
  
  // Show install button for iOS users who haven't installed yet
  if (isIOS && !isStandalone) {
    installBtn.style.display = 'block';
    installBtn.textContent = '📱 Add to Home Screen';
  }
}

// Media Session API for better media handling
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

// === Service Worker Registration ===
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(() => console.log('Service Worker registered'))
      .catch(err => console.error('Service Worker registration failed:', err));
  });
}

// === Initial Setup ===
function init() {
  initializeAudioElement();
  loadSettings();
  [runSecondsEl, walkSecondsEl, bpmEl, goalLapsEl].forEach(el => {
    el.addEventListener('change', saveSettings);
  });
  startPauseBtn.addEventListener('click', handleStartPause);
  resetBtn.addEventListener('click', handleReset);
  updateDisplay();
}

init();
