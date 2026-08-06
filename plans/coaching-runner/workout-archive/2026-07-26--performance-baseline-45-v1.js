window.CURRENT_WORKOUT = {
  schemaVersion: 1,
  id: "performance-baseline-45-v1",
  publishedFor: "2026-07-26",
  durationMinutes: 45,
  title: "45-minute performance baseline",
  purpose: "Establish strong, repeatable numbers while keeping sensible guardrails around the shoulder, neck and ankle.",
  targetEffort: "Benchmark work at about RPE 7, with roughly three good reps left in reserve.",
  safetySummary: "Stop for sharp or increasing pain, instability, new numbness or weakness, dizziness, chest pain, unusual shortness of breath, or symptoms that change your movement.",
  coachNote: "This is a baseline, not a test. Record clean work that you could reproduce again.",
  steps: [
    {
      id: "readiness-warm-up",
      block: "Warm-up",
      name: "Readiness and warm-up",
      startMinute: 0,
      endMinute: 7,
      prescription: "Complete the sequence at an easy, conversational effort.",
      instructions: [
        "Brisk walk or easy march — 2 minutes.",
        "Gentle neck turns — 5 each side, through a comfortable range.",
        "Shoulder-blade squeezes and band pull-aparts — 8 slow reps each.",
        "Ankle rocks holding support — 8 each side, heel down.",
        "Box squats to a comfortable height — 6 easy reps."
      ],
      guardrail: "Ordinary stiffness that settles is useful context. Scale back or stop if the warm-up clearly worsens symptoms or changes your movement.",
      setPlan: []
    },
    {
      id: "goblet-box-squat",
      block: "Strength",
      name: "Goblet box squat",
      startMinute: 7,
      endMinute: 12,
      prescription: "One easy rehearsal set; 6–8 benchmark reps at RPE 7; then reduce the load by about 10% for 8 controlled reps.",
      technique: "Hold one dumbbell at the chest, sit between the hips until you lightly touch the box, then drive the floor away. Keep the whole foot planted and knees tracking with the toes.",
      guardrail: "Choose a box height that lets the ankle feel stable. Do not chase depth or bounce off the box.",
      setPlan: ["Rehearsal", "Benchmark", "Back-off"]
    },
    {
      id: "chest-supported-row",
      block: "Strength",
      name: "Chest-supported dumbbell row",
      startMinute: 12,
      endMinute: 17,
      prescription: "One easy rehearsal set; 6–8 benchmark reps at RPE 7; then reduce the load by about 10% for 8 controlled reps.",
      technique: "Lie chest-down on a slightly inclined bench. Pull the elbows towards the back pockets, pause briefly, and lower fully under control.",
      guardrail: "Keep the neck long and shoulders away from the ears. Stop before shrugging or twisting begins.",
      setPlan: ["Rehearsal", "Benchmark", "Back-off"]
    },
    {
      id: "dumbbell-rdl",
      block: "Strength",
      name: "Dumbbell Romanian deadlift",
      startMinute: 17,
      endMinute: 22,
      prescription: "One easy rehearsal set; 6–8 benchmark reps at RPE 7; then reduce the load by about 10% for 8 controlled reps.",
      technique: "Soften the knees, push the hips back and keep the dumbbells close to the legs. Stand by driving the hips forward rather than leaning back.",
      guardrail: "Finish the descent when the hamstrings are loaded and the back remains neutral. Range is not the score.",
      setPlan: ["Rehearsal", "Benchmark", "Back-off"]
    },
    {
      id: "neutral-grip-floor-press",
      block: "Strength",
      name: "Neutral-grip dumbbell floor press",
      startMinute: 22,
      endMinute: 27,
      prescription: "One easy rehearsal set; 6–8 benchmark reps at RPE 7; then reduce the load by about 10% for 8 controlled reps.",
      technique: "Lie on the floor with palms facing each other and elbows about 30–45 degrees from the body. Press smoothly without forcing the shoulders forward.",
      guardrail: "Use a modest load and stop for pinching or increasing shoulder pain. This is a tolerance benchmark, not a pressing contest.",
      setPlan: ["Rehearsal", "Benchmark", "Back-off"]
    },
    {
      id: "foot-assisted-pull-up",
      block: "Strength",
      name: "Foot-assisted pull-up",
      startMinute: 27,
      endMinute: 33,
      prescription: "Complete 3 sets of 3–6 smooth reps. Record the box height and whether one or two feet assisted you.",
      technique: "Use a secure bar low enough to keep one or both feet on a box. Start with long arms, lightly push through the feet as needed, and pull the chest towards the bar.",
      guardrail: "No uncontrolled hanging. Substitute an incline bodyweight row if the overhead start position is uncomfortable.",
      setPlan: ["Set 1", "Set 2", "Set 3"]
    },
    {
      id: "ankle-and-calf",
      block: "Finish",
      name: "Single-leg balance and calf raise",
      startMinute: 33,
      endMinute: 38,
      prescription: "One stable single-leg hold per side, up to 30 seconds; then one controlled calf-raise set per side, stopping at technical fatigue or 15 reps.",
      technique: "Stand beside support. A fingertip save is fine; record it rather than disguising it.",
      guardrail: "Stop if the ankle feels unstable or increasingly painful.",
      setPlan: ["Left", "Right"]
    },
    {
      id: "brisk-conditioning",
      block: "Finish",
      name: "Brisk conditioning",
      startMinute: 38,
      endMinute: 43,
      prescription: "Walk briskly, march, or use a light step-up rhythm for 5 minutes. Breathing should rise, but you should still be able to speak a full sentence.",
      technique: "Record the activity and either distance, steps or pace in the notes.",
      guardrail: "Reduce the pace if movement becomes awkward or the talk test is lost unexpectedly.",
      setPlan: ["5 minutes"]
    },
    {
      id: "session-recap",
      block: "Recap",
      name: "Record the immediate response",
      startMinute: 43,
      endMinute: 45,
      prescription: "Record overall session effort and the immediate shoulder, neck and ankle response. Add a short written or spoken reflection.",
      instructions: [
        "What felt strong?",
        "What limited you?",
        "What should be repeated, changed or discussed before the next workout?"
      ],
      guardrail: "Record symptoms honestly. The recap is information for the next coaching conversation, not a pass/fail score.",
      setPlan: []
    }
  ]
};
