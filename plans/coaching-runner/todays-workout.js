(function () {
  "use strict";

  const workout = window.CURRENT_WORKOUT;
  const app = document.querySelector("#app");
  const restDock = document.querySelector("#rest-dock");
  const restDisplay = document.querySelector("#rest-display");
  const restToggle = document.querySelector("#rest-toggle");
  const restMinus = document.querySelector("#rest-minus");
  const restPlus = document.querySelector("#rest-plus");
  const soundTest = document.querySelector("#sound-test");
  const soundToggle = document.querySelector("#sound-toggle");

  if (!workout || !Array.isArray(workout.steps)) {
    app.innerHTML = '<section class="card panel"><h1>Workout unavailable</h1><p>The daily workout definition could not be loaded.</p></section>';
    return;
  }

  const STORAGE_KEY = "fitness-coaching-runner-v1";
  const SOUND_KEY = "fitness-coaching-runner-sound-v1";
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
  const EVENING_MOBILITY_URL = "return-barefoot-running-strength-training-plan.html#mobility-routine";
  const eveningMobilityCard = () => `
    <aside class="card evening-mobility" aria-labelledby="evening-mobility-title">
      <div>
        <p class="eyebrow">Tonight</p>
        <h2 id="evening-mobility-title">15-minute shoulder &amp; ankle mobility</h2>
        <p>Keep the evening recovery habit visible: shoulder mobility, ankle range, calf work and thoracic rotation.</p>
      </div>
      <a class="button button--large" href="${EVENING_MOBILITY_URL}">Open evening mobility &rarr;</a>
    </aside>`;

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
  let alarmContext;
  let soundOn = localStorage.getItem(SOUND_KEY) !== "off";
  let inlineTimerCleanups = [];

  function ensureAlarmContext() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    if (!alarmContext) alarmContext = new AudioContextClass();
    if (alarmContext.state === "suspended") alarmContext.resume();
    return alarmContext;
  }

  function notifyTimerComplete() {
    navigator.vibrate?.([220, 100, 220, 100, 360]);
    if (!soundOn) return;
    try {
      const context = ensureAlarmContext();
      if (!context) return;
      const start = context.currentTime + 0.03;
      [0, 0.34, 0.68].forEach((offset, index) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = "square";
        oscillator.frequency.value = index === 2 ? 980 : 820;
        gain.gain.setValueAtTime(0.0001, start + offset);
        gain.gain.exponentialRampToValueAtTime(0.22, start + offset + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.24);
        oscillator.connect(gain).connect(context.destination);
        oscillator.start(start + offset);
        oscillator.stop(start + offset + 0.25);
      });
    } catch {
      // Vibration and the visible timer remain available if audio is blocked.
    }
  }

  function clearInlineTimers() {
    inlineTimerCleanups.forEach((cleanup) => cleanup());
    inlineTimerCleanups = [];
  }

  function saveDb(statusText) {
    if (session) {
      const index = db.sessions.findIndex((item) => item.id === session.id);
      if (index >= 0) db.sessions[index] = session;
      else db.sessions.unshift(session);
    }
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
      readiness: { energy: "", back: "", shoulder: "", neck: "", ankle: "", neurological: "", notes: "" },
      exerciseLogs: {},
      outcome: {
        back: "", shoulder: "", neck: "", ankle: "", sessionRpe: "", apprehension: "", painOrTechniqueChange: "", overallNotes: "", whatFeltStrong: "", whatLimitedSession: "", changeForNextTime: "", nextMorning: "", nextBack: "", nextShoulder: "", nextNeck: "", nextAnkle: "", nextNeurological: "", nextStiffness: "", nextDelayedReaction: ""
      }
    };
  }

  function latestCompletedComparable() {
    return db.sessions.find((item) => item.workoutId === workout.id && item.completedAt);
  }

  function renderLanding() {
    clearInlineTimers();
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
        <p class="hero__meta">${escapeText(workout.trainingWindow || `${workout.durationMinutes} minutes`)} · ${escapeText(workout.targetEffort)}</p>
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
          <label class="field"><span>Ankle / foot, 0–10</span><input id="ankle-before" type="number" min="0" max="10" inputmode="numeric" value="${escapeText(session?.readiness?.ankle)}"></label>
          <label class="field"><span>Neurological or radiating symptoms?</span><select id="neurological-before"><option value="">Select Yes or No</option><option value="No" ${session?.readiness?.neurological === "No" ? "selected" : ""}>No</option><option value="Yes" ${session?.readiness?.neurological === "Yes" ? "selected" : ""}>Yes</option></select></label>
          <label class="field field--wide"><span>Context and readiness notes</span><textarea id="readiness-notes" placeholder="Sleep, soreness, warm-up response, radiating pain, numbness, weakness, time pressure or equipment changes…">${escapeText(session?.readiness?.notes)}</textarea></label>
        </div>
        <div class="readiness-decision" id="squat-readiness" role="status" aria-live="polite"></div>
        <div class="button-row">
          <button class="button button--large" type="button" id="begin-workout">${session ? "Continue workout" : `Begin ${workout.durationMinutes}-minute workout`}</button>
          ${session ? '<button class="button button--danger" type="button" id="discard-session">Discard unfinished session</button>' : ""}
        </div>
        <p class="status" id="save-status">Entries save automatically on this device.</p>
      </section>

      ${eveningMobilityCard()}

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
              ${item.workoutId === workout.id ? `<button class="button button--quiet" type="button" data-open-recap="${escapeText(item.id)}">Open recap</button>` : ""}
            </div>`).join("")}</div>
        </section>` : ""}
    `;

    document.querySelectorAll("[data-open-recap]").forEach((button) => {
      button.addEventListener("click", () => {
        const completed = db.sessions.find((item) => item.id === button.dataset.openRecap && item.workoutId === workout.id && item.completedAt);
        if (!completed) return;
        session = completed;
        activeStepIndex = session.activeStepIndex || 0;
        renderRecap();
        window.scrollTo(0, 0);
      });
    });

    document.querySelector("#begin-workout").addEventListener("click", () => {
      const requiredReadiness = ["#energy", "#back-before", "#shoulder-before", "#neck-before", "#ankle-before", "#neurological-before"];
      if (requiredReadiness.some((selector) => !document.querySelector(selector).value)) {
        document.querySelector("#save-status").textContent = "Complete all readiness scores and select Yes or No for neurological symptoms before beginning.";
        document.querySelector("#save-status").classList.add("status--error");
        return;
      }
      ensureAlarmContext();
      if (!session) session = newSession();
      session.readiness = {
        energy: document.querySelector("#energy").value,
        back: document.querySelector("#back-before").value,
        shoulder: document.querySelector("#shoulder-before").value,
        neck: document.querySelector("#neck-before").value,
        ankle: document.querySelector("#ankle-before").value,
        neurological: document.querySelector("#neurological-before").value,
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
      updateSquatReadiness();
      if (!session) return;
      session.readiness = {
        energy: document.querySelector("#energy").value,
        back: document.querySelector("#back-before").value,
        shoulder: document.querySelector("#shoulder-before").value,
        neck: document.querySelector("#neck-before").value,
        ankle: document.querySelector("#ankle-before").value,
        neurological: document.querySelector("#neurological-before").value,
        notes: document.querySelector("#readiness-notes").value
      };
      saveDb("Readiness saved");
    });

    function updateSquatReadiness() {
      const target = document.querySelector("#squat-readiness");
      const back = Number(document.querySelector("#back-before").value);
      const neurological = document.querySelector("#neurological-before").value;
      target.className = "readiness-decision";
      if (neurological === "Yes") {
        target.classList.add("readiness-decision--stop");
        target.innerHTML = "<strong>Do not perform loaded squats.</strong> New neurological symptoms require reassessment rather than training through them.";
      } else if (document.querySelector("#back-before").value && back > 2) {
        target.classList.add("readiness-decision--caution");
        target.innerHTML = "<strong>Do not progress the squat automatically.</strong> Back is above 2/10. Use the 60 kg fallback only if warm-ups settle and feel normal; otherwise reduce or stop.";
      } else if (neurological === "No" && document.querySelector("#back-before").value && back <= 2) {
        target.classList.add("readiness-decision--proceed");
        target.innerHTML = "<strong>62.5 kg may be appropriate</strong> if recovery and squat warm-ups feel normal. If back symptoms materially worsen, do not progress automatically: use 60 kg only if symptoms settle and technique is normal; otherwise reduce or stop.";
      } else {
        target.textContent = "Enter back discomfort and neurological symptom status to receive the squat recommendation.";
      }
    }

    updateSquatReadiness();

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
        sets: (step.setPlan || []).map((item) => typeof item === "string"
          ? { label: item, load: "", reps: "", rpe: "", completed: false }
          : { label: item.label, load: item.load || "", reps: item.reps || "", rpe: "", rir: "", completed: false }),
        notes: "",
        assessments: {}
      };
    }
    if (!session.exerciseLogs[step.id].assessments) session.exerciseLogs[step.id].assessments = {};
    return session.exerciseLogs[step.id];
  }

  function previousFor(step) {
    const prior = latestCompletedComparable();
    const log = prior?.exerciseLogs?.[step.id];
    if (!log?.sets?.length) return step.previousResult || "";
    const useful = log.sets.filter((set) => set.load || set.reps || set.rpe);
    if (!useful.length) return step.previousResult || "";
    return useful.map((set) => `${set.label}: ${set.load || "—"} · ${set.reps || "—"} reps${set.rir !== undefined && set.rir !== "" ? ` · RIR ${set.rir}` : ` · RPE ${set.rpe || "—"}`}`).join(" | ");
  }

  function renderWorkout() {
    clearInlineTimers();
    if (!session) return renderLanding();
    restDock.hidden = false;
    activeStepIndex = Math.max(0, Math.min(activeStepIndex, workout.steps.length - 1));
    session.activeStepIndex = activeStepIndex;
    saveDb();

    const step = workout.steps[activeStepIndex];
    const log = ensureExerciseLog(step);
    const previous = previousFor(step);
    const squatBlocked = step.safetyGate === "squat" && (session.readiness.neurological === "Yes" || log.assessments.warmupResponse === "Neurological / radiating symptoms");
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
          ${step.safetyGate === "squat" ? '<div id="squat-safety" role="status" aria-live="polite"></div>' : ""}
          ${workout.rirGuide && step.setPlan?.some((item) => item.rirRequired) ? `<details class="details-box"><summary>How to record RIR</summary><div class="details-box__content"><p>${escapeText(workout.rirGuide)}</p></div></details>` : ""}
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

          ${step.safetyGate === "squat" ? `<label class="field"><span>Back response during warm-ups</span><select data-assessment="warmupResponse"><option value="">Select after warm-ups</option>${["Normal / settled", "Materially worse", "Neurological / radiating symptoms"].map((option) => `<option value="${escapeText(option)}" ${log.assessments.warmupResponse === option ? "selected" : ""}>${escapeText(option)}</option>`).join("")}</select></label>` : ""}
          ${log.sets.length ? `
            <div class="sets" id="set-list">
              ${log.sets.map((set, index) => `
                <div class="set-row ${set.completed ? "set-row--complete" : ""}" data-set-index="${index}">
                  <div class="set-label">${escapeText(set.label)}</div>
                  <label class="completion-field"><input data-field="completed" type="checkbox" ${set.completed ? "checked" : ""} ${squatBlocked ? "disabled" : ""}><span>Completed</span></label>
                  <label class="field"><span>Actual load / resistance</span><input data-field="load" type="text" inputmode="decimal" value="${escapeText(set.load)}" ${squatBlocked ? "disabled" : ""}></label>
                  <label class="field"><span>Actual reps / result</span><input data-field="reps" type="text" inputmode="decimal" value="${escapeText(set.reps)}" ${squatBlocked ? "disabled" : ""}></label>
                  ${step.setPlan?.[index]?.rirRequired
                    ? `<label class="field"><span>RIR (required)</span><input data-field="rir" aria-label="How many additional clean reps could you genuinely have completed?" type="number" min="0" max="10" step="1" inputmode="numeric" value="${escapeText(set.rir)}" ${squatBlocked ? "disabled" : ""}></label>`
                    : `<label class="field"><span>RPE${step.setPlan?.[index]?.rpeRequired ? " (required)" : ""}</span><input data-field="rpe" type="number" min="1" max="10" step="0.5" inputmode="decimal" value="${escapeText(set.rpe)}" ${squatBlocked ? "disabled" : ""}></label>`}
                  ${step.setPlan?.[index]?.timerSeconds ? `<div class="set-timer" data-set-timer data-duration="${step.setPlan[index].timerSeconds}">
                    <strong data-timer-display>${formatClock(step.setPlan[index].timerSeconds)}</strong>
                    <button class="button" type="button" data-timer-action="toggle">Start</button>
                    <button class="button button--quiet" type="button" data-timer-action="reset">Reset</button>
                  </div>` : ""}
                </div>`).join("")}
            </div>` : ""}

          ${step.assessmentFields?.length ? `<div class="assessment-grid" id="assessment-fields">${step.assessmentFields.filter((field) => field.key !== "warmupResponse").map((field) => `
            <label class="field ${field.type === "textarea" ? "field--wide" : ""}"><span>${escapeText(field.label)}</span>${field.type === "select"
              ? `<select data-assessment="${escapeText(field.key)}"><option value="">Select one</option>${field.options.map((option) => `<option value="${escapeText(option)}" ${log.assessments[field.key] === option ? "selected" : ""}>${escapeText(option)}</option>`).join("")}</select>`
              : `<textarea data-assessment="${escapeText(field.key)}">${escapeText(log.assessments[field.key])}</textarea>`}</label>`).join("")}</div>` : ""}

          <label class="field exercise-notes"><span>Notes for this step</span><textarea id="exercise-notes" placeholder="Setup, symptoms, substitutions, what felt different…">${escapeText(log.notes)}</textarea></label>
          <p class="status" id="save-status">Saved automatically on this device.</p>

          <div class="step-actions">
            <button class="button button--quiet" type="button" id="previous-step" ${activeStepIndex === 0 ? "disabled" : ""}>Previous</button>
            <button class="button" type="button" id="next-step">${activeStepIndex === workout.steps.length - 1 ? "Finish and recap" : "Save and continue"}</button>
          </div>
        </div>
      </article>
      ${eveningMobilityCard()}
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
      log.sets[Number(row.dataset.setIndex)][event.target.dataset.field] = event.target.type === "checkbox" ? event.target.checked : event.target.value;
      if (event.target.type === "checkbox") {
        row.classList.toggle("set-row--complete", event.target.checked);
        if (event.target.checked) {
          row.querySelector('[data-field="rir"], [data-field="rpe"]')?.focus({ preventScroll: true });
        }
      }
      saveDb("Set saved");
    });

    document.querySelectorAll("[data-set-timer]").forEach((timer) => {
      const display = timer.querySelector("[data-timer-display]");
      const toggle = timer.querySelector('[data-timer-action="toggle"]');
      const reset = timer.querySelector('[data-timer-action="reset"]');
      const duration = Number(timer.dataset.duration);
      let remaining = duration;
      let endAt = 0;
      let ticker;
      const draw = () => { display.textContent = formatClock(remaining); };
      const stop = () => { clearInterval(ticker); ticker = undefined; toggle.textContent = remaining <= 0 ? "Again" : "Start"; };
      const tick = () => {
        remaining = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
        draw();
        if (remaining <= 0) {
          stop();
          notifyTimerComplete();
        }
      };
      toggle.addEventListener("click", () => {
        ensureAlarmContext();
        if (ticker) { stop(); return; }
        if (remaining <= 0) remaining = duration;
        endAt = Date.now() + remaining * 1000;
        toggle.textContent = "Pause";
        ticker = setInterval(tick, 250);
        tick();
      });
      reset.addEventListener("click", () => { stop(); remaining = duration; draw(); });
      inlineTimerCleanups.push(() => clearInterval(ticker));
    });

    document.querySelector("#exercise-notes").addEventListener("input", (event) => {
      log.notes = event.target.value;
      saveDb("Notes saved");
    });

    function updateSquatSafety() {
      const target = document.querySelector("#squat-safety");
      if (!target) return;
      const blocked = session.readiness.neurological === "Yes" || log.assessments.warmupResponse === "Neurological / radiating symptoms";
      const caution = Number(session.readiness.back) > 2 || log.assessments.warmupResponse === "Materially worse" || log.assessments.backResponse === "Worse";
      target.className = blocked ? "safety-alert safety-alert--stop" : "safety-alert safety-alert--caution";
      target.hidden = !blocked && !caution;
      target.innerHTML = blocked
        ? "<strong>Loaded squatting is disabled.</strong> You reported neurological or radiating symptoms. Stop loaded work and reassess."
        : "<strong>Do not progress automatically.</strong> Back is above 2/10 or symptoms have worsened. Use the 60 kg fallback only if symptoms settle and technique feels normal; otherwise reduce or stop. Record the actual load and whether fallback was used.";
      document.querySelectorAll("#set-list input").forEach((input) => { input.disabled = blocked; });
    }
    updateSquatSafety();

    document.querySelectorAll("[data-assessment]").forEach((input) => {
      input.addEventListener("input", (event) => {
        log.assessments[event.target.dataset.assessment] = event.target.value;
        updateSquatSafety();
        saveDb("Assessment saved");
      });
    });

    document.querySelector("#previous-step").addEventListener("click", () => {
      activeStepIndex -= 1;
      renderWorkout();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    document.querySelector("#next-step").addEventListener("click", () => {
      const incompleteRpe = log.sets.some((set, index) => set.completed && step.setPlan?.[index]?.rpeRequired && !set.rpe);
      const incompleteRir = log.sets.some((set, index) => set.completed && step.setPlan?.[index]?.rirRequired && set.rir === "");
      const missingLoad = log.sets.some((set, index) => set.completed && step.setPlan?.[index]?.loadRequired && !set.load.trim());
      if (incompleteRpe || incompleteRir || missingLoad) {
        const status = document.querySelector("#save-status");
        status.textContent = incompleteRir ? "Add RIR for every completed working set before continuing." : incompleteRpe ? "Add RPE for every completed working set before continuing." : "Enter the row resistance for every completed set before continuing.";
        status.classList.add("status--error");
        return;
      }
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
      return Boolean(log && (log.notes || log.sets?.some((set) => set.completed)));
    }).length;
  }

  function actualDurationMinutes() {
    return session.completedAt && session.startedAt
      ? Math.max(1, Math.round((new Date(session.completedAt) - new Date(session.startedAt)) / 60000))
      : null;
  }

  function buildRecap() {
    const lines = [
      "TODAY'S WORKOUT RECAP",
      "",
      `Workout: ${workout.title}`,
      `Date: ${session.workoutDate || localDate()}`,
      `Planned duration: ${workout.durationMinutes} minutes`,
      `Training window: ${workout.trainingWindow || `${workout.durationMinutes} minutes`}`,
      `Actual duration: ${actualDurationMinutes() ? `${actualDurationMinutes()} minutes` : "session still in progress"}`,
      `Started: ${new Date(session.startedAt).toLocaleString("en-IE")}`,
      `Completed: ${session.completedAt ? new Date(session.completedAt).toLocaleString("en-IE") : "Not yet marked complete"}`,
      "",
      "READINESS",
      `Energy: ${session.readiness.energy || "not recorded"}/5`,
      `Back: ${session.readiness.back || "not recorded"}/10`,
      `Shoulder: ${session.readiness.shoulder || "not recorded"}/10`,
      `Neck: ${session.readiness.neck || "not recorded"}/10`,
      `Ankle / foot: ${session.readiness.ankle || "not recorded"}/10`,
      `Neurological symptoms: ${session.readiness.neurological || "not recorded"}`,
      `Context: ${session.readiness.notes || "none recorded"}`,
      "",
      "WORK COMPLETED"
    ];

    workout.steps.forEach((step) => {
      const log = session.exerciseLogs?.[step.id];
      const entries = log?.sets?.filter((set) => set.completed) || [];
      lines.push(`\n${step.name}`);
      if (entries.length) entries.forEach((set) => lines.push(`- ${set.label}: ${set.load || "—"}; ${set.reps || "—"}; ${set.rir !== undefined && set.rir !== "" ? `RIR ${set.rir}` : `RPE ${set.rpe || "—"}`}`));
      else lines.push("- No structured result recorded");
      Object.entries(log?.assessments || {}).filter(([, value]) => value).forEach(([key, value]) => {
        const field = step.assessmentFields?.find((item) => item.key === key);
        lines.push(`- ${field?.label || key}: ${value}`);
      });
      if (log?.notes) lines.push(`- Notes: ${log.notes}`);
    });

    lines.push(
      "",
      "IMMEDIATE RESPONSE",
      `Back: ${session.outcome.back || "not recorded"}/10`,
      `Shoulder: ${session.outcome.shoulder || "not recorded"}/10`,
      `Neck: ${session.outcome.neck || "not recorded"}/10`,
      `Ankle: ${session.outcome.ankle || "not recorded"}/10`,
      `Overall effort: ${session.outcome.sessionRpe || "not recorded"}/10`,
      `Apprehension: ${session.outcome.apprehension || "not recorded"}`,
      `Pain or technique alteration: ${session.outcome.painOrTechniqueChange || "none recorded"}`,
      `Overall notes: ${session.outcome.overallNotes || "none recorded"}`,
      "",
      "NEXT-MORNING RESPONSE",
      `Back: ${session.outcome.nextBack || "not recorded"}/10`,
      `Shoulder: ${session.outcome.nextShoulder || "not recorded"}/10`,
      `Neck: ${session.outcome.nextNeck || "not recorded"}/10`,
      `Ankle: ${session.outcome.nextAnkle || "not recorded"}/10`,
      `Neurological symptoms: ${session.outcome.nextNeurological || "not recorded"}`,
      `General stiffness/DOMS: ${session.outcome.nextStiffness || "none recorded"}`,
      `Delayed reaction: ${session.outcome.nextDelayedReaction || "none recorded"}`,
      `Notes: ${session.outcome.nextMorning || "none recorded"}`,
      "",
      "COACHING REQUEST",
      `Please review this session, ask about anything clinically or practically important, and prepare my next workout. The current training window is ${workout.trainingWindow || `${workout.durationMinutes} minutes`}. Prefer progressive, repeatable work over novelty.`
    );
    return lines.join("\n");
  }

  function exportSession() {
    const completedAt = session.completedAt || null;
    const durationMinutes = actualDurationMinutes();
    return {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      trainingWindow: workout.trainingWindow || `${workout.durationMinutes} minutes`,
      source: { application: "Gavin Fitness Coaching Runner", runnerVersion: "1.2.0", workoutDefinitionId: workout.id, workoutDefinitionSchemaVersion: workout.schemaVersion },
      session: { sessionId: session.id, workoutDate: session.workoutDate || localDate(), startedAt: session.startedAt || null, completedAt, plannedDurationMinutes: workout.durationMinutes, actualDurationMinutes: durationMinutes, completedStepCount: completedExerciseCount(), totalStepCount: workout.steps.length, completionStatus: completedAt ? "completed" : "in-progress" },
      readiness: { energy: session.readiness.energy, backSymptoms: session.readiness.back || "", shoulderSymptoms: session.readiness.shoulder, neckStiffness: session.readiness.neck, ankleSymptoms: session.readiness.ankle, neurologicalSymptoms: session.readiness.neurological || "", context: session.readiness.notes },
      steps: workout.steps.map((step) => {
        const log = session.exerciseLogs?.[step.id] || { sets: [], notes: "" };
        return { stepId: step.id, name: step.name, block: step.block, plannedStartMinute: step.startMinute, plannedEndMinute: step.endMinute, completed: Boolean(log.notes || log.sets?.some((set) => set.completed)), sets: (log.sets || []).filter((set) => set.completed).map((set) => ({ label: set.label, loadOrAssistance: set.load, repsOrResult: set.reps, rir: set.rir ?? "", rpe: set.rpe, notes: "" })), assessments: log.assessments || {}, stepNotes: log.notes || "" };
      }),
      outcome: { overallEffort: session.outcome.sessionRpe, overallSessionRpe: session.outcome.sessionRpe, backSymptomsAfter: session.outcome.back || "", shoulderSymptomsAfter: session.outcome.shoulder, neckStiffnessAfter: session.outcome.neck, ankleSymptomsAfter: session.outcome.ankle, apprehensionResponse: session.outcome.apprehension || "", painOrTechniqueChange: session.outcome.painOrTechniqueChange || "", overallNotes: session.outcome.overallNotes || "", whatFeltStrong: session.outcome.whatFeltStrong, whatLimitedSession: session.outcome.whatLimitedSession, changeForNextTime: session.outcome.changeForNextTime, nextMorningResponse: { back: session.outcome.nextBack || "", shoulder: session.outcome.nextShoulder || "", neck: session.outcome.nextNeck || "", ankle: session.outcome.nextAnkle || "", neurologicalSymptoms: session.outcome.nextNeurological || "", stiffnessOrDoms: session.outcome.nextStiffness || "", delayedReaction: session.outcome.nextDelayedReaction || "", notes: session.outcome.nextMorning || "" } },
      audio: { recorded: Boolean(audioUrl), downloadedFilename: null, includedInJson: false },
      safetyFlags: { userReportedStopSignal: false, details: "" }
    };
  }

  function markdownRecap() {
    return `# Workout session handoff\n\n${buildRecap()}`;
  }

  function downloadText(filename, type, contents) {
    const url = URL.createObjectURL(new Blob([contents], { type }));
    const link = document.createElement("a");
    link.href = url; link.download = filename;
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  function renderRecap() {
    clearInlineTimers();
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

      ${eveningMobilityCard()}

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
          <label class="field"><span>Overall effort, 1–10</span><input data-outcome="sessionRpe" type="number" min="1" max="10" step="0.5" value="${escapeText(session.outcome.sessionRpe)}"></label>
          <label class="field field--wide"><span>Apprehension response</span><select data-outcome="apprehension"><option value="">Select one</option><option value="reduced" ${session.outcome.apprehension === "reduced" ? "selected" : ""}>Reduced</option><option value="unchanged" ${session.outcome.apprehension === "unchanged" ? "selected" : ""}>Unchanged</option><option value="increased" ${session.outcome.apprehension === "increased" ? "selected" : ""}>Increased</option></select></label>
          <label class="field field--wide"><span>Any pain or technique alteration?</span><textarea data-outcome="painOrTechniqueChange">${escapeText(session.outcome.painOrTechniqueChange)}</textarea></label>
          <label class="field field--wide"><span>Overall session notes</span><textarea data-outcome="overallNotes" placeholder="Anything important not captured by the set or exercise notes.">${escapeText(session.outcome.overallNotes)}</textarea></label>
          <label class="field field--wide"><span>What felt strong?</span><textarea data-outcome="whatFeltStrong">${escapeText(session.outcome.whatFeltStrong)}</textarea></label>
          <label class="field field--wide"><span>What limited the session?</span><textarea data-outcome="whatLimitedSession">${escapeText(session.outcome.whatLimitedSession)}</textarea></label>
          <label class="field field--wide"><span>What should change next time?</span><textarea data-outcome="changeForNextTime">${escapeText(session.outcome.changeForNextTime)}</textarea></label>
          <div class="field--wide follow-up-heading"><h3>Next-morning response</h3><p><strong>After conventional deadlifts, check back stiffness and neurological symptoms in particular.</strong> Record any delayed reaction below. Do not progress the deadlift after a meaningful delayed adverse response; reassess first.</p></div>
          <label class="field"><span>Back, 0–10</span><input data-outcome="nextBack" type="number" min="0" max="10" value="${escapeText(session.outcome.nextBack)}"></label>
          <label class="field"><span>Shoulder, 0–10</span><input data-outcome="nextShoulder" type="number" min="0" max="10" value="${escapeText(session.outcome.nextShoulder)}"></label>
          <label class="field"><span>Neck, 0–10</span><input data-outcome="nextNeck" type="number" min="0" max="10" value="${escapeText(session.outcome.nextNeck)}"></label>
          <label class="field"><span>Ankle, 0–10</span><input data-outcome="nextAnkle" type="number" min="0" max="10" value="${escapeText(session.outcome.nextAnkle)}"></label>
          <label class="field"><span>Neurological symptoms?</span><select data-outcome="nextNeurological"><option value="">Select Yes or No</option><option value="No" ${session.outcome.nextNeurological === "No" ? "selected" : ""}>No</option><option value="Yes" ${session.outcome.nextNeurological === "Yes" ? "selected" : ""}>Yes</option></select></label>
          <label class="field field--wide"><span>General stiffness / DOMS</span><textarea data-outcome="nextStiffness">${escapeText(session.outcome.nextStiffness)}</textarea></label>
          <label class="field field--wide"><span>Any delayed reaction?</span><textarea data-outcome="nextDelayedReaction">${escapeText(session.outcome.nextDelayedReaction)}</textarea></label>
          <label class="field field--wide"><span>Next-morning notes</span><textarea data-outcome="nextMorning">${escapeText(session.outcome.nextMorning)}</textarea></label>
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
      notifyTimerComplete();
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

  soundToggle.checked = soundOn;
  soundToggle.addEventListener("change", () => {
    soundOn = soundToggle.checked;
    localStorage.setItem(SOUND_KEY, soundOn ? "on" : "off");
    if (soundOn) ensureAlarmContext();
  });
  soundTest.addEventListener("click", () => {
    ensureAlarmContext();
    notifyTimerComplete();
  });

  window.addEventListener("beforeunload", () => {
    mediaStream?.getTracks().forEach((track) => track.stop());
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    clearInlineTimers();
  });

  updateRestDisplay();
  if (session?.completedAt) renderRecap();
  else renderLanding();
})();
