window.CURRENT_WORKOUT = {
  schemaVersion: 1,
  id: "back-aware-strength-progression-2026-08-07-v1",
  publishedFor: "2026-08-07",
  durationMinutes: 40,
  title: "Cautious strength progression",
  purpose: "Continue the successful 5 August session by progressing bench press, consolidating supported rows and carefully reintroducing squatting while the back continues to improve.",
  targetEffort: "About RPE 5 overall. Keep at least three technically sound repetitions in reserve and finish capable of more.",
  safetySummary: "Stop or modify for sharp or increasing pain, new weakness or numbness, instability, altered movement, protective leaning, spasm, or symptoms that change your technique. Ordinary stiffness that improves with movement is acceptable context.",
  coachNote: "This is a direct progression from 5 August, not a new programme. Use the fallbacks early if the warm-up or technique says today is not the day to progress.",
  previousSession: {
    date: "2026-08-05",
    title: "Completed strength session",
    context: "Energy 3/10. Back 3/10 before and after; shoulder, neck and ankle 0/10 before and after. Overall RPE 3. Back was tight but improving. A pleasant, restorative 8.7 km easy cycle was completed on 6 August in about 22 minutes at an average heart rate of approximately 112 bpm.",
    results: [
      "Bench press — 65 kg, 3 sets of 5, RPE 4.5. Note: Careful, spiky back.",
      "Chest-supported dumbbell row — 17 kg, 10 repetitions, RPE 5. Set count was not recorded. Note: No response from back.",
      "Upper-back and shoulder finish — 10 each, RPE 3, including a 20-second hang."
    ]
  },
  steps: [
    {
      id: "readiness-warm-up-2026-08-07",
      block: "Readiness and warm-up",
      name: "Readiness check and warm-up",
      startMinute: 0,
      endMinute: 5,
      prescription: "Record readiness, then complete the sequence at an easy effort.",
      instructions: [
        "Easy march or cycle — 2 minutes.",
        "Shoulder-blade squeezes — 10 repetitions.",
        "Ankle rocks — 8 each side.",
        "Bodyweight box squats — 6–8 comfortable repetitions.",
        "Empty-bar bench press warm-up."
      ],
      guardrail: "Ordinary stiffness that improves with movement is acceptable. Stop or modify for sharp or increasing pain, neurological symptoms, instability or movement compensation.",
      setPlan: ["Empty-bar bench warm-up"]
    },
    {
      id: "bench-press-67-5kg-3x5",
      block: "Primary strength",
      name: "Bench press",
      startMinute: 5,
      endMinute: 17,
      prescription: "Warm up as appropriate, then 67.5 kg for 3 sets of 5 at RPE 5–6. Rest approximately 2 minutes. Fallback: repeat 65 kg for 3 × 5 if warm-ups feel unexpectedly difficult or symptoms increase.",
      technique: "Use a stable setup. Avoid exaggerated arching or aggressive leg drive while the back remains sensitive.",
      guardrail: "Stop if back or shoulder discomfort rises or changes technique. No grinding; retain at least three sound repetitions in reserve.",
      previousResult: "5 August: 65 kg for 3 × 5 at RPE 4.5. Note: Careful, spiky back.",
      progression: "If 67.5 kg for 3 × 5 is completed at RPE 6 or below with stable technique and no adverse next-day response, consider 70 kg next time. At RPE 7–8 or with mild concern, repeat 67.5 kg. If symptoms or technique worsen, return to 65 kg or modify.",
      restSeconds: 120,
      setPlan: ["Warm-up 1", "Warm-up 2", "Working set 1", "Working set 2", "Working set 3"]
    },
    {
      id: "chest-supported-dumbbell-row-17kg-3x10",
      block: "Supported pull",
      name: "Chest-supported dumbbell row",
      startMinute: 17,
      endMinute: 25,
      prescription: "17 kg for 3 sets of 10 at RPE 5–6. Rest 75–90 seconds.",
      technique: "Keep the chest supported, pause briefly at the top and lower under control. Avoid shrugging, twisting or torso movement.",
      guardrail: "Keep the neck comfortable and stop if back symptoms appear or support is lost.",
      previousResult: "5 August: 17 kg for 10 repetitions at RPE 5; the set count was not recorded. Note: No response from back.",
      progression: "Increase only after all three sets of 10 at 17 kg are clean and comfortably below RPE 7. Otherwise repeat 17 kg.",
      restSeconds: 90,
      setPlan: ["Set 1", "Set 2", "Set 3"]
    },
    {
      id: "goblet-squat-reintroduction-12kg",
      block: "Squat reintroduction",
      name: "Bodyweight box squat and 12 kg goblet squat",
      startMinute: 25,
      endMinute: 33,
      prescription: "Bodyweight box squat for 1 set of 8, then 12 kg goblet squat for 2 sets of 8 at a comfortable depth and no higher than RPE 5. Rest 75–90 seconds. Fallback: bodyweight box squats only if loaded squatting feels uncertain.",
      technique: "Use a repeatable box or target, keep the whole foot planted and move only through a comfortable depth. Do not chase depth.",
      guardrail: "Stop the loaded squat for sharp pain, spasm, protective leaning, altered movement or any symptom increase during either set.",
      progression: "If both 12 kg sets are symptom-free during the session and the following morning, add either one set or repetitions next time—not load, sets and repetitions together. Do not return to barbell squats solely because this exposure succeeds.",
      restSeconds: 90,
      setPlan: ["Bodyweight set", "12 kg set 1", "12 kg set 2"]
    },
    {
      id: "upper-back-shoulder-finish-2026-08-07",
      block: "Finish",
      name: "Upper-back and shoulder finish",
      startMinute: 33,
      endMinute: 37,
      prescription: "Complete 10 band pull-aparts or repetitions of the existing upper-back movement; 10 shoulder-control or external-rotation repetitions each side; then a relaxed supported hang for up to 20 seconds only if comfortable.",
      technique: "Use controlled repetitions and pain-free ranges. Keep the hang relaxed and supported.",
      guardrail: "Do not force an overhead position. Stop for pinching, apprehension or altered shoulder movement.",
      previousResult: "5 August: 10 each at RPE 3, with a 20-second hang; well tolerated.",
      setPlan: ["Upper-back movement", "Shoulder control — left", "Shoulder control — right", "Supported hang"]
    },
    {
      id: "optional-dead-bug-2x5",
      block: "Optional trunk work",
      name: "Dead bug or controlled brace",
      startMinute: 37,
      endMinute: 39,
      prescription: "Only if time remains and the back feels unchanged: 2 sets of 5 slow repetitions per side.",
      technique: "Use a comfortable range, breathe normally and keep the movement slow.",
      guardrail: "Skip this block if the back is more noticeable than at the start or if control cannot be maintained.",
      setPlan: ["Set 1", "Set 2"]
    },
    {
      id: "session-recap-2026-08-07",
      block: "Recap",
      name: "Record the session response",
      startMinute: 39,
      endMinute: 40,
      prescription: "Record actual load, sets, repetitions and RPE; immediate back, shoulder, neck and ankle scores; overall session RPE; apprehension response; pain or technique changes; and the next-morning response.",
      instructions: [
        "Did apprehension reduce, remain unchanged or increase?",
        "Was there any pain or technique alteration?",
        "What should be repeated or modified next time?"
      ],
      guardrail: "Record the response honestly. A fallback or skipped optional block is useful training information, not a failed session.",
      setPlan: []
    }
  ]
};
