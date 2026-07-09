(function exposeTimerCore(global) {
  const DEFAULT_SETTINGS = Object.freeze({
    runSec: 120,
    walkSec: 60,
    runBpm: 170,
    walkBpm: 114,
    goalLaps: 3,
    countdownSec: 5
  });

  const LIMITS = Object.freeze({
    runSec: [1, 3600],
    walkSec: [1, 3600],
    runBpm: [60, 220],
    walkBpm: [50, 180],
    goalLaps: [1, 999],
    countdownSec: [0, 15]
  });

  function normalizeSettings(raw = {}) {
    return Object.fromEntries(
      Object.entries(DEFAULT_SETTINGS).map(([key, fallback]) => {
        const [min, max] = LIMITS[key];
        return [key, clampInteger(raw[key], fallback, min, max)];
      })
    );
  }

  function getSessionTotalSeconds(settings) {
    const safe = normalizeSettings(settings);
    return safe.countdownSec + safe.goalLaps * (safe.runSec + safe.walkSec);
  }

  function getSessionAt(settings, elapsedSeconds) {
    const safe = normalizeSettings(settings);
    const elapsed = Number.isFinite(elapsedSeconds) ? elapsedSeconds : 0;

    if (elapsed < 0) {
      return idleState(safe);
    }

    if (safe.countdownSec > 0 && elapsed < safe.countdownSec) {
      return phaseState({
        phase: 'countdown',
        elapsed,
        phaseStart: 0,
        duration: safe.countdownSec,
        lap: 0,
        completedWorkoutSeconds: 0,
        settings: safe
      });
    }

    const workoutElapsed = elapsed - safe.countdownSec;
    const lapDuration = safe.runSec + safe.walkSec;
    const totalWorkout = safe.goalLaps * lapDuration;

    if (workoutElapsed >= totalWorkout) {
      return {
        phase: 'complete',
        lap: safe.goalLaps,
        phaseElapsed: 0,
        phaseRemaining: 0,
        elapsedWorkoutSeconds: totalWorkout,
        totalSeconds: getSessionTotalSeconds(safe),
        progress: 1,
        nextPhase: 'reset',
        settings: safe
      };
    }

    const lapIndex = Math.floor(workoutElapsed / lapDuration);
    const withinLap = workoutElapsed - lapIndex * lapDuration;

    if (withinLap < safe.runSec) {
      return phaseState({
        phase: 'run',
        elapsed: withinLap,
        phaseStart: 0,
        duration: safe.runSec,
        lap: lapIndex + 1,
        completedWorkoutSeconds: lapIndex * lapDuration,
        settings: safe
      });
    }

    return phaseState({
      phase: 'walk',
      elapsed: withinLap,
      phaseStart: safe.runSec,
      duration: safe.walkSec,
      lap: lapIndex + 1,
      completedWorkoutSeconds: lapIndex * lapDuration + safe.runSec,
      settings: safe
    });
  }

  function buildBeatPlan(settings) {
    const safe = normalizeSettings(settings);
    const beats = [];
    let phaseStart = safe.countdownSec;

    for (let lapIndex = 0; lapIndex < safe.goalLaps; lapIndex += 1) {
      appendPhaseBeats(beats, {
        phase: 'run',
        start: phaseStart,
        duration: safe.runSec,
        bpm: safe.runBpm
      });
      phaseStart += safe.runSec;

      appendPhaseBeats(beats, {
        phase: 'walk',
        start: phaseStart,
        duration: safe.walkSec,
        bpm: safe.walkBpm
      });
      phaseStart += safe.walkSec;
    }

    return beats;
  }

  function appendPhaseBeats(beats, { phase, start, duration, bpm }) {
    const interval = 60 / bpm;
    const count = Math.floor((duration + 1e-9) / interval);

    for (let index = 0; index < count; index += 1) {
      beats.push({
        phase,
        at: roundTime(start + index * interval),
        phaseAt: roundTime(index * interval),
        step: index % 2 === 0 ? 'left' : 'right',
        accent: index % 4 === 0
      });
    }
  }

  function phaseState({ phase, elapsed, phaseStart, duration, lap, completedWorkoutSeconds, settings }) {
    const phaseElapsed = Math.max(0, elapsed - phaseStart);
    const phaseRemaining = Math.max(0, duration - phaseElapsed);
    const totalWorkout = settings.goalLaps * (settings.runSec + settings.walkSec);
    const elapsedWorkoutSeconds = phase === 'countdown'
      ? 0
      : Math.max(0, Math.min(totalWorkout, completedWorkoutSeconds + phaseElapsed));

    return {
      phase,
      lap,
      phaseElapsed,
      phaseRemaining,
      elapsedWorkoutSeconds,
      totalSeconds: getSessionTotalSeconds(settings),
      progress: duration > 0 ? Math.min(1, phaseElapsed / duration) : 1,
      nextPhase: getNextPhase(phase, lap, settings),
      cadence: getCadence(phase, settings),
      settings
    };
  }

  function getNextPhase(phase, lap, settings) {
    if (phase === 'countdown') {
      return 'run';
    }
    if (phase === 'run') {
      return 'walk';
    }
    if (phase === 'walk') {
      return lap >= settings.goalLaps ? 'finish' : 'run';
    }
    return 'run';
  }

  function getCadence(phase, settings) {
    if (phase === 'run') {
      return settings.runBpm;
    }
    if (phase === 'walk') {
      return settings.walkBpm;
    }
    return null;
  }

  function idleState(settings) {
    return {
      phase: 'idle',
      lap: 0,
      phaseElapsed: 0,
      phaseRemaining: settings.runSec,
      elapsedWorkoutSeconds: 0,
      totalSeconds: getSessionTotalSeconds(settings),
      progress: 0,
      nextPhase: 'run',
      cadence: settings.runBpm,
      settings
    };
  }

  function clampInteger(value, fallback, min, max) {
    const parsed = Number.parseInt(value, 10);

    if (!Number.isFinite(parsed) || parsed < min) {
      return fallback;
    }

    return Math.min(max, parsed);
  }

  function roundTime(value) {
    return Math.round(value * 1000000) / 1000000;
  }

  global.RunWalkTimerCore = {
    DEFAULT_SETTINGS,
    buildBeatPlan,
    getSessionAt,
    getSessionTotalSeconds,
    normalizeSettings
  };
})(window);
