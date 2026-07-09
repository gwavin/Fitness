import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildBeatPlan,
  getSessionAt,
  normalizeSettings
} from './timer-core.mjs';

test('normalizes settings into safe running values', () => {
  assert.deepEqual(
    normalizeSettings({
      runSec: '120',
      walkSec: '60',
      runBpm: '170',
      walkBpm: '114',
      goalLaps: '3',
      countdownSec: '5'
    }),
    {
      runSec: 120,
      walkSec: 60,
      runBpm: 170,
      walkBpm: 114,
      goalLaps: 3,
      countdownSec: 5
    }
  );

  assert.equal(normalizeSettings({ runSec: '-5' }).runSec, 120);
  assert.equal(normalizeSettings({ runBpm: '999' }).runBpm, 220);
});

test('reports phase state from absolute elapsed time without accumulating drift', () => {
  const settings = normalizeSettings({
    runSec: 10,
    walkSec: 5,
    goalLaps: 2,
    countdownSec: 3
  });

  assert.equal(getSessionAt(settings, -0.5).phase, 'idle');
  assert.deepEqual(
    pick(getSessionAt(settings, 0)),
    { phase: 'countdown', lap: 0, phaseElapsed: 0, phaseRemaining: 3 }
  );
  assert.deepEqual(
    pick(getSessionAt(settings, 3.25)),
    { phase: 'run', lap: 1, phaseElapsed: 0.25, phaseRemaining: 9.75 }
  );
  assert.deepEqual(
    pick(getSessionAt(settings, 13.1)),
    { phase: 'walk', lap: 1, phaseElapsed: 0.1, phaseRemaining: 4.9 }
  );
  assert.deepEqual(
    pick(getSessionAt(settings, 18.5)),
    { phase: 'run', lap: 2, phaseElapsed: 0.5, phaseRemaining: 9.5 }
  );
  assert.equal(getSessionAt(settings, 33.01).phase, 'complete');
});

test('does not count countdown time as workout elapsed time', () => {
  const settings = normalizeSettings({
    runSec: 10,
    walkSec: 5,
    goalLaps: 1,
    countdownSec: 5
  });

  assert.equal(getSessionAt(settings, 4.5).phase, 'countdown');
  assert.equal(getSessionAt(settings, 4.5).elapsedWorkoutSeconds, 0);
});

test('builds beat times from absolute phase anchors instead of recursive intervals', () => {
  const settings = normalizeSettings({
    runSec: 3,
    walkSec: 2,
    runBpm: 120,
    walkBpm: 60,
    goalLaps: 1,
    countdownSec: 0
  });

  const beats = buildBeatPlan(settings);

  assert.deepEqual(
    beats.map(({ phase, at, step }) => ({ phase, at, step })),
    [
      { phase: 'run', at: 0, step: 'left' },
      { phase: 'run', at: 0.5, step: 'right' },
      { phase: 'run', at: 1, step: 'left' },
      { phase: 'run', at: 1.5, step: 'right' },
      { phase: 'run', at: 2, step: 'left' },
      { phase: 'run', at: 2.5, step: 'right' },
      { phase: 'walk', at: 3, step: 'left' },
      { phase: 'walk', at: 4, step: 'right' }
    ]
  );
});

function pick(state) {
  return {
    phase: state.phase,
    lap: state.lap,
    phaseElapsed: round2(state.phaseElapsed),
    phaseRemaining: round2(state.phaseRemaining)
  };
}

function round2(value) {
  return Math.round(value * 100) / 100;
}
