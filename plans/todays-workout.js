(function () {
  "use strict";

  const STORAGE_KEY = "fitness-todays-workout-baseline-v2";
  const rows = [...document.querySelectorAll("[data-exercise]")];
  const saveStatus = document.querySelector("#save-status");
  const sessionNote = document.querySelector("#session-note");
  const sessionDate = document.querySelector("#session-date");
  const sessionFields = [...document.querySelectorAll("[data-session-field]")];

  const emptyLog = () => ({
    date: new Date().toISOString().slice(0, 10),
    sessionNote: "",
    ...Object.fromEntries(sessionFields.map((field) => [field.dataset.sessionField, ""])),
    exercises: rows.map((row) => ({
      exercise: row.dataset.exercise,
      weight: "",
      reps: "",
      sets: "",
      rpe: "",
      notes: ""
    }))
  });

  let log = emptyLog();
  try {
    log = { ...log, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") };
  } catch {
    // Invalid or unavailable stored data falls back to a fresh local log.
  }

  function fillForm() {
    sessionDate.value = log.date;
    sessionNote.value = log.sessionNote || "";
    sessionFields.forEach((field) => {
      field.value = log[field.dataset.sessionField] || "";
    });
    rows.forEach((row) => {
      const entry = log.exercises?.find((item) => item.exercise === row.dataset.exercise) || {};
      row.querySelectorAll("[data-field]").forEach((input) => {
        input.value = entry[input.dataset.field] || "";
      });
    });
  }

  function readForm() {
    log = {
      date: sessionDate.value,
      sessionNote: sessionNote.value,
      ...Object.fromEntries(sessionFields.map((field) => [field.dataset.sessionField, field.value])),
      exercises: rows.map((row) => {
        const entry = { exercise: row.dataset.exercise };
        row.querySelectorAll("[data-field]").forEach((input) => {
          entry[input.dataset.field] = input.value;
        });
        return entry;
      })
    };
  }

  let statusTimeout;
  function save() {
    readForm();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(log));
      saveStatus.textContent = "Saved on this device";
    } catch {
      saveStatus.textContent = "Could not save locally; export your CSV before leaving.";
    }
    clearTimeout(statusTimeout);
    statusTimeout = setTimeout(() => {
      if (saveStatus.textContent === "Saved on this device") saveStatus.textContent = "Changes save automatically";
    }, 1800);
  }

  document.addEventListener("input", (event) => {
    if (event.target.matches("[data-field], [data-session-field], #session-date, #session-note")) save();
  });

  const csvCell = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  document.querySelector("#download-csv").addEventListener("click", () => {
    readForm();
    const sessionHeaders = sessionFields.map((field) => field.dataset.sessionField);
    const header = ["date", "exercise", "weight_or_assistance", "actual_reps", "actual_sets", "rpe_1_10", "notes", "session_note", ...sessionHeaders];
    const csvRows = [
      header,
      ...log.exercises.map((entry) => [
        log.date,
        entry.exercise,
        entry.weight,
        entry.reps,
        entry.sets,
        entry.rpe,
        entry.notes,
        log.sessionNote,
        ...sessionHeaders.map((key) => log[key])
      ])
    ];
    const blob = new Blob(["\ufeff" + csvRows.map((row) => row.map(csvCell).join(",")).join("\r\n")], {
      type: "text/csv;charset=utf-8"
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `workout-${log.date || "undated"}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 0);
    saveStatus.textContent = "CSV downloaded";
  });

  const display = document.querySelector("#timer-display");
  const timerStatus = document.querySelector("#timer-status");
  const timerButtons = [...document.querySelectorAll("[data-timer-label]")];
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  let remaining = 60;
  let endAt = 0;
  let interval;
  let activeLabel = "timer";
  let audioContext;

  function renderTimer() {
    const seconds = Math.max(0, Math.ceil(remaining));
    display.textContent = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  }

  function stopTimer(message) {
    clearInterval(interval);
    interval = undefined;
    timerButtons.forEach((button) => button.removeAttribute("aria-pressed"));
    if (message) timerStatus.textContent = message;
  }

  async function ensureAudioContext() {
    try {
      if (!AudioContext) return undefined;
      if (!audioContext || audioContext.state === "closed") audioContext = new AudioContext();
      if (audioContext.state === "suspended") await audioContext.resume();
      return audioContext;
    } catch {
      audioContext = undefined;
      return undefined;
    }
  }

  function playTone(context, frequency, startTime, duration, gainLevel) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.001, startTime);
    gain.gain.exponentialRampToValueAtTime(gainLevel, startTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(startTime);
    oscillator.stop(startTime + duration);
  }

  function signalCompletion() {
    try {
      if (!audioContext || audioContext.state !== "running") return;
      const now = audioContext.currentTime;
      playTone(audioContext, 660, now, 0.18, 0.14);
      playTone(audioContext, 880, now + 0.22, 0.18, 0.14);
      playTone(audioContext, 1100, now + 0.44, 0.32, 0.16);
    } catch {
      // The live status text below is the accessible fallback when audio is unavailable.
    }
    navigator.vibrate?.([160, 80, 160]);
  }

  function tick() {
    remaining = Math.max(0, (endAt - Date.now()) / 1000);
    renderTimer();
    if (remaining <= 0) {
      stopTimer(`${activeLabel} complete. Audio or vibration signal played where supported.`);
      signalCompletion();
      document.title = "Timer complete — Today's workout";
    }
  }

  timerButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      stopTimer();
      await ensureAudioContext();
      remaining = 60;
      activeLabel = button.dataset.timerLabel;
      endAt = Date.now() + 60000;
      button.setAttribute("aria-pressed", "true");
      timerStatus.textContent = `${activeLabel} running. A visible message and optional sound will signal completion.`;
      document.title = "Timer running — Today's workout";
      interval = setInterval(tick, 250);
      tick();
    });
  });

  document.querySelector("#timer-reset").addEventListener("click", () => {
    remaining = 60;
    stopTimer("Timer reset to one minute.");
    renderTimer();
    document.title = "Today's workout";
  });

  fillForm();
  renderTimer();
})();
