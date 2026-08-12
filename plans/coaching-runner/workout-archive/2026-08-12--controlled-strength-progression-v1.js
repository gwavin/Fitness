window.CURRENT_WORKOUT = {
  schemaVersion: 1,
  id: "controlled-strength-progression-2026-08-12-v1",
  publishedFor: "2026-08-12",
  durationMinutes: 45,
  title: "Controlled strength progression",
  purpose: "Progress squat and bench conservatively, establish a measurable row baseline, and restore the missed shoulder-prehab work.",
  targetEffort: "Controlled work only: symptom-governed squatting, technically sound benching, and no maximal or testing efforts.",
  safetySummary: "Do not train through new numbness, weakness, radiating pain or another neurological symptom. Stop or reduce any movement that causes sharp or increasing pain, spasm, altered technique or progressive discomfort.",
  coachNote: "Squat is a rehabilitative progression; bench is a normal strength progression; row establishes the missing load baseline; shoulder work rebuilds tolerance with light resistance.",
  previousSession: {
    date: "2026-08-10",
    title: "Completed strength session",
    context: "Energy 5/5; back 3/10; shoulder, neck and ankle 0/10; no neurological symptoms. The session went well. An aerobic cycling session followed on 11 August.",
    results: [
      "Squat â€” 45 kg for 3 sets of 5 after warm-ups.",
      "Bench press â€” 70 kg for 3 sets of 5 after warm-ups.",
      "Chest-supported row â€” 3 sets of 10; resistance was not recorded.",
      "Shoulder and prehab work was missed."
    ]
  },
  steps: [
    {
      id: "readiness-2026-08-12",
      block: "Readiness",
      name: "Readiness and squat decision",
      startMinute: 0,
      endMinute: 3,
      prescription: "Review the recorded readiness scores and the on-screen squat recommendation before loading the bar.",
      instructions: [
        "Proceed towards 47.5 kg only when back discomfort is 0â€“3/10, no neurological symptoms are present and warm-ups feel normal.",
        "If back discomfort is worse than Monday's 3/10 or rises during warm-up, remain near 45 kg or reduce or stop according to symptoms.",
        "With new numbness, weakness, radiating pain or another neurological symptom, do not perform loaded squats; reassess rather than training through it."
      ],
      guardrail: "The readiness result governs the squat recommendation. It does not need to affect symptom-free upper-body work unless position changes or setup provoke symptoms.",
      setPlan: []
    },
    {
      id: "barbell-squat-47-5kg-3x5",
      block: "Rehabilitative progression",
      name: "Barbell squat",
      startMinute: 3,
      endMinute: 18,
      prescription: "Warm up with 20 kg Ã— 10, 30 kg Ã— 5 and 40 kg Ã— 5. If the readiness and warm-up checks remain reassuring, perform 47.5 kg for 3 sets of 5. Rest about 2 minutes between working sets.",
      technique: "Use the same stable, controlled squat pattern as Monday. Treat every warm-up as another symptom check; do not force depth or grind repetitions.",
      guardrail: "47.5 kg is appropriate only with back discomfort at 0â€“3/10, no neurological symptoms and normal-feeling warm-ups. If symptoms are worse than Monday or increase during warm-up, use about 45 kg or reduce or stop. Do not loaded-squat with neurological symptoms.",
      previousResult: "10 August: 45 kg for 3 Ã— 5 after warm-ups; back 3/10 and no neurological symptoms; session went well.",
      progression: "This 2.5 kg increase is repeated symptom-stable exposure, not rapid restoration of former strength. Let the session and next-day response govern the next prescription.",
      restSeconds: 120,
      safetyGate: "squat",
      setPlan: [
        { label: "Warm-up 1", load: "20 kg", reps: "10", rpeRequired: false },
        { label: "Warm-up 2", load: "30 kg", reps: "5", rpeRequired: false },
        { label: "Warm-up 3", load: "40 kg", reps: "5", rpeRequired: false },
        { label: "Working set 1", load: "47.5 kg", reps: "5", rpeRequired: true },
        { label: "Working set 2", load: "47.5 kg", reps: "5", rpeRequired: true },
        { label: "Working set 3", load: "47.5 kg", reps: "5", rpeRequired: true }
      ]
    },
    {
      id: "bench-press-72-5kg-3x5",
      block: "Strength progression",
      name: "Bench press",
      startMinute: 18,
      endMinute: 31,
      prescription: "Warm up with 20 kg Ã— 10, 40 kg Ã— 5 and 60 kg Ã— 5, then perform 72.5 kg for 3 sets of 5. Rest about 2 minutes between working sets.",
      technique: "Use a repeatable setup and controlled descent. Keep each repetition technically sound and stop before grinding.",
      guardrail: "Monday's 70 kg work was symptom-free, so a normal 2.5 kg increment is appropriate. Reduce or stop if shoulder or back symptoms appear or technique changes.",
      previousResult: "10 August: 70 kg for 3 Ã— 5 after warm-ups; no shoulder symptoms.",
      progression: "Continue normal 2.5 kg increments while all working sets remain technically sound and symptom-free.",
      restSeconds: 120,
      setPlan: [
        { label: "Warm-up 1", load: "20 kg", reps: "10", rpeRequired: false },
        { label: "Warm-up 2", load: "40 kg", reps: "5", rpeRequired: false },
        { label: "Warm-up 3", load: "60 kg", reps: "5", rpeRequired: false },
        { label: "Working set 1", load: "72.5 kg", reps: "5", rpeRequired: true },
        { label: "Working set 2", load: "72.5 kg", reps: "5", rpeRequired: true },
        { label: "Working set 3", load: "72.5 kg", reps: "5", rpeRequired: true }
      ]
    },
    {
      id: "chest-supported-row-baseline-3x10",
      block: "Establish measurable baseline",
      name: "Chest-supported row",
      startMinute: 31,
      endMinute: 39,
      prescription: "Perform 3 sets of 10. Select and enter the resistance actually used; Monday's load was not recorded, so no load is prescribed or assumed. Rest 75â€“90 seconds.",
      technique: "Keep the chest supported and use controlled repetitions without momentum. Pause briefly at the top and lower under control.",
      guardrail: "Enter the resistance for every completed set so the next session can progress from a known baseline.",
      previousResult: "10 August: 3 Ã— 10 completed; resistance not recorded.",
      progression: "Use today's recorded resistance and RPE as the baseline for subsequent sessions.",
      restSeconds: 90,
      setPlan: [
        { label: "Set 1", load: "", reps: "10", loadRequired: true },
        { label: "Set 2", load: "", reps: "10", loadRequired: true },
        { label: "Set 3", load: "", reps: "10", loadRequired: true }
      ]
    },
    {
      id: "shoulder-prehab-2026-08-12",
      block: "Maintain and rebuild tolerance",
      name: "Shoulder and prehab",
      startMinute: 39,
      endMinute: 44,
      prescription: "Use light resistance for band external rotation 2 Ã— 12â€“15 and scapular work 2 Ã— 10â€“15. Add optional gentle shoulder mobility only if useful.",
      technique: "Use controlled, pain-free repetitions. Choose familiar scapular work and record what you performed in the notes.",
      guardrail: "This is supportive prehab, not a progression exercise. Do not include standing overhead press yet.",
      setPlan: [
        { label: "Band external rotation â€” set 1", load: "light band", reps: "12â€“15" },
        { label: "Band external rotation â€” set 2", load: "light band", reps: "12â€“15" },
        { label: "Scapular work â€” set 1", load: "light", reps: "10â€“15" },
        { label: "Scapular work â€” set 2", load: "light", reps: "10â€“15" },
        { label: "Optional gentle mobility", load: "", reps: "" }
      ]
    },
    {
      id: "session-recap-2026-08-12",
      block: "Recap",
      name: "Record the session response",
      startMinute: 44,
      endMinute: 45,
      prescription: "Review completed sets, add exercise notes and finish the session to generate the copyable actual-work recap.",
      instructions: [
        "Confirm the row resistance is recorded.",
        "Record whether prehab was completed and what scapular movement was used.",
        "Add overall notes, symptoms or technique changes that should inform the next session."
      ],
      guardrail: "Only sets explicitly marked complete appear as completed work in the recap; prescribed but unchecked values are not reported as performed.",
      setPlan: []
    }
  ]
};

