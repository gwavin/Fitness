window.CURRENT_WORKOUT = {
  schemaVersion: 1,
  id: "controlled-strength-progression-2026-09-05-v1",
  publishedFor: "2026-09-05",
  durationMinutes: 45,
  trainingWindow: "40–50 minutes (45-minute planning target)",
  title: "Next controlled strength progression",
  purpose: "Progress the squat, supported row and carries; consolidate bench technique; use conventional deadlifts with a delayed-response check.",
  targetEffort: "Main lifts: at least 3 clean reps in reserve where possible. No grinding or rushed repetitions.",
  safetySummary: "Stop or modify for new neurological symptoms, meaningful symptom increase, or symptom-driven technique changes. A meaningful delayed adverse back response means reassess the deadlift before increasing it.",
  coachNote: "Squat 60 kg; bench stays at 80 kg; conventional deadlift 65 kg only if recovery and warm-ups are normal. Then pair rows and carries. Allow 40–50 minutes, aiming for about 45. The clock counts against that planning target; use up to five extra minutes for warm-ups, rest or transitions without rushing.",
  rirGuide: "RIR means additional clean reps available, without testing failure. RPE is perceived effort out of 10, not reps remaining. Accidental warm-up effort entries must not determine progression.",
  steps: [
    {
      id: "readiness-2026-09-05",
      block: "Readiness",
      name: "Readiness and recovery check",
      startMinute: 0,
      endMinute: 3,
      prescription: "Check recovery from the last session, especially next-morning back stiffness and neurological symptoms, before choosing today's loads.",
      instructions: [
        "Proceed only when recovered; the publication date is not an instruction to train on consecutive days.",
        "Use squat warm-ups to confirm 60 kg. If they feel different, use 57.5 kg only if symptoms settle and movement feels normal; otherwise reduce or stop.",
        "For conventional deadlifts, do not progress after a meaningful delayed adverse response. Reassess first; repeat 60 kg only if recovery and warm-ups are normal.",
        "Keep squat, bench and deadlift working sets separate. Rest at least the planned two minutes, and longer if needed. Time blocks are guides; omit accessory work rather than rush."
      ],
      guardrail: "New numbness, weakness or radiating symptoms: stop loaded work and seek assessment.",
      setPlan: []
    },
    {
      id: "barbell-squat-60kg-3x5-2026-09-05",
      block: "Controlled progression",
      name: "Barbell squat",
      startMinute: 3,
      endMinute: 15,
      prescription: "Warm up: 20 kg × 8, 30 kg × 5, 40 kg × 5. Then 60 kg × 5 × 3, targeting at least 3 RIR.",
      technique: "Controlled repetitions with a repeatable setup. Monitor back response across sets.",
      guardrail: "If warm-ups feel different, use 57.5 kg only if symptoms settle and feel normal; otherwise reduce or stop. Stop for neurological symptoms or meaningful deterioration.",
      progression: "Review technique, RIR and delayed response before any further increase.",
      restSeconds: 120,
      safetyGate: "squat",
      setPlan: [
        { label: "Warm-up 1", load: "20 kg", reps: "8" },
        { label: "Warm-up 2", load: "30 kg", reps: "5" },
        { label: "Warm-up 3", load: "40 kg", reps: "5" },
        { label: "Working set 1", load: "60 kg", reps: "5", rirRequired: true },
        { label: "Working set 2", load: "60 kg", reps: "5", rirRequired: true },
        { label: "Working set 3", load: "60 kg", reps: "5", rirRequired: true }
      ],
      assessmentFields: [
        { key: "usedFallback", label: "Used 57.5 kg fallback?", type: "select", options: ["No", "Yes"] },
        { key: "backResponse", label: "Back response across sets", type: "select", options: ["Better", "Same", "Worse"] },
        { key: "technique", label: "Technique or symptom comments", type: "textarea" }
      ]
    },
    {
      id: "bench-press-80kg-3x5-2026-09-05",
      block: "Technique consolidation",
      name: "Bench press",
      startMinute: 15,
      endMinute: 27,
      prescription: "Warm up: 20 kg × 10, 40 kg × 5, 60 kg × 3. Then 80 kg × 5 × 3. Do not increase the load yet.",
      instructions: ["Before each working set: Feet set → glutes squeezed → shoulder blades fixed → unrack."],
      technique: "Keep the bum firmly planted throughout every repetition. Use a secure setup without forcing an exaggerated arch.",
      guardrail: "No grinding. Rest longer or reduce load if contact cannot be maintained or clean reps run out; stop for pain or meaningful symptom change.",
      progression: "If all 15 working reps at 80 kg keep the bum firmly planted, consider 82.5 kg at the following workout only if reps remain controlled, recovery is normal and effort leaves a repeatable reserve. A further small bum lift means hold at 80 kg, even if pain-free. Planted reps alone do not override excessive effort or symptoms.",
      restSeconds: 120,
      setPlan: [
        { label: "Warm-up 1", load: "20 kg", reps: "10" },
        { label: "Warm-up 2", load: "40 kg", reps: "5" },
        { label: "Warm-up 3", load: "60 kg", reps: "3" },
        { label: "Working set 1 — feet set, glutes squeezed, shoulder blades fixed, unrack", load: "80 kg", reps: "5", rirRequired: true },
        { label: "Working set 2", load: "80 kg", reps: "5", rirRequired: true },
        { label: "Working set 3", load: "80 kg", reps: "5", rirRequired: true }
      ],
      assessmentFields: [
        { key: "bumContact", label: "Bum planted for all 15 working reps?", type: "select", options: ["Yes", "No"] },
        { key: "technique", label: "Technique comments", type: "textarea" }
      ]
    },
    {
      id: "conventional-deadlift-65kg-3x5-2026-09-05",
      block: "Controlled hinge",
      name: "Conventional deadlift",
      startMinute: 27,
      endMinute: 37,
      prescription: "Use gradual warm-up sets as needed, then 65 kg × 5 × 3 at RIR ≥3 only if recovery and warm-ups are normal. Log warm-ups in the notes.",
      technique: "Brace, lift smoothly and reset on the floor between repetitions. Use a comfortable, repeatable setup without forcing a prolonged back arch.",
      guardrail: "Do not superset these sets. Allow at least two minutes between working sets and more if needed. Reduce to 60 kg if effort exceeds target; stop for meaningful back deterioration, new neurological symptoms or technique alteration.",
      progression: "Do not increase based on completion alone. Check next-morning back response, neurological symptoms and delayed reactions first. A meaningful delayed adverse response requires reassessment before progression.",
      restSeconds: 120,
      setPlan: [
        { label: "Working set 1", load: "65 kg", reps: "5", rirRequired: true },
        { label: "Working set 2", load: "65 kg", reps: "5", rirRequired: true },
        { label: "Working set 3", load: "65 kg", reps: "5", rirRequired: true }
      ],
      assessmentFields: [
        { key: "backResponse", label: "Back response across sets", type: "select", options: ["Better", "Same", "Worse"] },
        { key: "technique", label: "Technique, warm-up or symptom comments", type: "textarea" }
      ]
    },
    {
      id: "paired-rows-carries-2026-09-05",
      block: "Paired accessories",
      name: "Supported one-arm dumbbell row + Farmer’s carries",
      startMinute: 37,
      endMinute: 45,
      prescription: "Three rounds: row left → row right → farmer’s carry → rest. Rows: nearest safe 24–25 kg per arm × 8 each side, RPE 5–7. Carries: nearest safe 25–26 kg per hand × 30 seconds, RPE 5–6. Record the actual load for each entry.",
      instructions: [
        "Defaults are 24 kg per arm for rows and 25 kg per hand for carries; use the nearest securely configurable load within the stated range.",
        "If those loads are unavailable, repeat 23 kg rows or 23.6 kg carries; do not round above the range or compromise the equipment setup.",
        "Log each row pair and carry separately below. Rest 75 seconds after each round, longer if needed. Rest between exercises too if grip or technique needs it.",
        "Pair only when changing equipment is practical. Otherwise perform them separately. Finishing around 40 minutes is fine if work is complete without rushing; use up to 50 minutes when needed. If time runs out, leave omitted sets unchecked and explain in notes."
      ],
      technique: "Rows: keep the torso supported without momentum. Carries: walk tall with controlled turns and secure grip.",
      guardrail: "Reduce or stop for symptoms, loss of grip control or altered technique. Do not shorten needed rest to complete all rounds.",
      restSeconds: 75,
      setPlan: [
        { label: "Round 1 — Supported one-arm dumbbell row, both sides", load: "24 kg / arm", reps: "8 / side", rpeRequired: true },
        { label: "Round 1 — Farmer’s carry", load: "25 kg / hand", reps: "30 seconds", rpeRequired: true, timerSeconds: 30 },
        { label: "Round 2 — Supported one-arm dumbbell row, both sides", load: "24 kg / arm", reps: "8 / side", rpeRequired: true },
        { label: "Round 2 — Farmer’s carry", load: "25 kg / hand", reps: "30 seconds", rpeRequired: true, timerSeconds: 30 },
        { label: "Round 3 — Supported one-arm dumbbell row, both sides", load: "24 kg / arm", reps: "8 / side", rpeRequired: true },
        { label: "Round 3 — Farmer’s carry", load: "25 kg / hand", reps: "30 seconds", rpeRequired: true, timerSeconds: 30 }
      ]
    }
  ]
};
