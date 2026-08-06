(function () {
  "use strict";

  const workout = window.CURRENT_WORKOUT;
  const app = document.querySelector("#app");
  const restDock = document.querySelector("#rest-dock");
  const restDisplay = document.querySelector("#rest-display");
  const restToggle = document.querySelector("#rest-toggle");
  const restMinus = document.querySelector("#rest-minus");
  const restPlus = document.querySelector("#rest-plus");

  if (!workout || !Array.isArray(workout.steps)) {
    app.innerHTML = '<section class="card panel"><h1>Workout unavailable</h1><p>The daily workout definition could not be loaded.</p></section>';
    return;
  }

  const STORAGE_KEY = "fitness-coaching-runner-v1";
  const MAX_SESSIONS = 30;
  const localDate = () => {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offset).toISOString().slice(0, 10);
  };
  const formatDate = (value) => new Intl.DateTimeFormat("en-IE", {
    weekday: "long", day: "numeric", month: "long", year: "numeric"
  }).format(new Date(`${value}T12:00:00`));
  const formatClock = (seconds) => {
    const safe = Math.max(0, Math.round(seconds));
    return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
  };
  const escapeText = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);

  function loadDb() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      return {
        schemaVersion: 1,
        sessions: Array.isArray(parsed.sessions) ? parsed.sessions : []
      };
    } catch {
      return { schemaVersion: 1, sessions: [] };
    }
  }

  let db = loadDb();
  let session = db.sessions.find((item) => item.workoutId === workout.id && !item.completedAt) || null;
  let activeStepIndex = session?.activeStepIndex || 0;
  let workoutTicker;
  let restTicker;
  let restSeconds = 60;
  let restRunning = false;
  let restEndAt = 0;
  let mediaRecorder;
  let mediaStream;
  let audioChunks = [];
  let audioUrl = "";

  function saveDb(statusText) {
    if (session) {
      const index = db.sessions.findIndex((item) => item.id === session.id);
      if (index >= 0) db.sessions[index] = session;
      else db.sessions.unshift(session);
    }
    db.sessions = db.sessions.slice(0, MAX_SESSIONS);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
      const status = document.querySelector("#save-status");
      if (status && statusText) status.textContent = statusText;
    } catch {
      const status = document.querySelector("#save-status");
      if (status) status.textContent = "Could not save locally. Copy your recap before leaving.";
    }
  }

  function newSession() {
    const now = new Date().toISOString();
    return {
      id: `${workout.id}-${now}`,
      workoutId: workout.id,
      workoutDate: workout.publishedFor || localDate(),
      startedAt: now,
      completedAt: "",
      activeStepIndex: 0,
      readiness: { energy: "", back: "", shoulder: "", neck: "", ankle: "", notes: "" },
      exerciseLogs: {},
      outcome: {
        back: "", shoulder: "", neck: "", ankle: "", sessionRpe: "", apprehension: "", painOrTechniqueChange: "", reflection: "", whatFeltStrong: "", whatLimitedSession: "", changeForNextTime: "", nextMorning: ""
      }
    };
  }

  function latestCompletedComparable() {
    return db.sessions.find((item) => item.workoutId === workout.id && item.completedAt);
  }

  function renderLanding() {
    clearInterval(workoutTicker);
    restDock.hidden = true;
    const today = localDate();
    const stale = workout.publishedFor && workout.publishedFor !== today;
    const recent = db.sessions.filter((item) => item.completedAt).slice(0, 3);

    app.innerHTML = `
      <section class="hero">
        <p class="eyebrow">Today’s workout · ${escapeText(formatDate(workout.publishedFor || today))}</p>
        <h1>${escapeText(workout.title)}</h1>
        <p class="hero__purpose">${escapeText(workout.purpose)}</p>
        <p class="hero__meta">${workout.durationMinutes} minutes · ${escapeText(workout.targetEffort)}</p>
        ${stale ? `<div class="stale-banner">This workout was prepared for ${escapeText(formatDate(workout.publishedFor))}, not today. Continue only if that is intentional.</div>` : ""}
      </section>

      <section class="card panel">
        <h2>Turn up. I’ll guide the rest.</h2>
        <p class="coach-note"><strong>Coach’s note:</strong> ${escapeText(workout.coachNote)}</p>
        <details class="safety-details">
          <summary>Stop and safety guidance</summary>
          <p>${escapeText(workout.safetySummary)} Seek appropriate clinical assessment for severe, persistent or recurrent symptoms.</p>
        </details>

        <h3>Before you begin</h3>
        <div class="form-grid" id="readiness-form">
          <label class="field"><span>Energy, 1–5</span><input id="energy" type="number" min="1" max="5" inputmode="numeric" value="${escapeText(session?.readiness?.energy)}"></label>
          <label class="field"><span>Back, 0–10</span><input id="back-before" type="number" min="0" max="10" inputmode="numeric" value="${escapeText(session?.readiness?.back)}"></label>
          <label class="field"><span>Shoulder, 0–10</span><input id="shoulder-before" type="number" min="0" max="10" inputmode="numeric" value="${escapeText(session?.readiness?.shoulder)}"></label>
          <label class="field"><span>Neck, 0–10</span><input id="neck-before" type="number" min="0" max="10" inputmode="numeric" value="${escapeText(session?.readiness?.neck)}"></label>
          <label class="field"><span>Ankle, 0–10</span><input id="ankle-before" type="number" min="0" max="10" inputmode="numeric" value="${escapeText(session?.readiness?.ankle)}"></label>
          <label class="field field--wide"><span>Any new pain, weakness, numbness or altered movement?</span><textarea id="readiness-notes" placeholder="Also note sleep, soreness, apprehension, time pressure or equipment changes…">${escapeText(session?.readiness?.notes)}</textarea></label>
        </div>
        <div class="button-row">
          <button class="button button--large" type="button" id="begin-workout">${session ? "Continue workout" : `Begin ${workout.durationMinutes}-minute workout`}</button>
          ${session ? '<button class="button button--danger" type="button" id="discard-session">Discard unfinished session</button>' : ""}
        </div>
        <p class="status" id="save-status">Entries save automatically on this device.</p>
      </section>

      ${workout.previousSession ? `
        <section class="card panel">
          <h2>Previous session · ${escapeText(formatDate(workout.previousSession.date))}</h2>
          <p>${escapeText(workout.previousSession.context)}</p>
          <ul>${(workout.previousSession.results || []).map((result) => `<li>${escapeText(result)}</li>`).join("")}</ul>
        </section>` : ""}

      ${recent.length ? `
        <section class="card panel">
          <h2>Recent sessions</h2>
          <div class="history-list">${recent.map((item) => `
            <div class="history-item">
              <strong>${escapeText(formatDate(item.workoutDate || localDate()))}</strong>
              <span>Session RPE ${escapeText(item.outcome?.sessionRpe || "not recorded")} · ${escapeText(item.completedAt ? new Date(item.completedAt).toLocaleTimeString("en-IE", { hour: "2-digit", minute: "2-digit" }) : "")}</span>
            </div>`).join("")}</div>
        </section>` : ""}
    `;

    document.querySelector("#begin-workout").addEventListener("click", () => {
      if (!session) session = newSession();
      session.readiness = {
        energy: document.querySelector("#energy").value,
        back: document.querySelector("#back-before").value,
        shoulder: document.querySelector("#shoulder-before").value,
        neck: document.querySelector("#neck-before").value,
        ankle: document.querySelector("#ankle-before").value,
        notes: document.querySelector("#readiness-notes").value.trim()
      };
      activeStepIndex = session.activeStepIndex || 0;
      saveDb("Readiness saved");
      renderWorkout();
      window.scrollTo(0, 0);
      requestAnimationFrame(() => window.scrollTo(0, 0));
      setTimeout(() => window.scrollTo(0, 0), 50);
    });

    document.querySelector("#readiness-form").addEventListener("input", () => {
      if (!session) return;
      session.readiness = {
        energy: document.querySelector("#energy").value,
        back: document.querySelector("#back-before").value,
        shoulder: document.querySelector("#shoulder-before").value,
        neck: document.querySelector("#neck-before").value,
        ankle: document.querySelector("#ankle-before").value,
        notes: document.querySelector("#readiness-notes").value
      };
      saveDb("Readiness saved");
    });

    document.querySelector("#discard-session")?.addEventListener("click", () => {
      if (!confirm("Discard this unfinished session and its entries?")) return;
      db.sessions = db.sessions.filter((item) => item.id !== session.id);
      session = null;
      activeStepIndex = 0;
      saveDb();
      renderLanding();
    });
  }

  function ensureExerciseLog(step) {
    if (!session.exerciseLogs[step.id]) {
      session.exerciseLogs[step.id] = {
        sets: (step.setPlan || []).map((label) => ({ label, load: "", reps: "", rpe: "" })),
        notes: ""
      };
    }
    return session.exerciseLogs[step.id];
  }

  function previousFor(step) {
    const prior = latestCompletedComparable();
    const log = prior?.exerciseLogs?.[step.id];
    if (!log?.sets?.length) return step.previousResult || "";
    const useful = log.sets.filter((set) => set.load || set.reps || set.rpe);
    if (!useful.length) return step.previousResult || "";
    return useful.map((set) => `${set.label}: ${set.load || "—"} · ${set.reps || "—"} reps · RPE ${set.rpe || "—"}`).join(" | ");
  }

  function renderWorkout() {
    if (!session) return renderLanding();
    restDock.hidden = false;
    activeStepIndex = Math.max(0, Math.min(activeStepIndex, workout.steps.length - 1));
    session.activeStepIndex = activeStepIndex;
    saveDb();

    const step = workout.steps[activeStepIndex];
    const log = ensureExerciseLog(step);
    const previous = previousFor(step);
    if (!restRunning) {
      restSeconds = Number(step.restSeconds) || 60;
      updateRestDisplay();
    }
    const elapsed = Math.max(0, (Date.now() - new Date(session.startedAt).getTime()) / 1000);
    const totalSeconds = workout.durationMinutes * 60;
    const remaining = totalSeconds - elapsed;
    const progress = ((activeStepIndex + 1) / workout.steps.length) * 100;

    app.innerHTML = `
      <div class="workout-header">
        <div class="workout-header__line">
          <span>Step ${activeStepIndex + 1} of ${workout.steps.length}</span>
          <strong id="workout-clock">${remaining >= 0 ? `${formatClock(remaining)} left` : `${formatClock(Math.abs(remaining))} over`}</strong>
        </div>
        <div class="progress-track" aria-label="Workout progress"><span style="width:${progress}%"></span></div>
      </div>

      <article class="card exercise-card">
        <header class="exercise-card__top">
          <p class="exercise-card__block">${escapeText(step.block)}</p>
          <h1>${escapeText(step.name)}</h1>
          <p class="exercise-card__time">Minute ${step.startMinute}–${step.endMinute}</p>
        </header>
        <div class="exercise-card__body">
          <p class="prescription">${escapeText(step.prescription)}</p>
          ${Array.isArray(step.instructions) ? `<ol class="instruction-list">${step.instructions.map((item) => `<li>${escapeText(item)}</li>`).join("")}</ol>` : ""}
          ${(step.technique || step.guardrail || step.progression) ? `
            <details class="details-box">
              <summary>Technique, guardrails and next-step logic</summary>
              <div class="details-box__content">
                ${step.technique ? `<p><strong>Technique:</strong> ${escapeText(step.technique)}</p>` : ""}
                ${step.guardrail ? `<p class="guardrail"><strong>Guardrail:</strong> ${escapeText(step.guardrail)}</p>` : ""}
                ${step.progression ? `<p><strong>Following session:</strong> ${escapeText(step.progression)}</p>` : ""}
              </div>
            </details>` : ""}
          ${previous ? `<p class="previous-result"><strong>Last comparable session:</strong> ${escapeText(previous)}</p>` : ""}

          ${log.sets.length ? `
            <div class="sets" id="set-list">
              ${log.sets.map((set, index) => `
                <div class="set-row" data-set-index="${index}">
                  <div class="set-label">${escapeText(set.label)}</div>
                  <label class="field"><span>Load / assistance</span><input data-field="load" type="text" inputmode="decimal" value="${escapeText(set.load)}"></label>
                  <label class="field"><span>Reps / result</span><input data-field="reps" type="text" inputmode="decimal" value="${escapeText(set.reps)}"></label>
                  <label class="field"><span>RPE</span><input data-field="rpe" type="number" min="1" max="10" step="0.5" inputmode="decimal" value="${escapeText(set.rpe)}"></label>
                </div>`).join("")}
            </div>` : ""}

          <label class="field exercise-notes"><span>Notes for this step</span><textarea id="exercise-notes" placeholder="Setup, symptoms, substitutions, what felt different…">${escapeText(log.notes)}</textarea></label>
          <p class="status" id="save-status">Saved automatically on this device.</p>

          <div class="step-actions">
            <button class="button button--quiet" type="button" id="previous-step" ${activeStepIndex === 0 ? "disabled" : ""}>Previous</button>
            <button class="button" type="button" id="next-step">${activeStepIndex === workout.steps.length - 1 ? "Finish and recap" : "Save and continue"}</button>
          </div>
        </div>
      </article>
    `;

    const updateClock = () => {
      const seconds = workout.durationMinutes * 60 - Math.max(0, (Date.now() - new Date(session.startedAt).getTime()) / 1000);
      const target = document.querySelector("#workout-clock");
      if (target) target.textContent = seconds >= 0 ? `${formatClock(seconds)} left` : `${formatClock(Math.abs(seconds))} over`;
    };
    clearInterval(workoutTicker);
    workoutTicker = setInterval(updateClock, 1000);

    document.querySelector("#set-list")?.addEventListener("input", (event) => {
      const row = event.target.closest("[data-set-index]");
      if (!row || !event.target.dataset.field) return;
      log.sets[Number(row.dataset.setIndex)][event.target.dataset.field] = event.target.value;
      saveDb("Set saved");
    });

    document.querySelector("#exercise-notes").addEventListener("input", (event) => {
      log.notes = event.target.value;
      saveDb("Notes saved");
    });

    document.querySelector("#previous-step").addEventListener("click", () => {
      activeStepIndex -= 1;
      renderWorkout();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    document.querySelector("#next-step").addEventListener("click", () => {
      if (activeStepIndex >= workout.steps.length - 1) {
        renderRecap();
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      activeStepIndex += 1;
      session.activeStepIndex = activeStepIndex;
      saveDb("Step completed");
      renderWorkout();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  function completedExerciseCount() {
    return workout.steps.filter((step) => {
      const log = session.exerciseLogs?.[step.id];
      return Boolean(log && (log.notes || log.sets?.some((set) => set.load || set.reps || set.rpe)));
    }).length;
  }

  function buildRecap() {
    const lines = [
      "TODAY'S WORKOUT RECAP",
      "",
      `Workout: ${workout.title}`,
      `Date: ${session.workoutDate || localDate()}`,
      `Planned duration: ${workout.durationMinutes} minutes`,
      `Started: ${new Date(session.startedAt).toLocaleString("en-IE")}`,
      `Completed: ${session.completedAt ? new Date(session.completedAt).toLocaleString("en-IE") : "Not yet marked complete"}`,
      "",
      "READINESS",
      `Energy: ${session.readiness.energy || "not recorded"}/5`,
      `Back: ${session.readiness.back || "not recorded"}/10`,
      `Shoulder: ${session.readiness.shoulder || "not recorded"}/10`,
      `Neck: ${session.readiness.neck || "not recorded"}/10`,
      `Ankle: ${session.readiness.ankle || "not recorded"}/10`,
      `Context: ${session.readiness.notes || "none recorded"}`,
      "",
      "WORK COMPLETED"
    ];

    workout.steps.forEach((step) => {
      const log = session.exerciseLogs?.[step.id];
      const entries = log?.sets?.filter((set) => set.load || set.reps || set.rpe) || [];
      lines.push(`\n${step.name}`);
      if (entries.length) entries.forEach((set) => lines.push(`- ${set.label}: ${set.load || "—"}; ${set.reps || "—"}; RPE ${set.rpe || "—"}`));
      else lines.push("- No structured result recorded");
      if (log?.notes) lines.push(`- Notes: ${log.notes}`);
    });

    lines.push(
      "",
      "IMMEDIATE RESPONSE",
      `Back: ${session.outcome.back || "not recorded"}/10`,
      `Shoulder: ${session.outcome.shoulder || "not recorded"}/10`,
      `Neck: ${session.outcome.neck || "not recorded"}/10`,
      `Ankle: ${session.outcome.ankle || "not recorded"}/10`,
      `Overall session RPE: ${session.outcome.sessionRpe || "not recorded"}/10`,
      `Apprehension: ${session.outcome.apprehension || "not recorded"}`,
      `Pain or technique alteration: ${session.outcome.painOrTechniqueChange || "none recorded"}`,
      `Reflection: ${session.outcome.reflection || "none recorded"}`,
      `Next-morning response: ${session.outcome.nextMorning || "not yet recorded"}`,
      "",
      "COACHING REQUEST",
      `Please review this session, ask about anything clinically or practically important, and prepare my next workout. The current training window is ${workout.durationMinutes} minutes. Prefer progressive, repeatable work over novelty.`
    );
    return lines.join("\n");
  }

  function exportSession() {
    const completedAt = session.completedAt || null;
    const actualDurationMinutes = completedAt && session.startedAt
      ? Math.max(1, Math.round((new Date(completedAt) - new Date(session.startedAt)) / 60000)) : null;
    return {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      source: { application: "Gavin Fitness Coaching Runner", runnerVersion: "1.0.0", workoutDefinitionId: workout.id, workoutDefinitionSchemaVersion: workout.schemaVersion },
      session: { sessionId: session.id, workoutDate: session.workoutDate || localDate(), startedAt: session.startedAt || null, completedAt, plannedDurationMinutes: workout.durationMinutes, actualDurationMinutes, completedStepCount: completedExerciseCount(), totalStepCount: workout.steps.length, completionStatus: completedAt ? "completed" : "in-progress" },
      readiness: { energy: session.readiness.energy, backSymptoms: session.readiness.back || "", shoulderSymptoms: session.readiness.shoulder, neckStiffness: session.readiness.neck, ankleSymptoms: session.readiness.ankle, context: session.readiness.notes },
      steps: workout.steps.map((step) => {
        const log = session.exerciseLogs?.[step.id] || { sets: [], notes: "" };
        return { stepId: step.id, name: step.name, block: step.block, plannedStartMinute: step.startMinute, plannedEndMinute: step.endMinute, completed: Boolean(log.notes || log.sets?.some((set) => set.load || set.reps || set.rpe)), sets: (log.sets || []).map((set) => ({ label: set.label, loadOrAssistance: set.load, repsOrResult: set.reps, rpe: set.rpe, notes: "" })), stepNotes: log.notes || "" };
      }),
      outcome: { overallSessionRpe: session.outcome.sessionRpe, backSymptomsAfter: session.outcome.back || "", shoulderSymptomsAfter: session.outcome.shoulder, neckStiffnessAfter: session.outcome.neck, ankleSymptomsAfter: session.outcome.ankle, apprehensionResponse: session.outcome.apprehension || "", painOrTechniqueChange: session.outcome.painOrTechniqueChange || "", whatFeltStrong: session.outcome.whatFeltStrong, whatLimitedSession: session.outcome.whatLimitedSession, changeForNextTime: session.outcome.changeForNextTime, nextMorningResponse: session.outcome.nextMorning },
      audio: { recorded: Boolean(audioUrl), downloadedFilename: null, includedInJson: false },
      safetyFlags: { userReportedStopSignal: false, details: "" }
    };
  }

  function markdownRecap() {
    const data = exportSession();
    const value = (item) => item || "";
    const work = data.steps.map((step) => {
      const sets = step.sets.map((set) => `- ${set.label}: ${value(set.loadOrAssistance)}; ${value(set.repsOrResult)}; RPE ${value(set.rpe)}`).join("\n");
      return `### ${step.name}\n${sets || "- No structured result recorded"}${step.stepNotes ? `\n- Notes: ${step.stepNotes}` : ""}`;
    }).join("\n\n");
    return `# Workout session handoff\n\n## Session\nWorkout: ${workout.title}\nDate: ${value(data.session.workoutDate)}\nPlanned duration: ${workout.durationMinutes} minutes\n\n## Readiness\nEnergy: ${value(data.readiness.energy)}\nBack: ${value(data.readiness.backSymptoms)}\nShoulder: ${value(data.readiness.shoulderSymptoms)}\nNeck: ${value(data.readiness.neckStiffness)}\nAnkle: ${value(data.readiness.ankleSymptoms)}\nContext: ${value(data.readiness.context)}\n\n## Completed work\n${work}\n\n## Immediate response\nOverall RPE: ${value(data.outcome.overallSessionRpe)}\nBack: ${value(data.outcome.backSymptomsAfter)}\nShoulder: ${value(data.outcome.shoulderSymptomsAfter)}\nNeck: ${value(data.outcome.neckStiffnessAfter)}\nAnkle: ${value(data.outcome.ankleSymptomsAfter)}\nApprehension: ${value(data.outcome.apprehensionResponse)}\nPain or technique alteration: ${value(data.outcome.painOrTechniqueChange)}\n\n## What felt strong\n${value(data.outcome.whatFeltStrong)}\n\n## What limited the session\n${value(data.outcome.whatLimitedSession)}\n\n## What should change next time\n${value(data.outcome.changeForNextTime)}\n\n## Next-morning response\n${value(data.outcome.nextMorningResponse)}\n\n## Audio\nRecorded locally: ${data.audio.recorded ? "yes" : "no"}. Audio is separate and is not included in this handoff.`;
  }

  function downloadText(filename, type, contents) {
    const url = URL.createObjectURL(new Blob([contents], { type }));
    const link = document.createElement("a");
    link.href = url; link.download = filename;
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  function renderRecap() {
    clearInterval(workoutTicker);
    restDock.hidden = true;
    if (!session.completedAt) session.completedAt = new Date().toISOString();
    saveDb();
    const elapsedMinutes = Math.max(1, Math.round((new Date(session.completedAt) - new Date(session.startedAt)) / 60000));

    app.innerHTML = `
      <section class="hero recap-hero">
        <p class="eyebrow">Session complete</p>
        <h1>You turned up.</h1>
        <p class="hero__purpose">Now capture enough truth for the next coaching conversation.</p>
      </section>

      <section class="card panel">
        <div class="recap-metrics">
          <div class="metric"><span>Actual time</span><strong>${elapsedMinutes} min</strong></div>
          <div class="metric"><span>Steps with entries</span><strong>${completedExerciseCount()} / ${workout.steps.length}</strong></div>
          <div class="metric"><span>Planned time</span><strong>${workout.durationMinutes} min</strong></div>
        </div>

        <h2>Immediate response</h2>
        <div class="form-grid" id="outcome-form">
          <label class="field"><span>Back, 0–10</span><input data-outcome="back" type="number" min="0" max="10" value="${escapeText(session.outcome.back)}"></label>
          <label class="field"><span>Shoulder, 0–10</span><input data-outcome="shoulder" type="number" min="0" max="10" value="${escapeText(session.outcome.shoulder)}"></label>
          <label class="field"><span>Neck, 0–10</span><input data-outcome="neck" type="number" min="0" max="10" value="${escapeText(session.outcome.neck)}"></label>
          <label class="field"><span>Ankle, 0–10</span><input data-outcome="ankle" type="number" min="0" max="10" value="${escapeText(session.outcome.ankle)}"></label>
          <label class="field"><span>Session RPE, 1–10</span><input data-outcome="sessionRpe" type="number" min="1" max="10" step="0.5" value="${escapeText(session.outcome.sessionRpe)}"></label>
          <label class="field field--wide"><span>Apprehension response</span><select data-outcome="apprehension"><option value="">Select one</option><option value="reduced" ${session.outcome.apprehension === "reduced" ? "selected" : ""}>Reduced</option><option value="unchanged" ${session.outcome.apprehension === "unchanged" ? "selected" : ""}>Unchanged</option><option value="increased" ${session.outcome.apprehension === "increased" ? "selected" : ""}>Increased</option></select></label>
          <label class="field field--wide"><span>Any pain or technique alteration?</span><textarea data-outcome="painOrTechniqueChange">${escapeText(session.outcome.painOrTechniqueChange)}</textarea></label>
          <label class="field field--wide"><span>What felt strong?</span><textarea data-outcome="whatFeltStrong">${escapeText(session.outcome.whatFeltStrong)}</textarea></label>
          <label class="field field--wide"><span>What limited the session?</span><textarea data-outcome="whatLimitedSession">${escapeText(session.outcome.whatLimitedSession)}</textarea></label>
          <label class="field field--wide"><span>What should change next time?</span><textarea data-outcome="changeForNextTime">${escapeText(session.outcome.changeForNextTime)}</textarea></label>
          <label class="field field--wide"><span>Next-morning response</span><textarea data-outcome="nextMorning" placeholder="Return tomorrow and add recovery, stiffness or symptoms.">${escapeText(session.outcome.nextMorning)}</textarea></label>
        </div>
        <p class="status" id="save-status">Recap saves automatically.</p>

        <div class="audio-panel">
          <h3>Optional spoken recap</h3>
          <p>Record naturally. Mention what surprised you, what felt good or awkward, and anything the numbers miss. The recording stays in this browser until you download it.</p>
          <div class="button-row">
            <button class="button" type="button" id="audio-start">Start recording</button>
            <button class="button button--quiet" type="button" id="audio-stop" disabled>Stop</button>
          </div>
          <p class="audio-status" id="audio-status" role="status" aria-live="polite">No recording yet.</p>
          <audio id="audio-preview" controls hidden></audio>
          <a class="download-link" id="audio-download" hidden>Download audio recap</a>
        </div>
      </section>

      <section class="card panel">
        <h2>Hand this back to ChatGPT</h2>
        <p>The text below is assembled from the workout. Copy it into our fitness conversation and attach the audio recording if you made one.</p>
        <textarea class="recap-output" id="recap-output" aria-label="Workout recap for ChatGPT">${escapeText(buildRecap())}</textarea>
        <div class="button-row">
          <button class="button button--large" type="button" id="copy-recap">Copy recap</button>
          <button class="button button--quiet" type="button" id="download-json">Download coaching handoff (.json)</button>
          <button class="button button--quiet" type="button" id="download-markdown">Download readable recap (.md)</button>
          <a class="button button--quiet button--large" href="https://chatgpt.com/" target="_blank" rel="noopener">Open ChatGPT</a>
          <button class="button button--quiet" type="button" id="back-to-workout">Review workout entries</button>
          <button class="button button--danger" type="button" id="new-session">Start a fresh session</button>
        </div>
        <p class="status" id="copy-status" role="status" aria-live="polite"></p>
      </section>
    `;

    const refreshRecap = () => {
      document.querySelector("#recap-output").value = buildRecap();
    };

    document.querySelector("#outcome-form").addEventListener("input", (event) => {
      const key = event.target.dataset.outcome;
      if (!key) return;
      session.outcome[key] = event.target.value;
      saveDb("Recap saved");
      refreshRecap();
    });

    document.querySelector("#copy-recap").addEventListener("click", async () => {
      const text = document.querySelector("#recap-output").value;
      try {
        await navigator.clipboard.writeText(text);
        document.querySelector("#copy-status").textContent = "Recap copied. Paste it into our fitness conversation.";
      } catch {
        document.querySelector("#recap-output").select();
        document.execCommand("copy");
        document.querySelector("#copy-status").textContent = "Recap selected and copied where supported.";
      }
    });

    document.querySelector("#download-json").addEventListener("click", () => {
      const date = exportSession().session.workoutDate || "undated";
      downloadText(`workout-session-${date}.json`, "application/json", JSON.stringify(exportSession(), null, 2));
      document.querySelector("#copy-status").textContent = "Coaching handoff downloaded.";
    });
    document.querySelector("#download-markdown").addEventListener("click", () => {
      const date = exportSession().session.workoutDate || "undated";
      downloadText(`workout-session-${date}.md`, "text/markdown", markdownRecap());
      document.querySelector("#copy-status").textContent = "Readable recap downloaded.";
    });

    document.querySelector("#back-to-workout").addEventListener("click", () => {
      session.completedAt = "";
      activeStepIndex = Math.max(0, workout.steps.length - 1);
      session.activeStepIndex = activeStepIndex;
      saveDb();
      renderWorkout();
    });

    document.querySelector("#new-session").addEventListener("click", () => {
      if (!confirm("Start a fresh copy of this workout? The completed session will remain in local history.")) return;
      session = null;
      activeStepIndex = 0;
      renderLanding();
    });

    setupAudioRecorder();
  }

  function setupAudioRecorder() {
    const start = document.querySelector("#audio-start");
    const stop = document.querySelector("#audio-stop");
    const status = document.querySelector("#audio-status");
    const preview = document.querySelector("#audio-preview");
    const download = document.querySelector("#audio-download");

    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      start.disabled = true;
      status.textContent = "Audio recording is not supported in this browser. Use ChatGPT voice or your phone recorder instead.";
      return;
    }

    start.addEventListener("click", async () => {
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioChunks = [];
        mediaRecorder = new MediaRecorder(mediaStream);
        mediaRecorder.addEventListener("dataavailable", (event) => {
          if (event.data.size) audioChunks.push(event.data);
        });
        mediaRecorder.addEventListener("stop", () => {
          const type = mediaRecorder.mimeType || "audio/webm";
          const blob = new Blob(audioChunks, { type });
          if (audioUrl) URL.revokeObjectURL(audioUrl);
          audioUrl = URL.createObjectURL(blob);
          preview.src = audioUrl;
          preview.hidden = false;
          download.href = audioUrl;
          const extension = type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm";
          download.download = `workout-recap-${session.workoutDate || localDate()}.${extension}`;
          download.hidden = false;
          status.textContent = "Recording ready. Download it before closing or refreshing this page.";
          mediaStream?.getTracks().forEach((track) => track.stop());
        });
        mediaRecorder.start();
        start.disabled = true;
        stop.disabled = false;
        status.textContent = "Recording… speak naturally, then press Stop.";
      } catch {
        status.textContent = "Microphone access was unavailable. You can still attach a recording made elsewhere.";
      }
    });

    stop.addEventListener("click", () => {
      if (mediaRecorder?.state === "recording") mediaRecorder.stop();
      start.disabled = false;
      stop.disabled = true;
    });
  }

  function updateRestDisplay() {
    restDisplay.textContent = formatClock(restSeconds);
  }

  function stopRest(message) {
    clearInterval(restTicker);
    restTicker = undefined;
    restRunning = false;
    restToggle.textContent = "Start";
    if (message) restToggle.setAttribute("aria-label", message);
  }

  function tickRest() {
    restSeconds = Math.max(0, Math.ceil((restEndAt - Date.now()) / 1000));
    updateRestDisplay();
    if (restSeconds <= 0) {
      stopRest("Rest complete");
      restToggle.textContent = "Again";
      navigator.vibrate?.([140, 70, 140]);
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        const context = new AudioContext();
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.frequency.value = 700;
        gain.gain.setValueAtTime(0.08, context.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.35);
        oscillator.connect(gain).connect(context.destination);
        oscillator.start();
        oscillator.stop(context.currentTime + 0.35);
      } catch {
        // Visible timer remains the fallback.
      }
    }
  }

  restToggle.addEventListener("click", () => {
    if (restRunning) {
      stopRest("Resume rest timer");
      return;
    }
    if (restSeconds <= 0) restSeconds = 60;
    restRunning = true;
    restEndAt = Date.now() + restSeconds * 1000;
    restToggle.textContent = "Pause";
    clearInterval(restTicker);
    restTicker = setInterval(tickRest, 250);
    tickRest();
  });

  restMinus.addEventListener("click", () => {
    restSeconds = Math.max(0, restSeconds - 15);
    if (restRunning) restEndAt = Date.now() + restSeconds * 1000;
    updateRestDisplay();
  });

  restPlus.addEventListener("click", () => {
    restSeconds += 15;
    if (restRunning) restEndAt = Date.now() + restSeconds * 1000;
    updateRestDisplay();
  });

  window.addEventListener("beforeunload", () => {
    mediaStream?.getTracks().forEach((track) => track.stop());
    if (audioUrl) URL.revokeObjectURL(audioUrl);
  });

  updateRestDisplay();
  if (session?.completedAt) renderRecap();
  else renderLanding();
})();
