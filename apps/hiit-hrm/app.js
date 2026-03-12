const STORAGE_KEY = 'hiitHrmCoachSettingsV1';
const HEART_RATE_SERVICE = 'heart_rate';
const HEART_RATE_CHARACTERISTIC = 'heart_rate_measurement';
const BATTERY_SERVICE = 'battery_service';
const BATTERY_CHARACTERISTIC = 'battery_level';
const ACTIVE_STATES = ['countdown', 'warmup', 'sprint', 'recovery'];

const getEl = (id) => document.getElementById(id);

const maxHrEl = getEl('maxHr');
const targetPercentEl = getEl('targetPercent');
const recoveryPercentEl = getEl('recoveryPercent');
const countdownSecondsEl = getEl('countdownSeconds');
const warmupSecondsEl = getEl('warmupSeconds');
const roundsEl = getEl('rounds');
const minSprintSecondsEl = getEl('minSprintSeconds');
const maxSprintSecondsEl = getEl('maxSprintSeconds');
const targetHoldSecondsEl = getEl('targetHoldSeconds');
const minRecoverySecondsEl = getEl('minRecoverySeconds');
const warmupCadenceEl = getEl('warmupCadence');
const sprintCadenceEl = getEl('sprintCadence');
const urgentCueSecondsEl = getEl('urgentCueSeconds');
const voiceCuesEl = getEl('voiceCues');
const vibrationCuesEl = getEl('vibrationCues');
const connectBtn = getEl('connectBtn');
const installBtn = getEl('installBtn');
const startPauseBtn = getEl('startPauseBtn');
const resetBtn = getEl('resetBtn');
const disconnectBtn = getEl('disconnectBtn');
const phaseTitleEl = getEl('phaseTitle');
const sensorPillEl = getEl('sensorPill');
const timerCaptionEl = getEl('timerCaption');
const timerDisplayEl = getEl('timerDisplay');
const instructionTextEl = getEl('instructionText');
const commandCardEl = getEl('commandCard');
const cadenceCalloutEl = getEl('cadenceCallout');
const targetStatusEl = getEl('targetStatus');
const currentHrEl = getEl('currentHr');
const hrFreshnessEl = getEl('hrFreshness');
const roundStatusEl = getEl('roundStatus');
const roundMetaEl = getEl('roundMeta');
const zoneHoldStatusEl = getEl('zoneHoldStatus');
const zoneMetaEl = getEl('zoneMeta');
const recoveryStatusEl = getEl('recoveryStatus');
const recoveryMetaEl = getEl('recoveryMeta');
const connectionStatusEl = getEl('connectionStatus');
const deviceNameEl = getEl('deviceName');
const batteryStatusEl = getEl('batteryStatus');
const lastReadingAtEl = getEl('lastReadingAt');
const supportNoteEl = getEl('supportNote');
const metronomeEl = getEl('metronome');
const canvas = getEl('progressCanvas');
const ctx = canvas.getContext('2d');

let settings = {
  maxHr: 190,
  targetPercent: 88,
  recoveryPercent: 70,
  countdownSec: 5,
  warmupSec: 360,
  rounds: 6,
  minSprintSec: 20,
  maxSprintSec: 45,
  targetHoldSec: 12,
  minRecoverySec: 45,
  warmupCadence: 164,
  sprintCadence: 190,
  urgentCueSec: 8,
  voiceCues: true,
  vibrationCues: true
};

let audioCtx = null;
let wakeLock = null;
let deferredPrompt = null;
let sessionState = 'idle';
let resumeState = 'idle';
let pauseReason = '';
let phaseStartTime = 0;
let phaseElapsed = 0;
let totalPhaseDuration = 0;
let lastLoopTimestamp = 0;
let lastCountdownSecond = null;
let currentRound = 0;
let completedSprints = 0;
let zoneHoldSeconds = 0;
let recoveryStartHr = null;
let timerIntervalId = null;
let animationFrameId = null;
let metronomeTimerId = null;
let coachCueTimerId = null;
let beatCount = 0;
let coachCueIndex = 0;
let bluetoothDevice = null;
let gattServer = null;
let hrCharacteristic = null;
let batteryCharacteristic = null;
let isMockSensor = false;
let connectionState = 'disconnected';
let currentHr = null;
let hrUpdatedAt = 0;
let batteryLevel = null;

function clampInt(value, fallback, min, max) {
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

function getTargetHr() {
  return Math.round(settings.maxHr * (settings.targetPercent / 100));
}

function getRecoveryHr() {
  return Math.round(settings.maxHr * (settings.recoveryPercent / 100));
}

function getActiveState() {
  return sessionState === 'paused' ? resumeState : sessionState;
}

function hasLiveHeartRate() {
  return connectionState === 'connected' && Number.isFinite(currentHr) && (Date.now() - hrUpdatedAt) <= 8000;
}

function getSensorModeLabel() {
  if (!('bluetooth' in navigator)) {
    return 'Web Bluetooth unsupported';
  }

  if (connectionState === 'connecting') {
    return 'Connecting';
  }

  if (hasLiveHeartRate()) {
    return 'HR live';
  }

  if (connectionState === 'connected') {
    return 'Waiting for HR';
  }

  return 'Sensor offline';
}

function getSensorStatusType() {
  if (!('bluetooth' in navigator)) {
    return 'unsupported';
  }

  if (connectionState === 'connecting') {
    return 'connecting';
  }

  if (hasLiveHeartRate()) {
    return 'live';
  }

  if (connectionState === 'connected') {
    return 'waiting';
  }

  return 'offline';
}

async function createAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }

  if (audioCtx.state === 'suspended') {
    await audioCtx.resume();
  }
}

function playSound({
  freq,
  duration = 0.12,
  type = 'sine',
  pan = 0,
  volume = 0.16,
  finalGain = 0.001
}) {
  if (!audioCtx) {
    return false;
  }

  try {
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
    return true;
  } catch {
    return false;
  }
}

function playToneSequence(tones, delayMs = 120) {
  tones.forEach((tone, index) => {
    window.setTimeout(() => playSound(tone), index * delayMs);
  });
}

function speakCue(text) {
  if (!settings.voiceCues || !('speechSynthesis' in window) || document.visibilityState !== 'visible') {
    return;
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1.07;
  utterance.pitch = 0.88;
  utterance.volume = 0.9;
  window.speechSynthesis.speak(utterance);
}

function vibrateCue(pattern) {
  if (!settings.vibrationCues || typeof navigator.vibrate !== 'function') {
    return;
  }

  navigator.vibrate(pattern);
}

function requestWakeLock() {
  if (!('wakeLock' in navigator) || wakeLock) {
    return Promise.resolve();
  }

  return navigator.wakeLock.request('screen')
    .then((lock) => {
      wakeLock = lock;
      wakeLock.addEventListener('release', () => {
        wakeLock = null;
      });
    })
    .catch(() => {
      wakeLock = null;
    });
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
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2 * Math.min(progress, 1));
  ctx.lineWidth = 18;
  ctx.lineCap = 'round';
  ctx.strokeStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 18;
  ctx.stroke();
  ctx.shadowBlur = 0;
}

function getProgressColor() {
  const activeState = getActiveState();
  if (activeState === 'warmup') {
    return '#f7b955';
  }
  if (activeState === 'sprint') {
    return '#ff5d4d';
  }
  if (activeState === 'recovery') {
    return '#46d6a2';
  }
  if (activeState === 'countdown' || sessionState === 'completed') {
    return '#8fc6ff';
  }
  return 'rgba(255, 255, 255, 0.22)';
}

function getDisplayProgress() {
  const activeState = getActiveState();

  if (sessionState === 'completed') {
    return 1;
  }

  if (sessionState === 'idle') {
    return 0;
  }

  if (activeState === 'countdown' || activeState === 'warmup') {
    return totalPhaseDuration > 0 ? phaseElapsed / totalPhaseDuration : 0;
  }

  if (activeState === 'sprint') {
    return settings.maxSprintSec > 0 ? phaseElapsed / settings.maxSprintSec : 0;
  }

  if (activeState === 'recovery') {
    if (!hasLiveHeartRate()) {
      return Math.min(1, phaseElapsed / settings.minRecoverySec);
    }

    const startHr = Number.isFinite(recoveryStartHr) ? recoveryStartHr : getTargetHr();
    const spread = Math.max(1, startHr - getRecoveryHr());
    const rawProgress = (startHr - currentHr) / spread;
    return Math.min(1, Math.max(0, rawProgress));
  }

  return 0;
}

function getPhaseTitle() {
  const activeState = getActiveState();

  if (sessionState === 'paused') {
    return 'Paused';
  }

  if (activeState === 'countdown') {
    return 'Stand by';
  }

  if (activeState === 'warmup') {
    return 'Warm-up';
  }

  if (activeState === 'sprint') {
    return `Sprint ${currentRound}/${settings.rounds}`;
  }

  if (activeState === 'recovery') {
    return `Recover ${completedSprints}/${settings.rounds}`;
  }

  if (sessionState === 'completed') {
    return 'Complete';
  }

  return 'Ready';
}

function getTimerCaption() {
  const activeState = getActiveState();

  if (sessionState === 'paused') {
    return 'Session paused';
  }

  if (activeState === 'countdown') {
    return 'Countdown';
  }

  if (activeState === 'warmup') {
    return 'Warm-up remaining';
  }

  if (activeState === 'sprint') {
    return 'Work cap remaining';
  }

  if (activeState === 'recovery') {
    return 'Recovery elapsed';
  }

  if (sessionState === 'completed') {
    return 'Final';
  }

  return 'Warm-up';
}

function getTimerDisplayValue() {
  const activeState = getActiveState();

  if (sessionState === 'completed') {
    return 'DONE';
  }

  if (sessionState === 'idle') {
    return formatDuration(settings.warmupSec);
  }

  if (activeState === 'recovery') {
    return formatDuration(phaseElapsed);
  }

  const remaining = Math.max(0, totalPhaseDuration - phaseElapsed);
  return formatDuration(remaining);
}

function getInstructionText() {
  const activeState = getActiveState();
  const targetHr = getTargetHr();
  const recoveryHr = getRecoveryHr();

  if (sessionState === 'paused') {
    return pauseReason || 'Session paused.';
  }

  if (activeState === 'countdown') {
    return 'Stand ready. Warm-up run starts on the clock.';
  }

  if (activeState === 'warmup') {
    return `Settle into a smooth run and prepare for round 1. Warm-up cadence is ${settings.warmupCadence} SPM.`;
  }

  if (activeState === 'sprint') {
    if (!hasLiveHeartRate()) {
      return `Sprint hard now. Keep ${settings.sprintCadence} SPM while waiting for a fresh HR packet.`;
    }

    if (currentHr < targetHr) {
      return `Sprint now. Quick feet at ${settings.sprintCadence} SPM until you break ${targetHr} bpm.`;
    }

    const remainingHold = Math.max(0, settings.targetHoldSec - zoneHoldSeconds);
    return `Target zone reached. Hold the sprint for ${remainingHold.toFixed(1)} more seconds in-zone.`;
  }

  if (activeState === 'recovery') {
    if (!hasLiveHeartRate()) {
      return `Recover easy and re-establish the heart-rate feed. Next round waits for live HR below ${recoveryHr} bpm.`;
    }

    if (phaseElapsed < settings.minRecoverySec) {
      return `Recover easy. Hold off on the next round until ${Math.ceil(settings.minRecoverySec - phaseElapsed)} more seconds have passed.`;
    }

    if (currentHr > recoveryHr) {
      return `Keep recovering. Heart rate needs to fall below ${recoveryHr} bpm before the next sprint.`;
    }

    return 'Recovery gate is open. The next sprint will start immediately.';
  }

  if (sessionState === 'completed') {
    return 'Session complete. Recover, review the thresholds, and restart when ready.';
  }

  return 'Pair a Garmin-compatible BLE heart-rate monitor, then start the session.';
}

function getCadenceCallout() {
  const activeState = getActiveState();

  if (sessionState === 'completed') {
    return 'Session complete';
  }

  if (activeState === 'sprint') {
    return `Sprint at ${settings.sprintCadence} SPM`;
  }

  if (activeState === 'recovery') {
    return `Recover below ${getRecoveryHr()} bpm`;
  }

  return `Warm up at ${settings.warmupCadence} SPM`;
}

function getTargetStatus() {
  return `Hit ${getTargetHr()} bpm for ${settings.targetHoldSec}s, then recover below ${getRecoveryHr()} bpm for at least ${settings.minRecoverySec}s. Garmin BLE validates effort from HR; cadence is coached but not sensor-verified here.`;
}

function getRoundStatus() {
  if (sessionState === 'completed') {
    return `${settings.rounds} / ${settings.rounds}`;
  }

  if (['sprint', 'recovery'].includes(getActiveState())) {
    const roundNumber = getActiveState() === 'sprint' ? currentRound : completedSprints;
    return `${roundNumber} / ${settings.rounds}`;
  }

  return `0 / ${settings.rounds}`;
}

function getRoundMeta() {
  const activeState = getActiveState();

  if (sessionState === 'completed') {
    return 'All hard intervals completed';
  }

  if (activeState === 'warmup' || activeState === 'countdown') {
    return 'Warm-up before round 1';
  }

  if (activeState === 'sprint') {
    return `Round ${currentRound} is active`;
  }

  if (activeState === 'recovery') {
    return `Recovering after round ${completedSprints}`;
  }

  if (sessionState === 'paused') {
    return 'Resume to continue';
  }

  return 'Waiting to start';
}

function getZoneMeta() {
  const activeState = getActiveState();
  const targetHr = getTargetHr();

  if (sessionState === 'completed') {
    return 'Last interval satisfied';
  }

  if (activeState === 'sprint') {
    if (!hasLiveHeartRate()) {
      return 'Waiting for a live heart-rate packet';
    }

    if (currentHr >= targetHr) {
      return 'In target zone';
    }

    return `${targetHr - currentHr} bpm below target`;
  }

  if (activeState === 'recovery') {
    return 'Zone hold resets on the next sprint';
  }

  return `Need ${settings.targetHoldSec}s at ${targetHr}+ bpm`;
}

function getRecoveryMeta() {
  const activeState = getActiveState();

  if (sessionState === 'completed') {
    return 'Recovery can continue off-clock';
  }

  if (activeState === 'recovery') {
    const minimumRemaining = Math.max(0, Math.ceil(settings.minRecoverySec - phaseElapsed));

    if (!hasLiveHeartRate()) {
      return 'Live HR is required to reopen the next round';
    }

    if (minimumRemaining > 0) {
      return `${minimumRemaining}s minimum recovery still required`;
    }

    if (currentHr > getRecoveryHr()) {
      return `${currentHr - getRecoveryHr()} bpm above recovery threshold`;
    }

    return 'Recovery threshold achieved';
  }

  return `Minimum ${settings.minRecoverySec}s plus HR below threshold`;
}

function getHeartRateFreshnessLabel() {
  if (!Number.isFinite(currentHr) || hrUpdatedAt === 0) {
    return 'No live reading';
  }

  const ageSeconds = Math.max(0, Math.floor((Date.now() - hrUpdatedAt) / 1000));

  if (ageSeconds <= 1) {
    return 'Live now';
  }

  if (ageSeconds <= 8) {
    return `${ageSeconds}s ago`;
  }

  return `Stale (${ageSeconds}s old)`;
}

function updateConnectionUi() {
  const supportNote = 'bluetooth' in navigator
    ? 'Use a Chromium browser on Android or desktop. Garmin chest straps that expose the standard BLE heart-rate service can pair here. Garmin running dynamics require ANT+, so cadence is coached, not measured, in this web build.'
    : 'This browser does not expose Web Bluetooth. Use Chrome or Edge on Android or desktop to pair a Garmin BLE heart-rate strap.';

  sensorPillEl.dataset.status = getSensorStatusType();
  sensorPillEl.textContent = getSensorModeLabel();
  connectionStatusEl.textContent = connectionState === 'connected'
    ? (hasLiveHeartRate() ? 'Connected and streaming' : 'Connected, waiting for data')
    : connectionState === 'connecting'
      ? 'Connecting'
      : !('bluetooth' in navigator)
        ? 'Unsupported browser'
        : 'Disconnected';
  deviceNameEl.textContent = bluetoothDevice?.name || 'No sensor paired';
  batteryStatusEl.textContent = Number.isFinite(batteryLevel) ? `${batteryLevel}%` : 'Unknown';
  lastReadingAtEl.textContent = hrUpdatedAt === 0 ? 'None' : getHeartRateFreshnessLabel();
  supportNoteEl.textContent = supportNote;

  connectBtn.textContent = connectionState === 'connecting'
    ? 'Connecting...'
    : connectionState === 'connected'
      ? 'Pair another HRM'
      : 'Connect HRM';
  connectBtn.disabled = connectionState === 'connecting' || ACTIVE_STATES.includes(sessionState);
  disconnectBtn.disabled = connectionState !== 'connected' || ACTIVE_STATES.includes(sessionState);
}

function updateDisplay() {
  document.body.dataset.phase = getActiveState() === 'countdown' ? 'idle' : getActiveState();

  phaseTitleEl.textContent = getPhaseTitle();
  timerCaptionEl.textContent = getTimerCaption();
  timerDisplayEl.textContent = getTimerDisplayValue();
  instructionTextEl.textContent = getInstructionText();
  cadenceCalloutEl.textContent = getCadenceCallout();
  targetStatusEl.textContent = getTargetStatus();
  currentHrEl.textContent = Number.isFinite(currentHr) ? `${currentHr} bpm` : '--';
  hrFreshnessEl.textContent = getHeartRateFreshnessLabel();
  roundStatusEl.textContent = getRoundStatus();
  roundMetaEl.textContent = getRoundMeta();
  zoneHoldStatusEl.textContent = `${zoneHoldSeconds.toFixed(1)} / ${settings.targetHoldSec}s`;
  zoneMetaEl.textContent = getZoneMeta();
  recoveryStatusEl.textContent = `<= ${getRecoveryHr()} bpm`;
  recoveryMetaEl.textContent = getRecoveryMeta();

  commandCardEl.classList.toggle('is-alert', getActiveState() === 'sprint' && (!hasLiveHeartRate() || currentHr < getTargetHr()));
  commandCardEl.classList.toggle('is-locked', getActiveState() === 'sprint' && hasLiveHeartRate() && currentHr >= getTargetHr());

  drawProgress(getDisplayProgress(), getProgressColor());
  updateConnectionUi();
}

function loadSettingsFromUi() {
  settings.maxHr = clampInt(maxHrEl.value, 190, 120, 240);
  settings.targetPercent = clampInt(targetPercentEl.value, 88, 70, 98);
  settings.recoveryPercent = clampInt(recoveryPercentEl.value, 70, 50, 90);
  settings.countdownSec = clampInt(countdownSecondsEl.value, 5, 3, 15);
  settings.warmupSec = clampInt(warmupSecondsEl.value, 360, 60, 1800);
  settings.rounds = clampInt(roundsEl.value, 6, 1, 20);
  settings.minSprintSec = clampInt(minSprintSecondsEl.value, 20, 5, 120);
  settings.maxSprintSec = clampInt(maxSprintSecondsEl.value, 45, 10, 180);
  settings.targetHoldSec = clampInt(targetHoldSecondsEl.value, 12, 3, 60);
  settings.minRecoverySec = clampInt(minRecoverySecondsEl.value, 45, 10, 300);
  settings.warmupCadence = clampInt(warmupCadenceEl.value, 164, 120, 210);
  settings.sprintCadence = clampInt(sprintCadenceEl.value, 190, 150, 240);
  settings.urgentCueSec = clampInt(urgentCueSecondsEl.value, 8, 4, 20);
  settings.voiceCues = voiceCuesEl.checked;
  settings.vibrationCues = vibrationCuesEl.checked;

  if (settings.maxSprintSec < settings.minSprintSec) {
    settings.maxSprintSec = settings.minSprintSec;
  }

  if (settings.recoveryPercent >= settings.targetPercent) {
    settings.recoveryPercent = Math.max(50, settings.targetPercent - 10);
  }
}

function syncSettingsToUi() {
  maxHrEl.value = settings.maxHr;
  targetPercentEl.value = settings.targetPercent;
  recoveryPercentEl.value = settings.recoveryPercent;
  countdownSecondsEl.value = settings.countdownSec;
  warmupSecondsEl.value = settings.warmupSec;
  roundsEl.value = settings.rounds;
  minSprintSecondsEl.value = settings.minSprintSec;
  maxSprintSecondsEl.value = settings.maxSprintSec;
  targetHoldSecondsEl.value = settings.targetHoldSec;
  minRecoverySecondsEl.value = settings.minRecoverySec;
  warmupCadenceEl.value = settings.warmupCadence;
  sprintCadenceEl.value = settings.sprintCadence;
  urgentCueSecondsEl.value = settings.urgentCueSec;
  voiceCuesEl.checked = settings.voiceCues;
  vibrationCuesEl.checked = settings.vibrationCues;
}

function saveSettings() {
  loadSettingsFromUi();
  syncSettingsToUi();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  updateDisplay();
}

function loadSettings() {
  const savedValue = localStorage.getItem(STORAGE_KEY);

  if (!savedValue) {
    syncSettingsToUi();
    return;
  }

  try {
    settings = {
      ...settings,
      ...JSON.parse(savedValue)
    };
  } catch (error) {
    console.warn('Unable to parse saved HIIT settings', error);
  }

  syncSettingsToUi();
}

function setInputsDisabled(disabled) {
  [
    maxHrEl,
    targetPercentEl,
    recoveryPercentEl,
    countdownSecondsEl,
    warmupSecondsEl,
    roundsEl,
    minSprintSecondsEl,
    maxSprintSecondsEl,
    targetHoldSecondsEl,
    minRecoverySecondsEl,
    warmupCadenceEl,
    sprintCadenceEl,
    urgentCueSecondsEl,
    voiceCuesEl,
    vibrationCuesEl
  ].forEach((element) => {
    element.disabled = disabled;
  });
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

function stopCoachCueLoop() {
  if (coachCueTimerId) {
    clearTimeout(coachCueTimerId);
    coachCueTimerId = null;
  }
}

function pulseMetronome(phase) {
  metronomeEl.classList.add('active');
  metronomeEl.classList.toggle('warmup', phase === 'warmup');
  metronomeEl.classList.toggle('sprint', phase === 'sprint');
  window.setTimeout(() => {
    metronomeEl.classList.remove('active');
  }, 150);
}

function playCadenceBeat(phase) {
  const isLeftBeat = beatCount % 2 === 0;
  const tone = phase === 'warmup'
    ? {
      freq: isLeftBeat ? 690 : 640,
      duration: 0.11,
      type: 'triangle',
      pan: isLeftBeat ? -0.5 : 0.5,
      volume: 0.12
    }
    : {
      freq: isLeftBeat ? 1020 : 940,
      duration: 0.09,
      type: 'square',
      pan: isLeftBeat ? -0.65 : 0.65,
      volume: 0.17
    };

  playSound(tone);
  pulseMetronome(phase);
  beatCount += 1;
}

function stopMetronome() {
  if (metronomeTimerId) {
    clearTimeout(metronomeTimerId);
    metronomeTimerId = null;
  }
  metronomeEl.classList.remove('active', 'warmup', 'sprint');
}

function startMetronome(phase, startImmediately = false) {
  stopMetronome();

  if (!['warmup', 'sprint'].includes(phase)) {
    return;
  }

  const bpm = phase === 'warmup' ? settings.warmupCadence : settings.sprintCadence;
  const intervalMs = (60 / bpm) * 1000;

  const scheduleBeat = () => {
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

function playCountdownTick() {
  playSound({ freq: 620, duration: 0.08, type: 'triangle', volume: 0.13 });
}

function announceWarmup() {
  playToneSequence([
    { freq: 540, duration: 0.14, type: 'triangle', volume: 0.12 },
    { freq: 680, duration: 0.12, type: 'triangle', volume: 0.12 }
  ], 90);
  speakCue(`Warm up run. Relaxed rhythm. ${settings.warmupCadence} cadence.`);
  vibrateCue([90, 40, 90]);
}

function announceSprint() {
  playToneSequence([
    { freq: 880, duration: 0.09, type: 'square', volume: 0.16 },
    { freq: 1120, duration: 0.08, type: 'square', volume: 0.18 },
    { freq: 1320, duration: 0.08, type: 'square', volume: 0.18 }
  ], 75);
  speakCue(`Sprint now. Quick feet. ${settings.sprintCadence} cadence. Hit ${getTargetHr()} beats.`);
  vibrateCue([120, 40, 120, 40, 160]);
}

function announceRecovery() {
  playToneSequence([
    { freq: 760, duration: 0.12, type: 'triangle', volume: 0.13 },
    { freq: 520, duration: 0.14, type: 'triangle', volume: 0.12 }
  ], 95);
  speakCue(`Recover. Ease off until heart rate drops below ${getRecoveryHr()}.`);
  vibrateCue([80, 60, 80]);
}

function announceCompletion() {
  playToneSequence([
    { freq: 523.25, duration: 0.22, type: 'triangle', volume: 0.14 },
    { freq: 659.25, duration: 0.22, type: 'triangle', volume: 0.14 },
    { freq: 783.99, duration: 0.25, type: 'triangle', volume: 0.15 }
  ], 120);
  speakCue('HIIT session complete.');
  vibrateCue([180, 70, 180, 70, 220]);
}

function scheduleCoachCue() {
  stopCoachCueLoop();

  if (sessionState !== 'sprint') {
    return;
  }

  coachCueTimerId = window.setTimeout(() => {
    const cues = [
      `Drive the pace. ${settings.sprintCadence} cadence.`,
      `Quick feet. Stay tall. Hit ${getTargetHr()}.`,
      'Do not back off. Keep the sprint alive.',
      'Sharp turnover. Hold the effort.'
    ];

    const cue = cues[coachCueIndex % cues.length];
    coachCueIndex += 1;
    speakCue(cue);
    playToneSequence([
      { freq: 1180, duration: 0.06, type: 'square', volume: 0.14 },
      { freq: 980, duration: 0.06, type: 'square', volume: 0.12 }
    ], 70);
    scheduleCoachCue();
  }, settings.urgentCueSec * 1000);
}

function startPhase(nextState, duration = 0) {
  stopTimerLoop();
  stopMetronome();
  stopCoachCueLoop();

  sessionState = nextState;
  resumeState = nextState;
  pauseReason = '';
  totalPhaseDuration = duration;
  phaseElapsed = 0;
  phaseStartTime = performance.now();
  lastLoopTimestamp = phaseStartTime;
  lastCountdownSecond = null;
  beatCount = 0;

  if (nextState === 'countdown') {
    playCountdownTick();
    lastCountdownSecond = duration;
  } else if (nextState === 'warmup') {
    announceWarmup();
    startMetronome('warmup', true);
  } else if (nextState === 'sprint') {
    currentRound = completedSprints + 1;
    zoneHoldSeconds = 0;
    recoveryStartHr = null;
    coachCueIndex = 0;
    announceSprint();
    startMetronome('sprint', true);
    scheduleCoachCue();
  } else if (nextState === 'recovery') {
    completedSprints = currentRound;
    recoveryStartHr = Number.isFinite(currentHr) ? currentHr : getTargetHr();
    announceRecovery();
  }

  requestWakeLock();
  updateDisplay();
  startTimerLoop();
}

function pauseSession(reason = '') {
  if (!ACTIVE_STATES.includes(sessionState)) {
    return;
  }

  stopTimerLoop();
  stopMetronome();
  stopCoachCueLoop();
  resumeState = sessionState;
  sessionState = 'paused';
  pauseReason = reason;
  releaseWakeLock();
  startPauseBtn.textContent = 'Resume';
  updateDisplay();
}

function completeWorkout() {
  stopTimerLoop();
  stopMetronome();
  stopCoachCueLoop();
  releaseWakeLock();
  sessionState = 'completed';
  resumeState = 'completed';
  totalPhaseDuration = 0;
  phaseElapsed = 0;
  announceCompletion();
  startPauseBtn.textContent = 'Start again';
  setInputsDisabled(false);
  updateDisplay();
}

function endSprintPhase() {
  completedSprints = currentRound;

  if (completedSprints >= settings.rounds) {
    completeWorkout();
    return;
  }

  startPhase('recovery', 0);
}

function mainLoop(timestamp) {
  if (!ACTIVE_STATES.includes(sessionState)) {
    return;
  }

  const deltaSeconds = lastLoopTimestamp ? Math.max(0, (timestamp - lastLoopTimestamp) / 1000) : 0;
  lastLoopTimestamp = timestamp;
  phaseElapsed = Math.max(0, (timestamp - phaseStartTime) / 1000);

  if (sessionState === 'countdown') {
    const countdownSecond = Math.ceil(totalPhaseDuration - phaseElapsed);
    if (countdownSecond > 0 && countdownSecond !== lastCountdownSecond) {
      playCountdownTick();
      lastCountdownSecond = countdownSecond;
    }

    if (phaseElapsed >= totalPhaseDuration) {
      startPhase('warmup', settings.warmupSec);
      return;
    }
  }

  if (sessionState === 'warmup' && phaseElapsed >= settings.warmupSec) {
    startPhase('sprint', settings.maxSprintSec);
    return;
  }

  if (sessionState === 'sprint') {
    if (hasLiveHeartRate() && currentHr >= getTargetHr()) {
      zoneHoldSeconds = Math.min(settings.targetHoldSec, zoneHoldSeconds + deltaSeconds);
    }

    const minimumSprintMet = phaseElapsed >= settings.minSprintSec;
    const zoneHoldMet = zoneHoldSeconds >= settings.targetHoldSec;
    const maxSprintMet = phaseElapsed >= settings.maxSprintSec;

    if (maxSprintMet || (minimumSprintMet && zoneHoldMet)) {
      endSprintPhase();
      return;
    }
  }

  if (sessionState === 'recovery') {
    const minimumRecoveryMet = phaseElapsed >= settings.minRecoverySec;
    const hrRecovered = hasLiveHeartRate() && currentHr <= getRecoveryHr();

    if (minimumRecoveryMet && hrRecovered) {
      startPhase('sprint', settings.maxSprintSec);
      return;
    }
  }

  updateDisplay();

  if (document.visibilityState === 'visible') {
    animationFrameId = requestAnimationFrame(mainLoop);
  } else {
    animationFrameId = null;
  }
}

function parseHeartRateMeasurement(value) {
  const flags = value.getUint8(0);
  const heartRateIsUint16 = (flags & 0x01) !== 0;
  let offset = 1;
  const heartRate = heartRateIsUint16 ? value.getUint16(offset, true) : value.getUint8(offset);

  return { heartRate };
}

function applyHeartRateReading(value) {
  currentHr = Math.max(1, Math.round(value));
  hrUpdatedAt = Date.now();
  updateDisplay();
}

function handleHeartRateChanged(event) {
  const data = parseHeartRateMeasurement(event.target.value);
  applyHeartRateReading(data.heartRate);
}

async function fetchBatteryLevel() {
  if (!gattServer) {
    return;
  }

  try {
    const service = await gattServer.getPrimaryService(BATTERY_SERVICE);
    batteryCharacteristic = await service.getCharacteristic(BATTERY_CHARACTERISTIC);
    const value = await batteryCharacteristic.readValue();
    batteryLevel = value.getUint8(0);
  } catch {
    batteryLevel = null;
  }
}

function cleanupDeviceListeners() {
  if (hrCharacteristic) {
    hrCharacteristic.removeEventListener('characteristicvaluechanged', handleHeartRateChanged);
  }

  if (bluetoothDevice && !isMockSensor && typeof bluetoothDevice.removeEventListener === 'function') {
    bluetoothDevice.removeEventListener('gattserverdisconnected', handleDeviceDisconnected);
  }

  hrCharacteristic = null;
  batteryCharacteristic = null;
  gattServer = null;
}

function finalizeDisconnected(message = '') {
  cleanupDeviceListeners();
  bluetoothDevice = null;
  isMockSensor = false;
  connectionState = 'disconnected';
  currentHr = null;
  hrUpdatedAt = 0;
  batteryLevel = null;

  if (ACTIVE_STATES.includes(sessionState)) {
    pauseSession(message || 'Heart-rate monitor disconnected. Reconnect the strap, then resume.');
    return;
  }

  if (sessionState === 'paused' && message) {
    pauseReason = message;
  }

  updateDisplay();
}

function handleDeviceDisconnected() {
  finalizeDisconnected('Heart-rate monitor disconnected. Reconnect the strap, then resume.');
}

async function disconnectCurrentDevice({ silent = false } = {}) {
  if (bluetoothDevice?.gatt?.connected && !isMockSensor) {
    try {
      bluetoothDevice.gatt.disconnect();
    } catch {
      // Ignore disconnect failures.
    }
  }

  finalizeDisconnected(silent ? '' : 'Heart-rate monitor disconnected.');
}

async function connectHeartRateMonitor() {
  if (!('bluetooth' in navigator)) {
    window.alert('Web Bluetooth is not available in this browser. Use Chrome or Edge on Android or desktop.');
    return;
  }

  if (connectionState === 'connecting') {
    return;
  }

  try {
    connectionState = 'connecting';
    updateDisplay();
    await disconnectCurrentDevice({ silent: true });

    const device = await navigator.bluetooth.requestDevice({
      filters: [{ services: [HEART_RATE_SERVICE] }],
      optionalServices: [BATTERY_SERVICE]
    });

    if (!device) {
      connectionState = 'disconnected';
      updateDisplay();
      return;
    }

    bluetoothDevice = device;
    bluetoothDevice.addEventListener('gattserverdisconnected', handleDeviceDisconnected);
    gattServer = await bluetoothDevice.gatt.connect();
    const hrService = await gattServer.getPrimaryService(HEART_RATE_SERVICE);
    hrCharacteristic = await hrService.getCharacteristic(HEART_RATE_CHARACTERISTIC);
    hrCharacteristic.addEventListener('characteristicvaluechanged', handleHeartRateChanged);
    await hrCharacteristic.startNotifications();
    await fetchBatteryLevel();

    isMockSensor = false;
    connectionState = 'connected';
    updateDisplay();
  } catch (error) {
    connectionState = 'disconnected';
    cleanupDeviceListeners();
    bluetoothDevice = null;
    currentHr = null;
    hrUpdatedAt = 0;
    if (error?.name !== 'NotFoundError') {
      console.warn('Failed to connect to heart-rate monitor', error);
      window.alert('Unable to connect to the heart-rate monitor. Confirm the strap is awake and not already paired elsewhere.');
    }
    updateDisplay();
  }
}

function handleReset() {
  stopTimerLoop();
  stopMetronome();
  stopCoachCueLoop();
  releaseWakeLock();

  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }

  sessionState = 'idle';
  resumeState = 'idle';
  pauseReason = '';
  phaseStartTime = 0;
  phaseElapsed = 0;
  totalPhaseDuration = 0;
  lastLoopTimestamp = 0;
  lastCountdownSecond = null;
  currentRound = 0;
  completedSprints = 0;
  zoneHoldSeconds = 0;
  recoveryStartHr = null;
  beatCount = 0;
  coachCueIndex = 0;

  startPauseBtn.textContent = 'Start session';
  resetBtn.disabled = true;
  setInputsDisabled(false);
  updateDisplay();
}

async function handleStartPause() {
  try {
    await createAudioContext();
  } catch (error) {
    console.warn('Audio initialization failed', error);
  }

  if (sessionState === 'idle' || sessionState === 'completed') {
    if (!hasLiveHeartRate()) {
      window.alert('Connect a live Bluetooth heart-rate monitor and wait for a fresh reading before starting.');
      return;
    }

    loadSettingsFromUi();
    syncSettingsToUi();
    currentRound = 0;
    completedSprints = 0;
    zoneHoldSeconds = 0;
    recoveryStartHr = null;
    pauseReason = '';
    resetBtn.disabled = false;
    startPauseBtn.textContent = 'Pause';
    setInputsDisabled(true);
    startPhase('countdown', settings.countdownSec);
    return;
  }

  if (sessionState === 'paused') {
    if (!hasLiveHeartRate()) {
      window.alert('Reconnect the heart-rate monitor and wait for a live reading before resuming.');
      return;
    }

    sessionState = resumeState;
    pauseReason = '';
    phaseStartTime = performance.now() - (phaseElapsed * 1000);
    lastLoopTimestamp = performance.now();
    startPauseBtn.textContent = 'Pause';
    if (sessionState === 'warmup') {
      startMetronome('warmup', false);
    } else if (sessionState === 'sprint') {
      startMetronome('sprint', false);
      scheduleCoachCue();
    }
    requestWakeLock();
    updateDisplay();
    startTimerLoop();
    return;
  }

  if (ACTIVE_STATES.includes(sessionState)) {
    pauseSession('Session paused. Resume when ready.');
  }
}

function registerInstallPrompt() {
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
      window.alert('To install on iPhone or iPad, tap Share and choose "Add to Home Screen".');
    }
  });
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((error) => {
      console.warn('Service worker registration failed', error);
    });
  });
}

function registerVisibilityHandling() {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && ACTIVE_STATES.includes(sessionState)) {
      requestWakeLock();

      if (!timerIntervalId) {
        startTimerLoop();
      }

      if (sessionState === 'warmup') {
        startMetronome('warmup', false);
      } else if (sessionState === 'sprint') {
        startMetronome('sprint', false);
        scheduleCoachCue();
      }

      if (audioCtx?.state === 'suspended') {
        audioCtx.resume().catch(() => {});
      }
    }

    updateDisplay();
  });
}

function exposeDebugHooks() {
  // Debug hooks allow browser automation to simulate a BLE strap.
  window.__HIIT_DEBUG__ = {
    connectMockSensor(name = 'Mock Garmin HRM') {
      cleanupDeviceListeners();
      bluetoothDevice = { name };
      isMockSensor = true;
      connectionState = 'connected';
      batteryLevel = 84;
      applyHeartRateReading(118);
    },
    injectHeartRate(value) {
      connectionState = 'connected';
      if (!bluetoothDevice) {
        bluetoothDevice = { name: 'Mock Garmin HRM' };
        isMockSensor = true;
      }
      applyHeartRateReading(value);
    },
    getState() {
      return {
        sessionState,
        resumeState,
        currentRound,
        completedSprints,
        phaseElapsed,
        zoneHoldSeconds,
        currentHr,
        connectionState
      };
    }
  };
}

function init() {
  loadSettings();
  updateDisplay();
  registerInstallPrompt();
  registerServiceWorker();
  registerVisibilityHandling();
  exposeDebugHooks();

  [
    maxHrEl,
    targetPercentEl,
    recoveryPercentEl,
    countdownSecondsEl,
    warmupSecondsEl,
    roundsEl,
    minSprintSecondsEl,
    maxSprintSecondsEl,
    targetHoldSecondsEl,
    minRecoverySecondsEl,
    warmupCadenceEl,
    sprintCadenceEl,
    urgentCueSecondsEl,
    voiceCuesEl,
    vibrationCuesEl
  ].forEach((element) => {
    element.addEventListener('input', saveSettings);
    element.addEventListener('change', saveSettings);
  });

  connectBtn.addEventListener('click', connectHeartRateMonitor);
  disconnectBtn.addEventListener('click', () => disconnectCurrentDevice());
  startPauseBtn.addEventListener('click', handleStartPause);
  resetBtn.addEventListener('click', handleReset);
}

init();
