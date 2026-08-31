window.CURRENT_WORKOUT = {
  schemaVersion: 1,
  id: "controlled-strength-progression-2026-08-17-v1",
  publishedFor: "2026-08-17",
  durationMinutes: 42,
  title: "Monday controlled strength progression",
  purpose: "Add one squat working set at Friday's load, progress bench conditionally, repeat the supported row, and finish with brief low-back-friendly conditioning and trunk work.",
  targetEffort: "Controlled, technically sound work with approximately 3–5 reps in reserve. No grinding or maximal efforts.",
  safetySummary: "Stop or modify for new neurological disturbance, substantial deterioration, pain clearly aggravated during warm-up, meaningful symptom increase across sets, or symptom-driven technique alteration. Stopping squat work early is a valid training decision, not a failed workout.",
  coachNote: "Change only one squat variable: keep 50 kg and add the third working set. Bench may use 75 kg, with 72.5 kg available if difficulty or technique says so. Keep the one-arm row supported.",
  rirGuide: "How many additional clean reps could you genuinely have completed? Record RIR without deliberately testing failure. Target about 4–5 RIR for squat and 3–5 RIR for bench.",
  previousSession: {
    date: "2026-08-14",
    title: "Controlled Friday strength session",
    context: "Energy 4/5; back 2/10; no significant shoulder, neck or ankle symptoms. The recent muscular lower-back flare has been steadily improving.",
    results: [
      "Squat — 50 kg × 5 × 2 working sets at approximately 5 RIR after 20/30/40 kg warm-ups.",
      "Bench press — 72.5 kg × 5 × 2 working sets at approximately 5 RIR after 20/40/60 kg warm-ups.",
      "Supported one-arm dumbbell row — 20 kg × 8 × 3 each side.",
      "Finisher — 2-minute march and 1-minute side plank each side."
    ]
  },
  steps: [
    {
      id: "readiness-2026-08-17",
      block: "Readiness",
      name: "Readiness and back check",
      startMinute: 0,
      endMinute: 3,
      prescription: "Record readiness and note any delayed or morning back response before beginning the squat warm-up.",
      instructions: [
        "Proceed only while symptoms remain stable and warm-ups feel normal.",
        "If there is substantial deterioration or pain is clearly aggravated during warm-up, reduce or stop rather than pushing through.",
        "Do not loaded-squat with new numbness, weakness, radiating pain or another neurological symptom."
      ],
      guardrail: "The readiness result and warm-up response govern the squat. Ending squat work early does not invalidate the rest of the session.",
      setPlan: []
    },
    {
      id: "barbell-squat-50kg-3x5-2026-08-17",
      block: "Rehabilitative progression",
      name: "Barbell squat",
      startMinute: 3,
      endMinute: 18,
      prescription: "Warm up with 20 kg × 10, 30 kg × 5 and 40 kg × 5, then perform 50 kg for 3 sets of 5 at roughly 4–5 RIR. Keep the same load as Friday; the third working set is the only progression.",
      technique: "Use controlled repetitions and monitor the back through each successive set. Record actual reps and RIR separately.",
      guardrail: "Do not increase squat weight. If the back becomes meaningfully worse during warm-up or successive sets, stop squat work and continue only with exercises that remain comfortable.",
      previousResult: "14 August: 50 kg × 5 × 2 at approximately 5 RIR after 20/30/40 kg warm-ups.",
      progression: "Change only one squat variable at a time. Today's additional set is enough progression.",
      restSeconds: 120,
      safetyGate: "squat",
      setPlan: [
        { label: "Warm-up 1", load: "20 kg", reps: "10" },
        { label: "Warm-up 2", load: "30 kg", reps: "5" },
        { label: "Warm-up 3", load: "40 kg", reps: "5" },
        { label: "Working set 1", load: "50 kg", reps: "5", rirRequired: true },
        { label: "Working set 2", load: "50 kg", reps: "5", rirRequired: true },
        { label: "Working set 3", load: "50 kg", reps: "5", rirRequired: true }
      ],
      assessmentFields: [
        { key: "backResponse", label: "Back response across sets", type: "select", options: ["Better", "Same", "Worse"] },
        { key: "technique", label: "Technique or symptom comments", type: "textarea" }
      ]
    },
    {
      id: "bench-press-75kg-3x5-2026-08-17",
      block: "Strength progression",
      name: "Bench press",
      startMinute: 18,
      endMinute: 31,
      prescription: "Warm up with 20 kg × 10, 40 kg × 5 and 60 kg × 5, then perform 75 kg for 3 sets of 5 at approximately 3–5 RIR. Use 72.5 kg instead if 75 kg feels unexpectedly difficult or technique deteriorates.",
      technique: "Use a repeatable setup and controlled descent. Record the actual load, reps and RIR for every working set.",
      guardrail: "No grinding repetitions. The 72.5 kg fallback is an appropriate adjustment, not a missed target.",
      previousResult: "14 August: 72.5 kg × 5 × 2 at approximately 5 RIR after 20/40/60 kg warm-ups.",
      progression: "Use actual RIR and technique quality to guide the next session rather than forcing the scheduled load.",
      restSeconds: 120,
      setPlan: [
        { label: "Warm-up 1", load: "20 kg", reps: "10" },
        { label: "Warm-up 2", load: "40 kg", reps: "5" },
        { label: "Warm-up 3", load: "60 kg", reps: "5" },
        { label: "Working set 1", load: "75 kg", reps: "5", rirRequired: true },
        { label: "Working set 2", load: "75 kg", reps: "5", rirRequired: true },
        { label: "Working set 3", load: "75 kg", reps: "5", rirRequired: true }
      ],
      assessmentFields: [
        { key: "usedFallback", label: "Used 72.5 kg fallback?", type: "select", options: ["No", "Yes"] },
        { key: "technique", label: "Technique comments", type: "textarea" }
      ]
    },
    {
      id: "supported-one-arm-row-20kg-3x8",
      block: "Supported pull",
      name: "Supported one-arm dumbbell row",
      startMinute: 31,
      endMinute: 38,
      prescription: "Use 20 kg for 3 sets of 8 each side. Keep the torso supported to minimise unnecessary lower-back loading.",
      technique: "Brace against a stable bench or support, avoid torso rotation and lower the dumbbell under control.",
      guardrail: "Stop or change the setup if back loading becomes noticeable or support is lost.",
      previousResult: "14 August: 20 kg × 8 × 3 each side.",
      restSeconds: 90,
      setPlan: [
        { label: "Set 1 — each side", load: "20 kg", reps: "8" },
        { label: "Set 2 — each side", load: "20 kg", reps: "8" },
        { label: "Set 3 — each side", load: "20 kg", reps: "8" }
      ]
    },
    {
      id: "march-and-side-planks-2026-08-17",
      block: "Finisher and trunk work",
      name: "March and side planks",
      startMinute: 38,
      endMinute: 42,
      prescription: "March for 2 minutes, then hold a side plank for 1 minute on the left and 1 minute on the right. Use the workout timer or adjustable rest timer to time each interval.",
      technique: "Keep the march easy. Use a side-plank variation that allows steady breathing and comfortable trunk control.",
      guardrail: "Shorten or stop a hold if the back becomes more noticeable or position deteriorates.",
      restSeconds: 60,
      setPlan: [
        { label: "March", load: "bodyweight", reps: "2 minutes" },
        { label: "Side plank — left", load: "bodyweight", reps: "1 minute" },
        { label: "Side plank — right", load: "bodyweight", reps: "1 minute" }
      ]
    }
  ]
};
