window.CURRENT_WORKOUT = {
  schemaVersion: 1,
  id: "controlled-strength-progression-2026-09-02-v1",
  publishedFor: "2026-09-02",
  durationMinutes: 42,
  title: "Next controlled strength progression",
  purpose: "Progress the symptom-stable squat, hold bench load while improving bench contact, progress the supported row, and complete all conservative hinge and carry work within 42 minutes.",
  targetEffort: "Repeatable strength work around 3 RIR. Prioritise clean technique and timely transitions over added load.",
  safetySummary: "Stop or modify for new neurological disturbance, substantial deterioration, pain clearly aggravated during warm-up, meaningful symptom increase across sets, or symptom-driven technique alteration.",
  coachNote: "Squat moves to 57.5 kg only if warm-ups feel normal. Bench stays at 80 kg until every rep keeps the buttocks in contact. Move efficiently so all three RDL sets and all three carries fit inside 42 minutes.",
  rirGuide: "How many additional clean reps could you genuinely have completed? Record RIR without testing failure. The main target today is approximately 3 RIR.",
  previousSession: {
    date: "2026-08-31",
    title: "Completed 42-minute strength session",
    context: "The session finished at exactly 42 minutes. Back remained 0/10 and felt better across the squat sets. Time prevented the final RDL set and final carry.",
    results: [
      "Squat — 55 kg × 5 × 3 at RIR 3/3/3; back 0/10 and better across sets.",
      "Bench press — 80 kg × 5 × 3 at RIR 2/2/3; slight bum lift on the final rep, so load is held.",
      "Supported one-arm dumbbell row — 21.6 kg per arm × 10 × 3 at RPE 3/3/3.",
      "Romanian deadlift — 30 kg × 5 × 2; third set omitted for time.",
      "Farmer’s carries — 20 kg per hand × 2 carries; third carry omitted for time."
    ]
  },
  steps: [
    {
      id: "readiness-2026-09-02",
      block: "Readiness",
      name: "Readiness and back check",
      startMinute: 0,
      endMinute: 3,
      prescription: "Record readiness, then use the squat warm-ups to confirm whether 57.5 kg is appropriate today.",
      instructions: [
        "Proceed to 57.5 kg only while the back feels normal and stable through warm-ups.",
        "If the back feels meaningfully different during warm-ups, repeat 55 kg instead.",
        "Do not perform loaded squats with new numbness, weakness, radiating pain or another neurological symptom."
      ],
      guardrail: "The fallback is a successful adjustment, not a failed workout.",
      setPlan: []
    },
    {
      id: "barbell-squat-57-5kg-3x5-2026-09-02",
      block: "Controlled progression",
      name: "Barbell squat",
      startMinute: 3,
      endMinute: 16,
      prescription: "Warm up with 20 kg × 5–10, 30 kg × 5 and 40 kg × 5, then perform 57.5 kg for 3 sets of 5 at approximately 3 RIR.",
      technique: "Use controlled repetitions and monitor the back across warm-ups and successive working sets.",
      guardrail: "If the back feels meaningfully different during warm-ups, repeat 55 kg instead. Stop loaded squatting for new neurological symptoms or a meaningful adverse symptom change.",
      previousResult: "31 August: 55 kg × 5 × 3 at RIR 3/3/3; back remained 0/10 and felt better across sets.",
      progression: "Use the actual symptom response, technique and RIR to decide whether the next load increase is warranted.",
      restSeconds: 120,
      safetyGate: "squat",
      setPlan: [
        { label: "Warm-up 1", load: "20 kg", reps: "5–10" },
        { label: "Warm-up 2", load: "30 kg", reps: "5" },
        { label: "Warm-up 3", load: "40 kg", reps: "5" },
        { label: "Working set 1", load: "57.5 kg", reps: "5", rirRequired: true },
        { label: "Working set 2", load: "57.5 kg", reps: "5", rirRequired: true },
        { label: "Working set 3", load: "57.5 kg", reps: "5", rirRequired: true }
      ],
      assessmentFields: [
        { key: "usedFallback", label: "Used 55 kg fallback?", type: "select", options: ["No", "Yes"] },
        { key: "backResponse", label: "Back response across sets", type: "select", options: ["Better", "Same", "Worse"] },
        { key: "technique", label: "Technique or symptom comments", type: "textarea" }
      ]
    },
    {
      id: "bench-press-80kg-3x5-2026-09-02",
      block: "Technique consolidation",
      name: "Bench press",
      startMinute: 16,
      endMinute: 29,
      prescription: "Warm up with 20 kg × 10, 40 kg × 5 and 60 kg × 5, then repeat 80 kg for 3 sets of 5. Do not increase to 82.5 kg yet. Technique goal: keep bum planted for all reps before progressing load.",
      technique: "Technique goal: keep bum planted for all reps before progressing load.",
      guardrail: "No grinding repetitions. Reduce or stop if shoulder symptoms appear or contact with the bench cannot be maintained.",
      previousResult: "31 August: 80 kg × 5 × 3 at RIR 2/2/3; slight bum lift on the final rep.",
      progression: "Progress load only after all repetitions remain technically sound with the buttocks in contact with the bench.",
      restSeconds: 120,
      setPlan: [
        { label: "Warm-up 1", load: "20 kg", reps: "10" },
        { label: "Warm-up 2", load: "40 kg", reps: "5" },
        { label: "Warm-up 3", load: "60 kg", reps: "5" },
        { label: "Working set 1", load: "80 kg", reps: "5", rirRequired: true },
        { label: "Working set 2", load: "80 kg", reps: "5", rirRequired: true },
        { label: "Working set 3", load: "80 kg", reps: "5", rirRequired: true }
      ],
      assessmentFields: [
        { key: "bumContact", label: "Bum planted for all reps?", type: "select", options: ["Yes", "No"] },
        { key: "technique", label: "Technique comments", type: "textarea" }
      ]
    },
    {
      id: "supported-one-arm-row-23kg-3x8-2026-09-02",
      block: "Supported pull",
      name: "Supported one-arm dumbbell row",
      startMinute: 29,
      endMinute: 34,
      prescription: "Use 23 kg per arm for 3 sets of 8 each side. Keep the torso supported and transition promptly between sides.",
      technique: "Use controlled repetitions without momentum or unnecessary lower-back loading.",
      guardrail: "If 23 kg cannot be configured safely with the available dumbbell, use 21.6 kg for 12 repetitions per side instead and record the actual values.",
      previousResult: "31 August: 21.6 kg per arm × 10 × 3 at RPE 3/3/3.",
      restSeconds: 75,
      setPlan: [
        { label: "Set 1 — each side", load: "23 kg / arm", reps: "8 / side", rpeRequired: true },
        { label: "Set 2 — each side", load: "23 kg / arm", reps: "8 / side", rpeRequired: true },
        { label: "Set 3 — each side", load: "23 kg / arm", reps: "8 / side", rpeRequired: true }
      ]
    },
    {
      id: "romanian-deadlift-30kg-3x5-2026-09-02",
      block: "Conservative hinge",
      name: "Romanian deadlift",
      startMinute: 34,
      endMinute: 38,
      prescription: "Perform 30 kg for 3 sets of 5. Restore the third set while keeping the load deliberately conservative.",
      technique: "Use a controlled range and efficient setup. Record actual repetitions and RIR.",
      guardrail: "Stop or shorten the range if lower-back symptoms meaningfully increase or technique changes.",
      previousResult: "31 August: 30 kg × 5 × 2; third set omitted for time.",
      restSeconds: 60,
      setPlan: [
        { label: "Set 1", load: "30 kg", reps: "5", rirRequired: true },
        { label: "Set 2", load: "30 kg", reps: "5", rirRequired: true },
        { label: "Set 3", load: "30 kg", reps: "5", rirRequired: true }
      ]
    },
    {
      id: "farmers-carries-20kg-3x30s-2026-09-02",
      block: "Timed carries",
      name: "Farmer’s carries",
      startMinute: 38,
      endMinute: 42,
      prescription: "Carry 20 kg per hand for 30 seconds, for 3 total carries. Restore the third carry and use the inline timers to keep transitions efficient.",
      technique: "Walk tall at a controlled pace, use smooth turns and keep the loads clear of the legs.",
      guardrail: "Stop for loss of grip control, unsafe turning, sharp pain or meaningful symptom increase.",
      previousResult: "31 August: 20 kg per hand for 2 carries; third carry omitted for time.",
      restSeconds: 45,
      setPlan: [
        { label: "Carry 1", load: "20 kg / hand", reps: "30 seconds", rpeRequired: true, timerSeconds: 30 },
        { label: "Carry 2", load: "20 kg / hand", reps: "30 seconds", rpeRequired: true, timerSeconds: 30 },
        { label: "Carry 3", load: "20 kg / hand", reps: "30 seconds", rpeRequired: true, timerSeconds: 30 }
      ]
    }
  ]
};
