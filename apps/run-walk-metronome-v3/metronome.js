const {
  DEFAULT_SETTINGS,
  buildBeatPlan,
  getSessionAt,
  getSessionTotalSeconds,
  normalizeSettings
} = window.RunWalkTimerCore;

const STORAGE_KEY = 'runWalkTimerSettingsV3';
const LOOKAHEAD_SECONDS = 0.14;
const SCHEDULER_INTERVAL_MS = 25;

const els = {
  installBtn: document.getElementById('installBtn'),
  phaseCard: document.getElementById('phaseCard'),
  phaseLabel: document.getElementById('phaseLabel'),
  nextLabel: document.getElementById('nextLabel'),
  timerText: document.getElementById('timerText'),
  cadenceText: document.getElementById('cadenceText'),
  rhythmStatus: document.getElementById('rhythmStatus'),
  leftDot: document.getElementById('leftDot'),
  rightDot: document.getElementById('rightDot'),
  startPauseBtn: document.getElementById('startPauseBtn'),
  resetBtn: document.getElementById('resetBtn'),
  settingsForm: document.getElementById('settingsForm'),
  runSec: document.getElementById('runSec'),
  walkSec: document.getElementById('walkSec'),
  runBpm: document.getElementById('runBpm'),
  walkBpm: document.getElementById('walkBpm'),
  goalLaps: document.getElementById('goalLaps'),
  countdownSec: document.getElementById('countdownSec'),
  vibrationCues: document.getElementById('vibrationCues'),
  voiceCues: document.getElementById('voiceCues'),
  lapText: document.getElementById('lapText'),
  elapsedText: document.getElementById('elapsedText'),
  totalText: document.getElementById('totalText'),
  lapDurationText: document.getElementById('lapDurationText'),
  timeline: document.getElementById('timeline'),
  canvas: document.getElementById('progressCanvas')
};

const ctx = els.canvas.getContext('2d');

let audioCtx = null;
let schedulerTimerId = null;
let animationFrameId = null;
let wakeLock = null;
let deferredPrompt = null;
let state = 'idle';
let settings = loadSettings();
let beatPlan = buildBeatPlan(settings);
let sessionStartedAtMs = 0;
let pausedAtSeconds = 0;
let nextBeatIndex = 0;
let lastRenderedPhase = 'idle';
let lastCountdownSecond = null;

function formatDuration(seconds) {
  const safe = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(safe / 60);
  const remainder = safe % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

function loadSettings() {
  const saved = localStorage.getItem(STORAGE_KEY);

  if (saved) {
    try {
      return normalizeSettings(JSON.parse(saved));
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  return { ...DEFAULT_SETTINGS };
}

function saveSettings() {
  settings = normalizeSettings(readSettingsFromForm());
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  beatPlan = buildBeatPlan(settings);
  syncFormFromSettings();
  renderStaticState();
}

function readSettingsFromForm() {
  return {
    runSec: els.runSec.value,
    walkSec: els.walkSec.value,
    runBpm: els.runBpm.value,
    walkBpm: els.walkBpm.value,
    goalLaps: els.goalLaps.value,
    countdownSec: els.countdownSec.value
  };
}

function syncFormFromSettings() {
  els.runSec.value = settings.runSec;
  els.walkSec.value = settings.walkSec;
  els.runBpm.value = settings.runBpm;
  els.walkBpm.value = settings.walkBpm;
  els.goalLaps.value = settings.goalLaps;
  els.countdownSec.value = settings.countdownSec;
}

async function ensureAudio() {
  const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;

  if (!AudioContextConstructor) {
    return false;
  }

  if (!audioCtx) {
    audioCtx = new AudioContextConstructor();
  }

  if (audioCtx.state === 'suspended') {
    await audioCtx.resume();
  }

  return true;
}

function getElapsedSessionSeconds(nowMs = performance.now()) {
  if (state === 'idle') {
    return -1;
  }

  if (state === 'paused') {
    return pausedAtSeconds;
  }

  if (state === 'complete') {
    return getSessionTotalSeconds(settings);
  }

  return Math.max(0, (nowMs - sessionStartedAtMs) / 1000);
}

function startSession() {
  settings = normalizeSettings(readSettingsFromForm());
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  beatPlan = buildBeatPlan(settings);
  nextBeatIndex = 0;
  pausedAtSeconds = 0;
  lastCountdownSecond = null;
  lastRenderedPhase = 'idle';
  sessionStartedAtMs = performance.now();
  state = 'running';
  setInputsDisabled(true);
  els.startPauseBtn.textContent = 'Pause';
  els.resetBtn.disabled = false;
  requestWakeLock();
  startScheduler();
  startRenderLoop();
}

function pauseSession() {
  pausedAtSeconds = getElapsedSessionSeconds();
  state = 'paused';
  stopScheduler();
  stopRenderLoop();
  releaseWakeLock();
  els.startPauseBtn.textContent = 'Resume';
  render();
}

function resumeSession() {
  sessionStartedAtMs = performance.now() - pausedAtSeconds * 1000;
  state = 'running';
  els.startPauseBtn.textContent = 'Pause';
  requestWakeLock();
  startScheduler();
  startRenderLoop();
}

function resetSession() {
  stopScheduler();
  stopRenderLoop();
  releaseWakeLock();
  state = 'idle';
  pausedAtSeconds = 0;
  nextBeatIndex = 0;
  lastCountdownSecond = null;
  lastRenderedPhase = 'idle';
  els.startPauseBtn.textContent = 'Start';
  els.resetBtn.disabled = true;
  setInputsDisabled(false);
  clearStepDots();
  renderStaticState();
}

function completeSession() {
  state = 'complete';
  stopScheduler();
  stopRenderLoop();
  releaseWakeLock();
  setInputsDisabled(false);
  els.startPauseBtn.textContent = 'Start';
  els.resetBtn.disabled = false;
  playFinishSound(audioCtx?.currentTime ?? 0);
  vibrate([160, 60, 160, 60, 240]);
  speak('Session complete');
  render();
}

function startScheduler() {
  stopScheduler();
  schedulerTimerId = window.setInterval(scheduleDueBeats, SCHEDULER_INTERVAL_MS);
  scheduleDueBeats();
}

function stopScheduler() {
  if (schedulerTimerId) {
    clearInterval(schedulerTimerId);
    schedulerTimerId = null;
  }
}

function scheduleDueBeats() {
  if (!audioCtx || state !== 'running') {
    return;
  }

  const elapsed = getElapsedSessionSeconds();
  const audioNow = audioCtx.currentTime;
  const sessionNowAtAudioNow = elapsed;
  const windowEnd = sessionNowAtAudioNow + LOOKAHEAD_SECONDS;

  while (nextBeatIndex < beatPlan.length && beatPlan[nextBeatIndex].at <= elapsed - 0.02) {
    nextBeatIndex += 1;
  }

  while (nextBeatIndex < beatPlan.length && beatPlan[nextBeatIndex].at <= windowEnd) {
    const beat = beatPlan[nextBeatIndex];
    const when = audioNow + Math.max(0, beat.at - sessionNowAtAudioNow);
    playBeat(beat, when);
    window.setTimeout(() => flashStep(beat), Math.max(0, (when - audioNow) * 1000));
    nextBeatIndex += 1;
  }
}

function startRenderLoop() {
  stopRenderLoop();
  const frame = () => {
    render();

    if (state === 'running') {
      animationFrameId = requestAnimationFrame(frame);
    }
  };

  animationFrameId = requestAnimationFrame(frame);
}

function stopRenderLoop() {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
}

function renderStaticState() {
  const total = getSessionTotalSeconds(settings);
  els.phaseCard.dataset.phase = 'idle';
  els.phaseLabel.textContent = 'Ready';
  els.nextLabel.textContent = 'Run';
  els.timerText.textContent = formatDuration(settings.runSec);
  els.cadenceText.textContent = `Run ${settings.runBpm} / Walk ${settings.walkBpm}`;
  els.rhythmStatus.textContent = 'Audio clock standby';
  els.lapText.textContent = `0 / ${settings.goalLaps}`;
  els.elapsedText.textContent = '00:00';
  els.totalText.textContent = formatDuration(total);
  els.lapDurationText.textContent = formatDuration(settings.runSec + settings.walkSec);
  drawProgress(0, '#d1d5db');
  renderTimeline();
}

function render() {
  const elapsed = getElapsedSessionSeconds();
  const session = getSessionAt(settings, elapsed);

  if (session.phase === 'complete' && state === 'running') {
    completeSession();
    return;
  }

  announceChanges(session);
  els.phaseCard.dataset.phase = state === 'paused' ? 'paused' : session.phase;
  els.phaseLabel.textContent = getPhaseLabel(session.phase, state);
  els.nextLabel.textContent = titleCase(session.nextPhase);
  els.timerText.textContent = formatDuration(session.phaseRemaining);
  els.cadenceText.textContent = session.cadence ? `${session.cadence} BPM` : 'Starting soon';
  els.rhythmStatus.textContent = audioCtx ? 'Audio clock scheduling ahead' : 'Visual timer only';
  els.lapText.textContent = `${session.lap} / ${settings.goalLaps}`;
  els.elapsedText.textContent = formatDuration(session.elapsedWorkoutSeconds);
  els.totalText.textContent = formatDuration(session.totalSeconds);
  drawProgress(session.progress, getPhaseColor(session.phase));
  updateTimeline(session);
}

function announceChanges(session) {
  if (state !== 'running') {
    return;
  }

  if (session.phase === 'countdown') {
    const second = Math.ceil(session.phaseRemaining);
    if (second > 0 && second !== lastCountdownSecond) {
      playTick(audioCtx.currentTime, 'countdown');
      lastCountdownSecond = second;
    }
  }

  if (session.phase !== lastRenderedPhase) {
    if (session.phase === 'run') {
      playPhaseCue('run');
      speak('Run');
      vibrate([120, 40, 120]);
    } else if (session.phase === 'walk') {
      playPhaseCue('walk');
      speak('Walk');
      vibrate([90, 60, 90]);
    }
    lastRenderedPhase = session.phase;
  }
}

function playBeat(beat, when) {
  if (!audioCtx) {
    return;
  }

  const isRun = beat.phase === 'run';
  const oscillator = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  const panner = audioCtx.createStereoPanner ? audioCtx.createStereoPanner() : null;
  const peak = beat.accent ? 0.32 : 0.22;
  const frequency = isRun
    ? (beat.step === 'left' ? 940 : 860)
    : (beat.step === 'left' ? 560 : 510);

  oscillator.type = isRun ? 'sine' : 'triangle';
  oscillator.frequency.setValueAtTime(frequency, when);
  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.linearRampToValueAtTime(peak, when + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + (isRun ? 0.075 : 0.12));

  oscillator.connect(gain);

  if (panner) {
    panner.pan.setValueAtTime(beat.step === 'left' ? -0.45 : 0.45, when);
    gain.connect(panner);
    panner.connect(audioCtx.destination);
  } else {
    gain.connect(audioCtx.destination);
  }

  oscillator.start(when);
  oscillator.stop(when + 0.14);
}

function playTick(when, type = 'countdown') {
  if (!audioCtx) {
    return;
  }

  const oscillator = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  oscillator.type = 'square';
  oscillator.frequency.setValueAtTime(type === 'countdown' ? 680 : 760, when);
  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.linearRampToValueAtTime(0.16, when + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.08);
  oscillator.connect(gain).connect(audioCtx.destination);
  oscillator.start(when);
  oscillator.stop(when + 0.1);
}

function playPhaseCue(phase) {
  if (!audioCtx) {
    return;
  }

  const now = audioCtx.currentTime;
  const tones = phase === 'run' ? [960, 1280] : [720, 520];
  tones.forEach((freq, index) => {
    const at = now + index * 0.09;
    const oscillator = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(freq, at);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.linearRampToValueAtTime(0.18, at + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.11);
    oscillator.connect(gain).connect(audioCtx.destination);
    oscillator.start(at);
    oscillator.stop(at + 0.13);
  });
}

function playFinishSound(when) {
  if (!audioCtx) {
    return;
  }

  [523.25, 659.25, 783.99].forEach((freq, index) => {
    const at = when + index * 0.12;
    const oscillator = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(freq, at);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.linearRampToValueAtTime(0.2, at + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.22);
    oscillator.connect(gain).connect(audioCtx.destination);
    oscillator.start(at);
    oscillator.stop(at + 0.25);
  });
}

function flashStep(beat) {
  clearStepDots();
  const target = beat.step === 'left' ? els.leftDot : els.rightDot;
  target.classList.add('active');
  target.dataset.phase = beat.phase;
}

function clearStepDots() {
  els.leftDot.classList.remove('active');
  els.rightDot.classList.remove('active');
}

function drawProgress(progress, color) {
  const size = els.canvas.width;
  const center = size / 2;
  const radius = center - 18;
  ctx.clearRect(0, 0, size, size);
  ctx.lineWidth = 18;
  ctx.lineCap = 'round';

  ctx.beginPath();
  ctx.arc(center, center, radius, 0, Math.PI * 2);
  ctx.strokeStyle = '#e5e7eb';
  ctx.stroke();

  if (progress <= 0) {
    return;
  }

  ctx.beginPath();
  ctx.arc(center, center, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
  ctx.strokeStyle = color;
  ctx.stroke();
}

function renderTimeline() {
  els.timeline.replaceChildren();

  for (let index = 0; index < settings.goalLaps; index += 1) {
    const run = document.createElement('span');
    run.className = 'timeline-segment run';
    run.style.flexGrow = settings.runSec;
    run.title = `Lap ${index + 1} run`;

    const walk = document.createElement('span');
    walk.className = 'timeline-segment walk';
    walk.style.flexGrow = settings.walkSec;
    walk.title = `Lap ${index + 1} walk`;

    els.timeline.append(run, walk);
  }
}

function updateTimeline(session) {
  const workoutProgress = session.elapsedWorkoutSeconds / (settings.goalLaps * (settings.runSec + settings.walkSec));
  els.timeline.style.setProperty('--progress', `${Math.max(0, Math.min(1, workoutProgress)) * 100}%`);
}

function setInputsDisabled(disabled) {
  for (const element of els.settingsForm.elements) {
    element.disabled = disabled;
  }
  document.querySelectorAll('[data-preset]').forEach((button) => {
    button.disabled = disabled;
  });
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

function speak(text) {
  if (!els.voiceCues.checked || document.visibilityState !== 'visible' || !('speechSynthesis' in window)) {
    return;
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1.02;
  utterance.volume = 0.75;
  window.speechSynthesis.speak(utterance);
}

function vibrate(pattern) {
  if (els.vibrationCues.checked && typeof navigator.vibrate === 'function') {
    navigator.vibrate(pattern);
  }
}

function titleCase(value) {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function getPhaseLabel(phase, appState) {
  if (appState === 'paused') {
    return 'Paused';
  }
  if (phase === 'countdown') {
    return 'Get ready';
  }
  if (phase === 'run') {
    return 'Run';
  }
  if (phase === 'walk') {
    return 'Walk';
  }
  if (phase === 'complete') {
    return 'Complete';
  }
  return 'Ready';
}

function getPhaseColor(phase) {
  if (phase === 'run') {
    return '#f97316';
  }
  if (phase === 'walk') {
    return '#14b8a6';
  }
  if (phase === 'countdown') {
    return '#facc15';
  }
  if (phase === 'complete') {
    return '#22c55e';
  }
  return '#d1d5db';
}

function handleStartPause() {
  ensureAudio().then(() => {
    if (state === 'idle' || state === 'complete') {
      startSession();
    } else if (state === 'paused') {
      resumeSession();
    } else {
      pauseSession();
    }
  }).catch((error) => {
    console.warn('Audio initialisation failed; starting visual timer only', error);
    if (state === 'idle' || state === 'complete') {
      startSession();
    } else if (state === 'paused') {
      resumeSession();
    } else {
      pauseSession();
    }
  });
}

function handlePreset(event) {
  const button = event.target.closest('[data-preset]');
  if (!button || button.disabled) {
    return;
  }

  els.runSec.value = button.dataset.run;
  els.walkSec.value = button.dataset.walk;
  els.goalLaps.value = button.dataset.laps;
  saveSettings();
}

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredPrompt = event;
  els.installBtn.hidden = false;
});

els.installBtn.addEventListener('click', async () => {
  if (!deferredPrompt) {
    return;
  }

  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  els.installBtn.hidden = true;
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && state === 'running') {
    requestWakeLock();
    if (audioCtx?.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    render();
  }
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((error) => {
      console.warn('Service worker registration failed', error);
    });
  });
}

document.querySelector('.presets').addEventListener('click', handlePreset);
els.settingsForm.addEventListener('input', saveSettings);
els.settingsForm.addEventListener('change', saveSettings);
els.startPauseBtn.addEventListener('click', handleStartPause);
els.resetBtn.addEventListener('click', resetSession);

syncFormFromSettings();
renderStaticState();
document.documentElement.dataset.runWalkV3Ready = 'true';
