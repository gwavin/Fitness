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

// === State Management ===
let state = 'idle'; // idle, countdown, running, walking, paused, completed
let currentPhase = 'running'; // running, walking
let lapCount = 0;
let remaining = 0;
let phaseStartTime = 0;
let totalPhaseDuration = 0;
let nextBeepTime = 0;
let beatCount = 0;
let animationFrameId = null;
let warningBeepsPlayed = [false, false, false]; // Tracks beeps at 3, 2, 1 seconds

// === User Settings ===
let settings = {
  runSec: 120,
  walkSec: 60,
  bpm: 170,
  goalLaps: 3
};

// === Audio Context ===
let audioCtx = null;
const createAudioContext = () => {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
};

// === Audio Functions ===
function playSound({ freq, duration, type = 'sine', pan = 0, finalGain = 0.001 }) {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  const panner = audioCtx.createStereoPanner ? audioCtx.createStereoPanner() : null;

  osc.type = type;
  osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
  gain.gain.setValueAtTime(0.5, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(finalGain, audioCtx.currentTime + duration);
  
  osc.connect(gain);
  if (panner) {
    panner.pan.setValueAtTime(pan, audioCtx.currentTime);
    gain.connect(panner);
    panner.connect(audioCtx.destination);
  } else {
    gain.connect(audioCtx.destination);
  }

  osc.start(audioCtx.currentTime);
  osc.stop(audioCtx.currentTime + duration);
}

const playCadenceBeep = () => {
  const isLeft = beatCount % 2 === 0;
  playSound({ freq: isLeft ? 880 : 800, duration: 0.1, pan: isLeft ? -0.7 : 0.7 });
  metronomeEl.classList.add('active');
  setTimeout(() => metronomeEl.classList.remove('active'), 200);
  beatCount++;
};

const playPhaseChangeSound = () => playSound({ freq: 1200, duration: 0.2, type: 'triangle' });
const playCountdownSound = () => playSound({ freq: 600, duration: 0.15, type: 'sine' });
const playWarningBeep = () => playSound({ freq: 1000, duration: 0.12, type: 'square' });
const playCompletedSound = () => {
  const freqs = [523.25, 659.25, 783.99]; // C5, E5, G5
  freqs.forEach((freq, i) => {
    setTimeout(() => playSound({ freq, duration: 0.3, type: 'triangle' }), i * 150);
  });
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
  
  if (state === 'running') {
    const beepInterval = 60 / settings.bpm;
    if (elapsed >= nextBeepTime) {
      playCadenceBeep();
      nextBeepTime += beepInterval;
    }
  } else if (state === 'walking' && remaining <= 3 && remaining > 0) {
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
    nextBeepTime = 0;
  } else if (phase === 'walking') {
    currentPhase = 'walking';
  }
  
  animationFrameId = requestAnimationFrame(mainLoop);
}

function handlePhaseEnd() {
  playPhaseChangeSound();
  if (state === 'countdown') {
    startPhase('running', settings.runSec);
  } else if (state === 'running') {
    startPhase('walking', settings.walkSec);
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
  playCompletedSound();
  startPauseBtn.textContent = 'Start';
  setInputsDisabled(false);
  updateDisplay();
}

// === Event Handlers & Control Flow ===
function handleStartPause() {
  createAudioContext();
  
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
    startPauseBtn.textContent = 'Pause';
  } else {
    // Pausing
    state = 'paused';
    cancelAnimationFrame(animationFrameId);
    startPauseBtn.textContent = 'Resume';
    updateDisplay();
  }
}

function handleReset() {
  cancelAnimationFrame(animationFrameId);
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
const installBtn = getEl('installBtn');

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
      const outcome = await deferredPrompt.userChoice;
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
    title: 'Fitness Metronome',
    artist: 'Fitness App',
    album: 'Training Tools',
    artwork: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' }
    ]
  });
}

// === Service Worker Registration ===
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(err => console.warn('SW reg failed', err));
  });
}

// === Initial Setup ===
function init() {
  loadSettings();
  [runSecondsEl, walkSecondsEl, bpmEl, goalLapsEl].forEach(el => {
    el.addEventListener('change', saveSettings);
  });
  startPauseBtn.addEventListener('click', handleStartPause);
  resetBtn.addEventListener('click', handleReset);
  updateDisplay();
}

init();