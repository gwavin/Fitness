window.CURRENT_WORKOUT = {
  schemaVersion: 1,
  id: "controlled-strength-progression-2026-08-14-v1",
  publishedFor: "2026-08-14",
  durationMinutes: 50,
  title: "Friday controlled strength progression",
  purpose: "Continue conservative squat and bench progression, consolidate the new rowing load, and complete explicitly prescribed shoulder and scapular work.",
  targetEffort: "Submaximal, technically sound work. Record genuine reps in reserve without testing failure.",
  safetySummary: "Do not train through new numbness, weakness, radiating pain, meaningful pain increase, or symptom-driven technique alteration. Friday is controlled progression, not a strength test.",
  coachNote: "Squat progresses only if Wednesday produced no meaningful delayed back reaction and warm-ups feel normal. Bench stops at 75 kg today even if easy. Row stays at 21.6 kg. Complete all three prescribed scapular exercises.",
  rirGuide: "How many additional clean reps could you genuinely have completed? 5+ RIR is very submaximal; 4 RIR is about RPE 6; 3 about RPE 7; 2 about RPE 8; 1 about RPE 9; 0 about RPE 10. Do not deliberately test failure.",
  previousSession: {
    date: "2026-08-12",
    title: "Well-tolerated strength progression",
    context: "Squats improved across sets with mild muscular back awareness and 0/10 back pain after training. Shoulder, neck and ankle were 0/10; apprehension reduced; overall RPE 3; everything felt strong.",
    results: [
      "Squat — 47.5 kg × 5 × 3; RPE 3, 4 and 3.",
      "Bench press — 72.5 kg × 5 × 3; RPE 5 throughout and about 5 clean reps in reserve.",
      "Chest-supported row — 21.6 kg × 10 × 3 at RPE 4.",
      "Wall slides, internal/external rotation and face pulls completed."
    ]
  },
  steps: [
    {
      id: "readiness-2026-08-14",
      block: "Readiness",
      name: "Readiness and delayed-response check",
      startMinute: 0,
      endMinute: 3,
      prescription: "Record readiness and specifically note any delayed back reaction following Wednesday's squats.",
      instructions: [
        "If the back is essentially at baseline, neurological symptoms are absent and warm-ups feel normal, proceed towards 50 kg.",
        "If Wednesday produced a meaningful adverse back reaction, repeat 47.5 kg rather than progressing.",
        "Do not loaded-squat with new numbness, weakness, radiating pain or another neurological symptom."
      ],
      guardrail: "The scheduled 50 kg is conditional, not automatic.",
      setPlan: []
    },
    {
      id: "barbell-squat-50kg-3x5",
      block: "Rehabilitative progression",
      name: "Barbell squat",
      startMinute: 3,
      endMinute: 18,
      prescription: "Warm up with 20 kg × 10, 30 kg × 5 and 40 kg × 5. If readiness and warm-ups are reassuring, perform 50 kg for 3 sets of 5. Otherwise repeat 47.5 kg or reduce or stop according to symptoms.",
      technique: "Use controlled repetitions and the same stable pattern as Wednesday. Record actual reps and genuine RIR after each working set.",
      guardrail: "Do not automatically progress because 50 kg is scheduled. Stop or escalate appropriately for neurological symptoms, meaningful pain increase or symptom-driven technique alteration.",
      previousResult: "12 August: 47.5 kg × 5 × 3; RPE 3/4/3. Mild muscular back awareness; sets felt progressively better; back 0/10 afterward.",
      progression: "When working sets consistently approach 2–3 RIR, reassess the simple 2.5 kg progression rather than pushing towards failure.",
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
        { key: "finalRepSlowing", label: "Obvious slowing of final rep?", type: "select", options: ["No", "Yes"] },
        { key: "backResponse", label: "Back response", type: "select", options: ["Better", "Same", "Worse"] },
        { key: "technique", label: "Technique comments", type: "textarea" }
      ]
    },
    {
      id: "bench-press-75kg-3x5",
      block: "Strength progression",
      name: "Bench press",
      startMinute: 18,
      endMinute: 31,
      prescription: "Warm up with 20 kg × 10, 40 kg × 5 and 60 kg × 5, then perform 75 kg for 3 sets of 5. Do not increase the load during this session even if it feels very easy.",
      technique: "Use a repeatable setup and controlled descent. Record actual reps and genuine RIR after each working set.",
      guardrail: "Complete the prescribed sets without grinding or failure testing. Stop or reduce if shoulder symptoms or technique changes appear.",
      previousResult: "12 August: 72.5 kg × 5 × 3 at RPE 5, subsequently estimated at about 5 clean reps in reserve; shoulder comfortable.",
      progression: "Use today's RIR, rep slowing, technique and symptom response to determine the next increment.",
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
        { key: "finalRepSlowing", label: "Obvious slowing of final rep?", type: "select", options: ["No", "Yes"] },
        { key: "shoulderConfidence", label: "Shoulder confidence", type: "select", options: ["Better", "Same", "Worse"] },
        { key: "technique", label: "Technique comments", type: "textarea" }
      ]
    },
    {
      id: "chest-supported-row-21-6kg-3x10",
      block: "Consolidate load",
      name: "Chest-supported row",
      startMinute: 31,
      endMinute: 39,
      prescription: "Hold at 21.6 kg for 3 sets of 10. Record actual reps and RIR for every set. Rest 75–90 seconds.",
      technique: "Keep the chest supported and use controlled repetitions without momentum. Pause briefly and lower under control.",
      guardrail: "Do not increase the load today; consolidate the recent increase while squat and bench progress.",
      previousResult: "12 August: 21.6 kg × 10 × 3 at RPE 4; comfortable after the recent load increase.",
      restSeconds: 90,
      setPlan: [
        { label: "Set 1", load: "21.6 kg", reps: "10", rirRequired: true },
        { label: "Set 2", load: "21.6 kg", reps: "10", rirRequired: true },
        { label: "Set 3", load: "21.6 kg", reps: "10", rirRequired: true }
      ]
    },
    {
      id: "wall-slides-2x10",
      block: "Prescribed scapular work",
      name: "Wall slides",
      startMinute: 39,
      endMinute: 42,
      prescription: "Complete 2 sets of 10 with controlled, comfortable movement.",
      technique: "Prioritise movement quality and confidence rather than fatigue.",
      guardrail: "Use a comfortable range and stop for pinching or altered movement.",
      setPlan: [
        { label: "Set 1", load: "bodyweight", reps: "10" },
        { label: "Set 2", load: "bodyweight", reps: "10" }
      ]
    },
    {
      id: "band-external-rotation-2x12-15",
      block: "Prescribed scapular work",
      name: "Band external rotation",
      startMinute: 42,
      endMinute: 45,
      prescription: "Complete 2 sets of 12–15 each side using light resistance and controlled movement.",
      technique: "Keep the shoulder position comfortable and record the band used if useful.",
      guardrail: "This is movement-quality work, not progressive overload.",
      setPlan: [
        { label: "Set 1 — each side", load: "light band", reps: "12–15" },
        { label: "Set 2 — each side", load: "light band", reps: "12–15" }
      ]
    },
    {
      id: "face-pulls-2x12-15",
      block: "Prescribed scapular work",
      name: "Face pulls",
      startMinute: 45,
      endMinute: 48,
      prescription: "Complete 2 sets of 12–15 with controlled, comfortable repetitions.",
      technique: "Keep the neck relaxed and finish each repetition without momentum.",
      guardrail: "Prioritise shoulder and scapular movement quality rather than fatigue.",
      setPlan: [
        { label: "Set 1", load: "light band", reps: "12–15" },
        { label: "Set 2", load: "light band", reps: "12–15" }
      ]
    },
    {
      id: "session-recap-2026-08-14",
      block: "Recap",
      name: "End-of-session and next-morning response",
      startMinute: 48,
      endMinute: 50,
      prescription: "Review completed sets and exercise assessments, then finish to record the immediate and next-morning response.",
      instructions: [
        "Confirm RIR for every completed working strength set.",
        "Confirm final-rep slowing and symptom/confidence response for squat and bench.",
        "Return the next morning to record symptoms, stiffness or DOMS and any delayed reaction."
      ],
      guardrail: "Only explicitly completed sets are exported as performed work.",
      setPlan: []
    }
  ]
};
