(function () {
  "use strict";

  const STORAGE_KEY = "fitness-todays-workout-v1";
  const rows = [...document.querySelectorAll("[data-exercise]")];
  const saveStatus = document.querySelector("#save-status");
  const sessionNote = document.querySelector("#session-note");
  const sessionDate = document.querySelector("#session-date");

  const emptyLog = () => ({
    date: new Date().toISOString().slice(0, 10),
    sessionNote: "",
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
    rows.forEach((row, index) => {
      const entry = log.exercises?.find((item) => item.exercise === row.dataset.exercise) || log.exercises?.[index] || {};
      row.querySelectorAll("[data-field]").forEach((input) => {
        input.value = entry[input.dataset.field] || "";
      });
    });
  }

  function readForm() {
    log = {
      date: sessionDate.value,
      sessionNote: sessionNote.value,
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

  document.querySelector("#workout-log").addEventListener("input", save);

  const csvCell = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  document.querySelector("#download-csv").addEventListener("click", () => {
    readForm();
    const header = ["date", "exercise", "actual_weight_kg", "actual_reps", "actual_sets", "rpe_1_10", "notes", "session_note"];
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
        log.sessionNote
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
  let remaining = 60;
  let endAt = 0;
  let interval;
  let activeLabel = "timer";

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

  function signalCompletion() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const context = new AudioContext();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = 740;
      gain.gain.setValueAtTime(0.12, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.45);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.45);
      oscillator.addEventListener("ended", () => context.close());
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
    button.addEventListener("click", () => {
      stopTimer();
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
