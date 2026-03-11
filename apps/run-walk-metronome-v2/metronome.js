const STORAGE_KEY = 'runWalkTimerSettingsV2';

const getEl = (id) => document.getElementById(id);
const runSecondsEl = getEl('runSeconds');
const walkSecondsEl = getEl('walkSeconds');
const runBpmEl = getEl('runBpm');
const walkBpmEl = getEl('walkBpm');
const goalLapsEl = getEl('goalLaps');
const countdownSecondsEl = getEl('countdownSeconds');
const voiceCuesEl = getEl('voiceCues');
const vibrationCuesEl = getEl('vibrationCues');
const startPauseBtn = getEl('startPauseBtn');
const resetBtn = getEl('resetBtn');
const phaseEl = getEl('phase');
const nextPhaseEl = getEl('nextPhase');
const timerEl = getEl('timer');
const currentCadenceEl = getEl('currentCadence');
const lapsEl = getEl('laps');
const sessionTotalEl = getEl('sessionTotal');
const elapsedEl = getEl('elapsed');
const lapDurationEl = getEl('lapDuration');
const metronomeEl = getEl('metronome');
const installBtn = getEl('installBtn');
const presetButtons = Array.from(document.querySelectorAll('.preset-chip'));
const canvas = getEl('progressCanvas');
const ctx = canvas.getContext('2d');

let audioCtx = null;
let state = 'idle';
let resumeState = 'idle';
let lapCount = 0;
let remaining = 0;
let phaseElapsed = 0;
let totalPhaseDuration = 0;
let phaseStartTime = 0;
let beatCount = 0;
let lastCountdownSecond = null;
let animationFrameId = null;
let timerIntervalId = null;
let metronomeTimerId = null;
let wakeLock = null;
let deferredPrompt = null;
let isMetronomeRunning = false;

let settings = {
  runSec: 120,
  walkSec: 60,
  runBpm: 170,
  walkBpm: 114,
  goalLaps: 3,
  countdownSec: 5,
  voiceCues: false,
  vibrationCues: true
};

function clampNumber(value, fallback, min, max) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, parsed));
}

function formatDuration(seconds) {
  const safeSeconds = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

function getWorkoutTotalSeconds() {
  return settings.goalLaps * (settings.runSec + settings.walkSec);
}

function getCadenceForPhase(phase) {
  return phase === 'walking' ? settings.walkBpm : settings.runBpm;
}

function getElapsedWorkoutSeconds() {
  const activeState = state === 'paused' ? resumeState : state;

  if (state === 'idle') {
    return 0;
  }

  if (state === 'completed') {
    return getWorkoutTotalSeconds();
  }

  if (activeState === 'countdown') {
    return 0;
  }

  const completedLapsOffset = lapCount * (settings.runSec + settings.walkSec);

  if (activeState === 'running') {
    return completedLapsOffset + phaseElapsed;
  }

  if (activeState === 'walking') {
    return completedLapsOffset + settings.runSec + phaseElapsed;
  }

  return 0;
}

function getCurrentLapDisplay() {
  const activeState = state === 'paused' ? resumeState : state;

  if (state === 'idle') {
    return 0;
  }

  if (state === 'completed') {
    return settings.goalLaps;
  }

  if (activeState === 'countdown' || activeState === 'running' || activeState === 'walking') {
    return Math.min(lapCount + 1, settings.goalLaps);
  }

  return lapCount;
}

function getNextPhaseLabel() {
  const activeState = state === 'paused' ? resumeState : state;

  if (activeState === 'idle' || activeState === 'countdown') {
    return 'Run';
  }

  if (activeState === 'running') {
    return 'Walk';
  }

  if (activeState === 'walking') {
    return lapCount + 1 >= settings.goalLaps ? 'Finish' : 'Run';
  }

  if (activeState === 'completed') {
    return 'Reset';
  }

  return 'Run';
}

function getPhaseColor() {
  const activeState = state === 'paused' ? resumeState : state;
  if (activeState === 'running') {
    return '#ff7a59';
  }
  if (activeState === 'walking') {
    return '#75d9b4';
  }
  if (activeState === 'countdown') {
    return '#ffe28a';
  }
  if (activeState === 'completed') {
    return '#ffe28a';
  }
  return 'rgba(255, 255, 255, 0.2)';
}

function getCadenceLabel() {
  const activeState = state === 'paused' ? resumeState : state;

  if (activeState === 'running') {
    return `${settings.runBpm} BPM`;
  }

  if (activeState === 'walking') {
    return `${settings.walkBpm} BPM`;
  }

  if (state === 'paused' && activeState === 'countdown') {
    return 'Countdown paused';
  }

  if (activeState === 'countdown') {
    return 'Starting up';
  }

  if (state === 'completed') {
    return 'Session complete';
  }

  return `Run ${settings.runBpm} / Walk ${settings.walkBpm}`;
}

function getTimerValue() {
  if (state === 'idle') {
    return settings.runSec;
  }

  if (state === 'completed') {
    return 0;
  }

  return remaining;
}

function getPhaseTitle() {
  const activeState = state === 'paused' ? resumeState : state;

  if (state === 'paused') {
    if (activeState === 'countdown') {
      return 'Countdown Paused';
    }
    return 'Paused';
  }

  if (activeState === 'countdown') {
    return 'Get Ready';
  }

  if (activeState === 'running') {
    return 'Run';
  }

  if (activeState === 'walking') {
    return 'Walk';
  }

  if (state === 'completed') {
    return 'Completed';
  }

  return 'Ready';
}

function drawProgress(progress, color) {
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const radius = centerX - 18;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.lineWidth = 18;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.stroke();

  if (progress <= 0) {
    return;
  }

  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2 * progress);
  ctx.lineWidth = 18;
  ctx.lineCap = 'round';
  ctx.strokeStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 16;
  ctx.stroke();
  ctx.shadowBlur = 0;
}

function updateDerivedStats() {
  sessionTotalEl.textContent = formatDuration(getWorkoutTotalSeconds());
  lapDurationEl.textContent = formatDuration(settings.runSec + settings.walkSec);
}

function syncPresetSelection() {
  presetButtons.forEach((button) => {
    const matches =
      Number.parseInt(button.dataset.run, 10) === settings.runSec &&
      Number.parseInt(button.dataset.walk, 10) === settings.walkSec &&
      Number.parseInt(button.dataset.laps, 10) === settings.goalLaps;

    button.classList.toggle('active', matches);
  });
}

function updateMetronomePhaseClass() {
  const activeState = state === 'paused' ? resumeState : state;
  metronomeEl.classList.remove('running', 'walking');

  if (activeState === 'running' || activeState === 'walking') {
    metronomeEl.classList.add(activeState);
  }
}

function updateDisplay() {
  const progress = totalPhaseDuration > 0 ? Math.min(1, phaseElapsed / totalPhaseDuration) : 0;

  updateDerivedStats();
  syncPresetSelection();
  updateMetronomePhaseClass();

  phaseEl.textContent = getPhaseTitle();
  nextPhaseEl.textContent = getNextPhaseLabel();
  timerEl.textContent = formatDuration(getTimerValue());
  currentCadenceEl.textContent = getCadenceLabel();
  lapsEl.textContent = `${getCurrentLapDisplay()} / ${settings.goalLaps}`;
  elapsedEl.textContent = formatDuration(getElapsedWorkoutSeconds());

  if (state === 'completed') {
    drawProgress(1, getPhaseColor());
  } else if (state === 'idle') {
    drawProgress(0, getPhaseColor());
  } else {
    drawProgress(progress, getPhaseColor());
  }
}

async function createAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }

  if (audioCtx.state === 'suspended') {
    await audioCtx.resume();
  }
}

function stopAnimationLoop() {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
}

function stopTimerLoop() {
  if (timerIntervalId) {
    clearInterval(timerIntervalId);
    timerIntervalId = null;
  }
  stopAnimationLoop();
}

function startTimerLoop() {
  stopTimerLoop();
  timerIntervalId = window.setInterval(() => {
    mainLoop(performance.now());
  }, 150);
  animationFrameId = requestAnimationFrame(mainLoop);
}

function stopMetronome() {
  isMetronomeRunning = false;

  if (metronomeTimerId) {
    clearTimeout(metronomeTimerId);
    metronomeTimerId = null;
  }
}

function startMetronome(phase, startImmediately = false) {
  stopMetronome();

  if (!['running', 'walking'].includes(phase)) {
    return;
  }

  const cadence = getCadenceForPhase(phase);
  const intervalMs = (60 / cadence) * 1000;

  isMetronomeRunning = true;

  const scheduleBeat = () => {
    if (!isMetronomeRunning) {
      return;
    }

    playCadenceBeat(phase);
    metronomeTimerId = window.setTimeout(scheduleBeat, intervalMs);
  };

  if (startImmediately) {
    scheduleBeat();
    return;
  }

  const elapsedWithinBeatMs = (phaseElapsed * 1000) % intervalMs;
  const delayMs = elapsedWithinBeatMs === 0 ? intervalMs : intervalMs - elapsedWithinBeatMs;
  metronomeTimerId = window.setTimeout(scheduleBeat, delayMs);
}

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
    // Ignore release failures.
  }

  wakeLock = null;
}

function updateMediaSessionState() {
  if (!('mediaSession' in navigator)) {
    return;
  }

  if (['countdown', 'running', 'walking'].includes(state)) {
    navigator.mediaSession.playbackState = 'playing';
  } else if (state === 'paused') {
    navigator.mediaSession.playbackState = 'paused';
  } else {
    navigator.mediaSession.playbackState = 'none';
  }
}

function playSound({
  freq,
  duration,
  type = 'sine',
  pan = 0,
  volume = 0.16,
  finalGain = 0.001
}) {
  if (!audioCtx) {
    return;
  }

  const oscillator = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  const panner = audioCtx.createStereoPanner ? audioCtx.createStereoPanner() : null;
  const now = audioCtx.currentTime;

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(freq, now);

  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(finalGain, now + duration);

  oscillator.connect(gain);

  if (panner) {
    panner.pan.setValueAtTime(pan, now);
    gain.connect(panner);
    panner.connect(audioCtx.destination);
  } else {
    gain.connect(audioCtx.destination);
  }

  oscillator.start(now);
  oscillator.stop(now + duration);
}

function pulseMetronome(phase) {
  updateMetronomePhaseClass();
  metronomeEl.classList.add('active');
  metronomeEl.classList.toggle('running', phase === 'running');
  metronomeEl.classList.toggle('walking', phase === 'walking');

  window.setTimeout(() => {
    metronomeEl.classList.remove('active');
  }, 160);
}

function playCadenceBeat(phase) {
  const isLeftBeat = beatCount % 2 === 0;

  if (phase === 'walking') {
    playSound({
      freq: isLeftBeat ? 540 : 500,
      duration: 0.12,
      type: 'triangle',
      pan: isLeftBeat ? -0.55 : 0.55,
      volume: 0.12
    });
  } else {
    playSound({
      freq: isLeftBeat ? 900 : 830,
      duration: 0.085,
      type: 'sine',
      pan: isLeftBeat ? -0.7 : 0.7,
      volume: 0.18
    });
  }

  pulseMetronome(phase);
  beatCount += 1;
}

function playCountdownTick() {
  playSound({ freq: 620, duration: 0.08, type: 'sine', volume: 0.13 });
}

function playPhaseChangeSound(targetState) {
  if (targetState === 'running') {
    playSound({ freq: 1040, duration: 0.12, type: 'triangle', volume: 0.16 });
    window.setTimeout(() => playSound({ freq: 1320, duration: 0.08, type: 'triangle', volume: 0.12 }), 80);
    return;
  }

  if (targetState === 'walking') {
    playSound({ freq: 720, duration: 0.12, type: 'triangle', volume: 0.13 });
    window.setTimeout(() => playSound({ freq: 520, duration: 0.11, type: 'triangle', volume: 0.11 }), 90);
  }
}

function playCompletedSound() {
  const tones = [523.25, 659.25, 783.99];
  tones.forEach((freq, index) => {
    window.setTimeout(() => {
      playSound({ freq, duration: 0.25, type: 'triangle', volume: 0.15 });
    }, index * 120);
  });
}

function speakCue(text) {
  if (!settings.voiceCues || document.visibilityState !== 'visible' || !('speechSynthesis' in window)) {
    return;
  }

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1.05;
  utterance.pitch = 0.95;
  utterance.volume = 0.8;
  window.speechSynthesis.speak(utterance);
}

function vibrateCue(pattern) {
  if (!settings.vibrationCues || typeof navigator.vibrate !== 'function') {
    return;
  }

  navigator.vibrate(pattern);
}

function announcePhaseStart(targetState) {
  if (targetState === 'running') {
    playPhaseChangeSound('running');
    speakCue('Run');
    vibrateCue([120, 40, 120]);
    return;
  }

  if (targetState === 'walking') {
    playPhaseChangeSound('walking');
    speakCue('Walk');
    vibrateCue([80, 50, 80]);
  }
}

function completeWorkout() {
  stopTimerLoop();
  stopMetronome();
  releaseWakeLock();
  state = 'completed';
  resumeState = 'completed';
  phaseElapsed = 0;
  totalPhaseDuration = 0;
  remaining = 0;
  playCompletedSound();
  speakCue('Workout complete');
  vibrateCue([180, 70, 180, 70, 180]);
  startPauseBtn.textContent = 'Start';
  setInputsDisabled(false);
  updateMediaSessionState();
  updateDisplay();
}

function handlePhaseEnd() {
  if (state === 'countdown') {
    startPhase('running', settings.runSec);
    return;
  }

  if (state === 'running') {
    startPhase('walking', settings.walkSec);
    return;
  }

  if (state === 'walking') {
    lapCount += 1;

    if (lapCount >= settings.goalLaps) {
      completeWorkout();
      return;
    }

    startPhase('running', settings.runSec);
  }
}

function mainLoop(timestamp) {
  if (!['countdown', 'running', 'walking'].includes(state)) {
    return;
  }

  phaseElapsed = Math.min(totalPhaseDuration, (timestamp - phaseStartTime) / 1000);
  remaining = Math.max(0, Math.ceil(totalPhaseDuration - phaseElapsed));

  if (state === 'countdown') {
    const countdownSecond = Math.ceil(totalPhaseDuration - phaseElapsed);
    if (countdownSecond > 0 && countdownSecond !== lastCountdownSecond) {
      playCountdownTick();
      lastCountdownSecond = countdownSecond;
    }
  }

  updateDisplay();

  if (phaseElapsed >= totalPhaseDuration) {
    handlePhaseEnd();
    return;
  }

  if (document.visibilityState === 'visible') {
    animationFrameId = requestAnimationFrame(mainLoop);
  } else {
    animationFrameId = null;
  }
}

function startPhase(nextState, duration) {
  stopTimerLoop();
  stopMetronome();
  state = nextState;
  resumeState = nextState;
  totalPhaseDuration = duration;
  phaseElapsed = 0;
  remaining = duration;
  phaseStartTime = performance.now();
  beatCount = 0;
  lastCountdownSecond = null;

  if (nextState === 'countdown') {
    playCountdownTick();
    lastCountdownSecond = duration;
  } else if (nextState === 'running' || nextState === 'walking') {
    announcePhaseStart(nextState);
    startMetronome(nextState, true);
  }

  requestWakeLock();
  updateMediaSessionState();
  updateDisplay();
  startTimerLoop();
}

function loadSettingsFromUI() {
  settings.runSec = clampNumber(runSecondsEl.value, 120, 1, 3600);
  settings.walkSec = clampNumber(walkSecondsEl.value, 60, 1, 3600);
  settings.runBpm = clampNumber(runBpmEl.value, 170, 60, 220);
  settings.walkBpm = clampNumber(walkBpmEl.value, 114, 60, 180);
  settings.goalLaps = clampNumber(goalLapsEl.value, 3, 1, 999);
  settings.countdownSec = clampNumber(countdownSecondsEl.value, 5, 3, 10);
  settings.voiceCues = voiceCuesEl.checked;
  settings.vibrationCues = vibrationCuesEl.checked;
}

function syncSettingsToUI() {
  runSecondsEl.value = settings.runSec;
  walkSecondsEl.value = settings.walkSec;
  runBpmEl.value = settings.runBpm;
  walkBpmEl.value = settings.walkBpm;
  goalLapsEl.value = settings.goalLaps;
  countdownSecondsEl.value = settings.countdownSec;
  voiceCuesEl.checked = settings.voiceCues;
  vibrationCuesEl.checked = settings.vibrationCues;
}

function saveSettings() {
  loadSettingsFromUI();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  updateDisplay();
}

function loadSettings() {
  const savedValue = localStorage.getItem(STORAGE_KEY);

  if (savedValue) {
    try {
      const parsed = JSON.parse(savedValue);
      settings = {
        ...settings,
        ...parsed
      };
    } catch (error) {
      console.warn('Unable to parse saved metronome settings', error);
    }
  }

  syncSettingsToUI();
}

function setInputsDisabled(disabled) {
  [
    runSecondsEl,
    walkSecondsEl,
    runBpmEl,
    walkBpmEl,
    goalLapsEl,
    countdownSecondsEl,
    voiceCuesEl,
    vibrationCuesEl
  ].forEach((input) => {
    input.disabled = disabled;
  });

  presetButtons.forEach((button) => {
    button.disabled = disabled;
  });
}

function applyPreset(button) {
  if (button.disabled) {
    return;
  }

  presetButtons.forEach((preset) => preset.classList.remove('active'));
  button.classList.add('active');

  runSecondsEl.value = button.dataset.run;
  walkSecondsEl.value = button.dataset.walk;
  goalLapsEl.value = button.dataset.laps;
  saveSettings();
}

function handleStartPause() {
  createAudioContext().then(() => {
    if (state === 'idle' || state === 'completed') {
      loadSettingsFromUI();
      lapCount = 0;
      resetBtn.disabled = false;
      startPauseBtn.textContent = 'Pause';
      setInputsDisabled(true);
      startPhase('countdown', settings.countdownSec);
      return;
    }

    if (state === 'paused') {
      state = resumeState;
      phaseStartTime = performance.now() - (phaseElapsed * 1000);
      startPauseBtn.textContent = 'Pause';
      startTimerLoop();
      if (state === 'running' || state === 'walking') {
        startMetronome(state, false);
      }
      requestWakeLock();
      updateMediaSessionState();
      updateDisplay();
      return;
    }

    if (['countdown', 'running', 'walking'].includes(state)) {
      stopTimerLoop();
      stopMetronome();
      resumeState = state;
      state = 'paused';
      releaseWakeLock();
      startPauseBtn.textContent = 'Resume';
      updateMediaSessionState();
      updateDisplay();
    }
  }).catch((error) => {
    console.warn('Audio initialization failed', error);
  });
}

function handleReset() {
  stopTimerLoop();
  stopMetronome();
  releaseWakeLock();
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }

  state = 'idle';
  resumeState = 'idle';
  lapCount = 0;
  remaining = 0;
  phaseElapsed = 0;
  totalPhaseDuration = 0;
  beatCount = 0;
  lastCountdownSecond = null;
  metronomeEl.classList.remove('active', 'running', 'walking');
  startPauseBtn.textContent = 'Start';
  resetBtn.disabled = true;
  setInputsDisabled(false);
  updateMediaSessionState();
  updateDisplay();
}

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredPrompt = event;
  installBtn.hidden = false;
});

installBtn.addEventListener('click', async () => {
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;

  if (deferredPrompt) {
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    installBtn.hidden = true;
    return;
  }

  if (isIOS && !isStandalone) {
    window.alert('To install this app on iPhone or iPad, tap Share and choose "Add to Home Screen".');
  }
});

if ('mediaSession' in navigator) {
  navigator.mediaSession.metadata = new MediaMetadata({
    title: 'Run/Walk Metronome V2',
    artist: 'Fitness App',
    album: 'Training Tools',
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
    if (['countdown', 'running', 'walking'].includes(state)) {
      handleStartPause();
    }
  });

  updateMediaSessionState();
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((error) => {
      console.warn('Service worker registration failed', error);
    });
  });
}

document.addEventListener('visibilitychange', () => {
  const sessionActive = ['countdown', 'running', 'walking'].includes(state);

  if (document.visibilityState === 'visible' && sessionActive) {
    requestWakeLock();

    if (!timerIntervalId) {
      startTimerLoop();
    }

    if ((state === 'running' || state === 'walking') && !isMetronomeRunning) {
      startMetronome(state, false);
    }

    if (audioCtx?.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }

    updateDisplay();
  }
});

function init() {
  loadSettings();
  updateDisplay();

  [
    runSecondsEl,
    walkSecondsEl,
    runBpmEl,
    walkBpmEl,
    goalLapsEl,
    countdownSecondsEl,
    voiceCuesEl,
    vibrationCuesEl
  ].forEach((element) => {
    element.addEventListener('change', saveSettings);
    element.addEventListener('input', saveSettings);
  });

  presetButtons.forEach((button) => {
    button.addEventListener('click', () => applyPreset(button));
  });

  startPauseBtn.addEventListener('click', handleStartPause);
  resetBtn.addEventListener('click', handleReset);
}

init();
