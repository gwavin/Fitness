window.CURRENT_WORKOUT = {
  schemaVersion: 1,
  id: "controlled-strength-progression-2026-09-23-v1",
  publishedFor: "2026-09-23",
  durationMinutes: 45,
  trainingWindow: "40–50 minutes (45-minute planning target)",
  title: "Next controlled strength progression",
  purpose: "Progress squat and conventional deadlift conservatively, reduce bench load to restore consistent contact, and repeat the established row and carry work.",
  targetEffort: "Squat and deadlift: RIR 3–4. Bench: RIR 2–3 with glutes planted for all 15 working repetitions. Controlled reps without grinding.",
  safetySummary: "Stop or modify for new neurological symptoms, meaningful symptom increase, or symptom-driven technique changes. A meaningful delayed adverse back response means reassess the deadlift before increasing it.",
  coachNote: "Squat 75 kg, with 72.5 kg available if recovery, warm-ups or symptoms warrant it. Bench deliberately reduces to 80 kg so all reps use consistent technique with glutes planted. Deadlift 75 kg for two sets, with a 72.5 kg fallback. Repeat three row/carry rounds, or use two rather than rushing if the session approaches 50 minutes. Allow 40–50 minutes, aiming for about 45.",
  rirGuide: "RIR means additional clean reps available, without testing failure. RPE is perceived effort out of 10, not reps remaining. Accidental warm-up effort entries must not determine progression.",
  previousSession: {
    date: "2026-09-21",
    title: "Completed controlled strength session",
    context: "Back response improved across both squat and deadlift sets. Bench approached the current strength limit and the hips lifted, so the next session deliberately reduces bench load to restore consistent technique.",
    results: [
      "Squat — 72.5 kg × 5 × 3 at RIR 5/4/4; back felt better across sets.",
      "Bench press — 82.5 kg × 5 × 3 at RIR 2/2/1; hips lifted and the final repetition approached the limit.",
      "Conventional deadlift — 72.5 kg × 5 × 2 at RIR 4/4; back felt better across sets.",
      "Supported one-arm dumbbell row — 24 kg per arm × 12 per side × 3.",
      "Farmer’s carries — 25 kg per hand × 45 seconds × 3."
    ]
  },
  steps: [
    {
      id: "readiness-2026-09-23",
      block: "Readiness",
      name: "Readiness and recovery check",
      startMinute: 0,
      endMinute: 3,
      prescription: "Check recovery from the 21 September strength session and Monday evening karate, especially back, shoulder, neck, ankle/foot and neurological symptoms, before choosing today's loads.",
      instructions: [
        "Proceed only when recovered; the publication date is not an instruction to train on consecutive days.",
        "Review baseline back discomfort above 2/10 before progressing. Use the 72.5 kg squat fallback if recovery, warm-up performance or symptoms warrant it, only if movement remains comfortable and controlled; otherwise reduce or stop.",
        "Before deadlifts, review back response and recovery. Use the 72.5 kg fallback if readiness, warm-ups or symptoms do not support 75 kg. Ongoing neurological symptoms require reassessment.",
        "Keep squat, bench and deadlift working sets separate. Rest at least the planned two minutes, and longer if needed. Time blocks are guides; omit accessory work rather than rush."
      ],
      guardrail: "New numbness, weakness or radiating symptoms: stop loaded work and seek assessment.",
      setPlan: []
    },
    {
      id: "barbell-squat-75kg-3x5-2026-09-23",
      block: "Controlled progression",
      name: "Barbell squat",
      startMinute: 3,
      endMinute: 15,
      prescription: "Warm up: 20 kg × 8, 40 kg × 5, 60 kg × 3. Then 75 kg × 5 × 3 at RIR 3–4. Fallback: 72.5 kg if recovery, warm-up performance or symptoms warrant reducing the load.",
      instructions: ["Check back response and recovery during warm-ups. Use 72.5 kg if recovery, performance or symptoms warrant it and movement remains comfortable and controlled; otherwise reduce or stop."],
      technique: "Controlled, confident repetitions with a repeatable setup. Monitor back response across sets.",
      guardrail: "Keep technique controlled and back response stable. Use 72.5 kg when recovery, warm-ups or symptoms warrant it; otherwise reduce or stop. Stop loaded work for neurological symptoms.",
      progression: "Review technique, RIR and delayed response before any further increase.",
      restSeconds: 120,
      safetyGate: "squat",
      setPlan: [
        { label: "Warm-up 1", load: "20 kg", reps: "8" },
        { label: "Warm-up 2", load: "40 kg", reps: "5" },
        { label: "Warm-up 3", load: "60 kg", reps: "3" },
        { label: "Working set 1", load: "75 kg", reps: "5", rirRequired: true },
        { label: "Working set 2", load: "75 kg", reps: "5", rirRequired: true },
        { label: "Working set 3", load: "75 kg", reps: "5", rirRequired: true }
      ],
      assessmentFields: [
        { key: "warmupResponse", label: "Back response during warm-ups", type: "select", options: ["Normal / settled", "Progressively worse", "Neurological / radiating symptoms"] },
        { key: "usedFallback", label: "Used 72.5 kg fallback?", type: "select", options: ["No", "Yes"] },
        { key: "backResponse", label: "Back response across sets", type: "select", options: ["Better", "Same", "Worse"] },
        { key: "technique", label: "Technique or symptom comments", type: "textarea" }
      ]
    },
    {
      id: "bench-press-80kg-3x5-2026-09-23",
      block: "Technique consolidation",
      name: "Bench press",
      startMinute: 15,
      endMinute: 27,
      prescription: "Warm up: 20 kg × 10, 40 kg × 5, 60 kg × 3. Then 80 kg × 5 × 3 at RIR 2–3. This is the first planned 80 kg consolidation session.",
      instructions: ["Before each working set: feet firmly set → glutes in contact → shoulder blades fixed → controlled unrack. Leg drive is encouraged, but hips must not lift."],
      technique: "Use consistent technique across all 15 working repetitions. Keep the glutes in contact with the bench throughout every rep.",
      guardrail: "If the hips lift, stop the set rather than continuing compensatory repetitions. If this recurs at 80 kg, reduce the working weight further. Allow adequate rest; stop or modify for pain or readiness concerns.",
      progression: "Do not automatically increase after one successful 80 kg session. First complete 80 kg × 5 × 3 twice with sound technique, appropriate reserve and recovery; only then consider 82.5 kg. Further adjustment takes priority if technique or symptoms warrant it.",
      restSeconds: 120,
      setPlan: [
        { label: "Warm-up 1", load: "20 kg", reps: "10" },
        { label: "Warm-up 2", load: "40 kg", reps: "5" },
        { label: "Warm-up 3", load: "60 kg", reps: "3" },
        { label: "Working set 1 — feet set, glutes planted, shoulder blades fixed, controlled unrack", load: "80 kg", reps: "5", rirRequired: true },
        { label: "Working set 2", load: "80 kg", reps: "5", rirRequired: true },
        { label: "Working set 3", load: "80 kg", reps: "5", rirRequired: true }
      ],
      assessmentFields: [
        { key: "gluteContact", label: "Glutes remained in contact with the bench for all working repetitions?", type: "select", options: ["Yes", "No"] },
        { key: "technique", label: "Technique comments", type: "textarea" }
      ]
    },
    {
      id: "conventional-deadlift-75kg-2x5-2026-09-23",
      block: "Controlled hinge",
      name: "Conventional deadlift",
      startMinute: 27,
      endMinute: 37,
      prescription: "Warm up: 40 kg × 5, 60 kg × 5. Then 75 kg × 5 × 2 at RIR 3–4, with smooth, technically clean reps and no meaningful increase in back symptoms. Fallback: 72.5 kg.",
      technique: "Brace, lift smoothly and reset on the floor between repetitions. Use a comfortable, repeatable setup without forcing a prolonged back arch.",
      guardrail: "Do not superset these sets. Allow at least two minutes between working sets and more if needed. Use 72.5 kg if recovery, warm-ups or symptoms warrant it. Stop for current neurological symptoms, meaningful back deterioration or technique alteration.",
      instructions: ["Review recovery and warm-up response before choosing 75 kg or the 72.5 kg fallback. Keep two working sets even if easy; no grinding. Check back response through warm-ups and working sets; stop or reduce for meaningful worsening."],
      progression: "Do not increase today or based on completion alone. Check next-morning back response, neurological symptoms and delayed reactions first. A meaningful delayed adverse response requires reassessment before progression.",
      restSeconds: 120,
      setPlan: [
        { label: "Warm-up 1", load: "40 kg", reps: "5" },
        { label: "Warm-up 2", load: "60 kg", reps: "5" },
        { label: "Working set 1", load: "75 kg", reps: "5", rirRequired: true },
        { label: "Working set 2", load: "75 kg", reps: "5", rirRequired: true }
      ],
      assessmentFields: [
        { key: "backResponse", label: "Back response across sets", type: "select", options: ["Better", "Same", "Worse"] },
        { key: "technique", label: "Technique, warm-up or symptom comments", type: "textarea" }
      ]
    },
    {
      id: "paired-rows-carries-2026-09-23",
      block: "Paired accessories",
      name: "Supported one-arm dumbbell row + Farmer’s carries",
      startMinute: 37,
      endMinute: 45,
      prescription: "Three rounds: row left → row right → farmer’s carry → rest. Rows: 24 kg per arm × 12 each side, RPE 5–7. Carries: 25 kg per hand × 45 seconds, RPE 5–7. Record the actual load for each entry.",
      instructions: [
        "Keep loads, row repetitions and carry duration unchanged: 24 kg per arm × 12 per side and 25 kg per hand × 45 seconds.",
        "If those loads are unavailable, repeat 23 kg rows or 23.6 kg carries; do not increase the prescribed load or compromise the equipment setup.",
        "Log each row pair and carry separately below. Rest 75 seconds after each round, longer if needed. If the workout approaches 50 minutes, reduce to two rounds rather than rushing the main lifts.",
        "Pair only when changing equipment is practical. Otherwise perform them separately. Finishing around 40 minutes is fine if work is complete without rushing; use up to 50 minutes when needed. If time runs out, leave omitted sets unchecked and explain in notes."
      ],
      technique: "Rows: keep the torso supported without momentum. Carries: walk tall with controlled turns and secure grip.",
      guardrail: "Reduce or stop for symptoms, loss of grip control or altered technique. Do not shorten needed rest to complete all rounds.",
      restSeconds: 75,
      setPlan: [
        { label: "Round 1 — Supported one-arm dumbbell row, both sides", load: "24 kg / arm", reps: "12 / side", rpeRequired: true },
        { label: "Round 1 — Farmer’s carry", load: "25 kg / hand", reps: "45 seconds", rpeRequired: true, timerSeconds: 45 },
        { label: "Round 2 — Supported one-arm dumbbell row, both sides", load: "24 kg / arm", reps: "12 / side", rpeRequired: true },
        { label: "Round 2 — Farmer’s carry", load: "25 kg / hand", reps: "45 seconds", rpeRequired: true, timerSeconds: 45 },
        { label: "Round 3 — Supported one-arm dumbbell row, both sides", load: "24 kg / arm", reps: "12 / side", rpeRequired: true },
        { label: "Round 3 — Farmer’s carry", load: "25 kg / hand", reps: "45 seconds", rpeRequired: true, timerSeconds: 45 }
      ]
    }
  ]
};
