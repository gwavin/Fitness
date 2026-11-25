import { buildPilotReport, classifyCandidate, createDetector, isResolved, isWorking, nextSetIndex, restCue, restTarget, saveBoundary } from './pilot.mjs';

export function createPilot({ active, save, refresh, audit, checkpoint, formatClock, escape }) {
  const detector = createDetector();
  let contextKey = '';
  let lastActionAt = -Infinity;

  function reset() {
    lastActionAt = Date.now();
    detector.reset();
  }

  function onSample(id, sample) {
    const context = active();
    if (!context || context.session.id !== id) return;
    const candidate = detector.push(sample);
    if (!candidate) return;
    const { session, exercise, seconds } = context;
    const index = classifyCandidate(exercise, candidate, lastActionAt);
    const set = exercise.sets[index];
    const actionable = set && !set.completedAt && !set.pilotSet;
    session.pilotEvents ??= [];
    session.pilotEvents.push({ ...candidate, exerciseId: exercise.id, setIndex: actionable ? index : null });
    if (actionable) {
      saveBoundary(exercise, index, { startAt: readStart(set) ?? candidate.startCandidateAt,
        endAt: candidate.endCandidateAt, observedAt: candidate.detectedAt, source: 'hr',
        targetSeconds: restTarget(exercise, seconds) });
      audit(session, 'hr-set-suggested', { exerciseId: exercise.id, setIndex: index, candidate });
    }
    save();
    if (actionable) refresh();
  }

  const readStart = set => set.startedAt ? Date.parse(set.startedAt) : null;

  function action(context, index, command) {
    const { session, exercise, seconds } = context;
    if (session.status !== 'in_progress') return false;
    const set = exercise.sets[index];
    if (!set) return false;
    if (command === 'complete' && (!set.load.trim() || !set.reps.trim())) return false;
    if (command === 'start' && (isResolved(set) || set.startedAt)) return false;
    const now = Date.now();
    const before = structuredClone(set);
    switch (command) {
      case 'start':
        set.startedAt = new Date(now).toISOString();
        if (isWorking(set)) exercise.pilotWorking = true;
        break;
      case 'complete':
        if (set.pilotSet?.source === 'hr') set.completedAt = new Date(set.pilotSet.endAt).toISOString();
        else saveBoundary(exercise, index, { startAt: readStart(set), endAt: now, source: 'tap',
          targetSeconds: restTarget(exercise, seconds) });
        set.skipped = false;
        exercise.skipped = false;
        checkpoint();
        break;
      case 'undo':
      case 'skip':
        set.completedAt = null;
        set.skipped = command === 'skip';
        delete set.startedAt;
        delete set.pilotSet;
        break;
      default: return false;
    }
    audit(session, 'set-' + command, { exerciseId: exercise.id, setIndex: index, before });
    reset();
    save();
    return true;
  }

  function mount({ session, exercise, seconds }, { next, render }, element) {
    if (session.status !== 'in_progress') return;
    const key = session.id + ':' + session.activeIndex;
    if (contextKey !== key) { contextKey = key; reset(); }
    const index = nextSetIndex(exercise);
    const set = exercise.sets[index];
    const nextWorking = exercise.sets.findIndex(item => isWorking(item) && !isResolved(item));
    const pending = exercise.sets.findLastIndex((item, i) => (index < 0 || i < index) &&
      item.pilotSet?.source === 'hr' && !item.completedAt && !item.skipped);
    element.innerHTML = `
      <div class="pilot-face" data-state="waiting">
        <p class="pilot-kicker" id="pilot-state" role="status"></p>
        <h2>${set ? escape(set.label.split(/ [—–-] /)[0]) : 'Exercise complete'}</h2>
        <p class="pilot-load">${set ? [set.load, set.reps].filter(Boolean).map(escape).join(' × ') : ''}</p>
        <output class="pilot-count" id="pilot-count" role="timer" aria-label="Rest remaining" hidden></output>
      </div>
      <div class="pilot-controls">
        ${set ? '<button class="primary large" id="pilot-done">Set done</button><button id="pilot-start">Mark start</button><button id="pilot-skip">Skip set</button>' : '<button class="primary large" id="pilot-next">Next / review</button>'}
        ${nextWorking >= 0 && !exercise.pilotWorking && !exercise.skipped ? '<button id="pilot-work">Begin working sets</button>' : ''}
        ${pending >= 0 ? '<button id="pilot-confirm">Confirm suggested set</button><button id="pilot-reject">Undo suggested set</button>' : ''}
      </div>
      ${pending >= 0 ? '<p class="pilot-note">Garmin suggested ' + escape(exercise.sets[pending].label) + '. Check the load and reps below before confirming if they changed.</p>' : ''}`;
    const context = { session, exercise, seconds };
    const bind = (id, callback) => element.querySelector('#' + id)?.addEventListener('click', callback);
    const run = (i, command) => {
      if (!action(context, i, command)) {
        const status = element.querySelector('#pilot-state');
        status.textContent = command === 'complete' ? 'Enter load and reps below first' : 'Start already marked';
        return;
      }
      render();
    };
    bind('pilot-done', () => run(index, 'complete'));
    bind('pilot-start', () => run(index, 'start'));
    bind('pilot-skip', () => run(index, 'skip'));
    bind('pilot-confirm', () => run(pending, 'complete'));
    bind('pilot-reject', () => run(pending, 'undo'));
    bind('pilot-next', next);
    bind('pilot-work', () => {
      // Leave missed warm-ups available for manual correction in the set list.
      exercise.pilotWorking = true;
      audit(session, 'working-phase-marked', { exerciseId: exercise.id, setIndex: nextWorking });
      reset(); save(); render();
    });
    draw(exercise, element);
  }

  function draw(exercise, element, now = Date.now()) {
    if (!element?.firstElementChild) return;
    const pending = nextSetIndex(exercise);
    const rest = restCue(exercise, now);
    const face = element.firstElementChild;
    const mode = rest ? rest.ready ? 'ready' : 'rest' : 'waiting';
    // Redraws from logging or backgrounding must not replay a green flash.
    const transition = face.dataset.state === 'rest' && mode === 'ready';
    face.dataset.state = mode;
    if (transition) face.classList.add('ready-flash');
    const word = rest ? rest.ready ? 'Go when ready' : 'Recovering'
      : pending < 0 ? 'Move on when ready' : isWorking(exercise.sets[pending]) ? 'Working set' : 'Follow the plan';
    const state = element.querySelector('#pilot-state');
    if (state.textContent !== word) state.textContent = word;
    const count = element.querySelector('#pilot-count');
    count.hidden = mode !== 'rest';
    if (!count.hidden) count.textContent = formatClock(rest.remaining);
  }
  return { onSample, mount, draw, reset, action };
}

export function recoveryReview(session, samples, escape) {
  const { rests } = buildPilotReport(session, samples);
  if (!rests.length) return '';
  return `<details class="card"><summary>Rest timing experiment (${rests.length})</summary>
    <p>The live cue uses the rest timer. The experimental estimate uses Garmin data available at each decision.</p>
    <ul>${rests.map(row => {
      const guess = row.experimentalGreenAt === null ? 'No estimate' : 'HR estimate at ' + Math.round((row.experimentalGreenAt - row.endAt) / 1000) + ' s';
      const fortyFive = row.bpmAt45 === null ? 'no usable reading at 45 s' : row.bpmAt45 + ' bpm at 45 s';
      const start = row.secondsFrom45ToNextStart === null ? 'next start unmarked' :
        'next start at ' + (row.secondsFrom45ToNextStart + 45) + ' s (' + (row.nextStartSource === 'hr' ? 'estimated' : 'tap') + ')';
      return '<li>' + escape(row.lift + ' · ' + row.label + ' · ' + guess + ' · ' + fortyFive + ' · ' + start) + '</li>';
    }).join('')}</ul></details>`;
}
