window.CURRENT_WORKOUT = {
  schemaVersion: 1,
  id: "controlled-strength-progression-2026-09-21-v1",
  publishedFor: "2026-09-21",
  durationMinutes: 45,
  trainingWindow: "40–50 minutes (45-minute planning target)",
  title: "Next controlled strength progression",
  purpose: "Progress the squat, supported row and carries; consolidate bench technique; use conventional deadlifts with a delayed-response check.",
  targetEffort: "Squat and deadlift: RIR ≥3. Bench: 15 clean reps with bum planted. Controlled reps without grinding.",
  safetySummary: "Stop or modify for new neurological symptoms, meaningful symptom increase, or symptom-driven technique changes. A meaningful delayed adverse back response means reassess the deadlift before increasing it.",
  coachNote: "Squat 72.5 kg (70 kg if warm-up back discomfort progressively worsens); bench stays at 82.5 kg; conventional deadlift 72.5 kg for two sets, or repeat 70 kg after a meaningful delayed response. Then three row/carry rounds: 24 kg × 12 per side and 25 kg × 45 seconds. Check back response before and during training. Allow 40–50 minutes, aiming for about 45. The clock counts against that planning target; use up to five extra minutes for warm-ups, rest or transitions without rushing.",
  rirGuide: "RIR means additional clean reps available, without testing failure. RPE is perceived effort out of 10, not reps remaining. Accidental warm-up effort entries must not determine progression.",
  steps: [
    {
      id: "readiness-2026-09-21",
      block: "Readiness",
      name: "Readiness and recovery check",
      startMinute: 0,
      endMinute: 3,
      prescription: "Check recovery from the last session, especially next-morning back stiffness and neurological symptoms, before choosing today's loads.",
      instructions: [
        "Proceed only when recovered; the publication date is not an instruction to train on consecutive days.",
        "Review baseline back discomfort above 2/10 before progressing. Use the 70 kg squat fallback if discomfort progressively worsens during warm-ups, only if movement remains comfortable and controlled; otherwise reduce or stop. Transient mild stiffness that settles with movement does not by itself require fallback.",
        "Before deadlifts, review the previous next-morning response. Meaningfully worse back symptoms or any new neurological symptoms mean no progression: repeat 70 kg × 5 × 2 only when symptoms have settled and readiness permits loaded work. Ongoing neurological symptoms require reassessment.",
        "Keep squat, bench and deadlift working sets separate. Rest at least the planned two minutes, and longer if needed. Time blocks are guides; omit accessory work rather than rush."
      ],
      guardrail: "New numbness, weakness or radiating symptoms: stop loaded work and seek assessment.",
      setPlan: []
    },
    {
      id: "barbell-squat-72.5kg-3x5-2026-09-21",
      block: "Controlled progression",
      name: "Barbell squat",
      startMinute: 3,
      endMinute: 15,
      prescription: "Warm up: 20 kg × 8, 40 kg × 5, 55 kg × 3; optional 65 kg × 1–2 if useful. Then 72.5 kg × 5 × 3 at RIR ≥3. Fallback: 70 kg × 5 × 3 if warm-up back discomfort progressively worsens.",
      instructions: ["Check back response during warm-ups. Progressively worsening discomfort calls for 70 kg if comfortable and controlled, otherwise reduce or stop. Mild stiffness that settles with movement does not by itself trigger fallback. Leave the optional warm-up unchecked if omitted."],
      technique: "Controlled, confident repetitions with a repeatable setup. Monitor back response across sets.",
      guardrail: "Keep technique controlled and back response stable. Use 70 kg for progressively worsening warm-up discomfort only if movement remains comfortable; otherwise reduce or stop. Stop loaded work for neurological symptoms.",
      progression: "Review technique, RIR and delayed response before any further increase.",
      restSeconds: 120,
      safetyGate: "squat",
      setPlan: [
        { label: "Warm-up 1", load: "20 kg", reps: "8" },
        { label: "Warm-up 2", load: "40 kg", reps: "5" },
        { label: "Warm-up 3", load: "55 kg", reps: "3" },
        { label: "Optional warm-up", load: "65 kg", reps: "1–2" },
        { label: "Working set 1", load: "72.5 kg", reps: "5", rirRequired: true },
        { label: "Working set 2", load: "72.5 kg", reps: "5", rirRequired: true },
        { label: "Working set 3", load: "72.5 kg", reps: "5", rirRequired: true }
      ],
      assessmentFields: [
        { key: "warmupResponse", label: "Back response during warm-ups", type: "select", options: ["Normal / settled", "Progressively worse", "Neurological / radiating symptoms"] },
        { key: "usedFallback", label: "Used 70 kg fallback?", type: "select", options: ["No", "Yes"] },
        { key: "backResponse", label: "Back response across sets", type: "select", options: ["Better", "Same", "Worse"] },
        { key: "technique", label: "Technique or symptom comments", type: "textarea" }
      ]
    },
    {
      id: "bench-press-82.5kg-3x5-2026-09-21",
      block: "Technique consolidation",
      name: "Bench press",
      startMinute: 15,
      endMinute: 27,
      prescription: "Warm up: 20 kg × 10, 40 kg × 5, 60 kg × 3. Then 82.5 kg × 5 × 3. Do not increase the load yet.",
      instructions: ["Before each working set: Feet set → glutes squeezed → shoulder blades fixed → unrack."],
      technique: "Keep the bum firmly planted throughout every repetition. Use a secure setup without forcing an exaggerated arch.",
      guardrail: "An isolated bum lift means repeat 82.5 kg next time. If technique deteriorates materially or reps become genuine grinders, use 80 kg for remaining sets if necessary. Allow adequate rest; stop or modify for pain or readiness concerns.",
      progression: "All 15 clean working reps at 82.5 kg with the bum planted qualify for 85 kg at the following workout, subject to readiness. Another isolated bum lift means repeat 82.5 kg. Today stays at 82.5 kg; record RIR for all three sets.",
      restSeconds: 120,
      setPlan: [
        { label: "Warm-up 1", load: "20 kg", reps: "10" },
        { label: "Warm-up 2", load: "40 kg", reps: "5" },
        { label: "Warm-up 3", load: "60 kg", reps: "3" },
        { label: "Working set 1 — feet set, glutes squeezed, shoulder blades fixed, unrack", load: "82.5 kg", reps: "5", rirRequired: true },
        { label: "Working set 2", load: "82.5 kg", reps: "5", rirRequired: true },
        { label: "Working set 3", load: "82.5 kg", reps: "5", rirRequired: true }
      ],
      assessmentFields: [
        { key: "bumContact", label: "Bum planted for all 15 working reps?", type: "select", options: ["Yes", "No"] },
        { key: "technique", label: "Technique comments", type: "textarea" }
      ]
    },
    {
      id: "conventional-deadlift-72.5kg-2x5-2026-09-21",
      block: "Controlled hinge",
      name: "Conventional deadlift",
      startMinute: 27,
      endMinute: 37,
      prescription: "Warm up: 40 kg × 5, 60 kg × 3–5. Then 72.5 kg × 5 × 2 at approximately RIR ≥3, with smooth, technically clean reps and no meaningful increase in back symptoms.",
      technique: "Brace, lift smoothly and reset on the floor between repetitions. Use a comfortable, repeatable setup without forcing a prolonged back arch.",
      guardrail: "Do not superset these sets. Allow at least two minutes between working sets and more if needed. Use 70 kg × 5 × 2 after meaningful delayed back worsening or new neurological symptoms from the previous session, only once symptoms have settled and readiness permits. Stop for current neurological symptoms, meaningful back deterioration or technique alteration.",
      instructions: ["Review the previous next-morning response before choosing 72.5 kg or the 70 kg fallback. Keep two working sets even if easy; no grinding. Check back response through warm-ups and working sets; stop or reduce for meaningful worsening."],
      progression: "Do not increase today or based on completion alone. Check next-morning back response, neurological symptoms and delayed reactions first. A meaningful delayed adverse response requires reassessment before progression.",
      restSeconds: 120,
      setPlan: [
        { label: "Warm-up 1", load: "40 kg", reps: "5" },
        { label: "Warm-up 2", load: "60 kg", reps: "3–5" },
        { label: "Working set 1", load: "72.5 kg", reps: "5", rirRequired: true },
        { label: "Working set 2", load: "72.5 kg", reps: "5", rirRequired: true }
      ],
      assessmentFields: [
        { key: "backResponse", label: "Back response across sets", type: "select", options: ["Better", "Same", "Worse"] },
        { key: "technique", label: "Technique, warm-up or symptom comments", type: "textarea" }
      ]
    },
    {
      id: "paired-rows-carries-2026-09-21",
      block: "Paired accessories",
      name: "Supported one-arm dumbbell row + Farmer’s carries",
      startMinute: 37,
      endMinute: 45,
      prescription: "Three rounds: row left → row right → farmer’s carry → rest. Rows: 24 kg per arm × 12 each side, RPE 5–7. Carries: 25 kg per hand × 45 seconds, RPE 5–7. Record the actual load for each entry.",
      instructions: [
        "Keep loads at 24 kg per arm for rows and 25 kg per hand for carries. Only reps (10 → 12) and carry time (40 → 45 seconds) progress.",
        "If those loads are unavailable, repeat 23 kg rows or 23.6 kg carries; do not increase the prescribed load or compromise the equipment setup.",
        "Log each row pair and carry separately below. Rest 75 seconds after each round, longer if needed. Rest between exercises too if grip or technique needs it.",
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
