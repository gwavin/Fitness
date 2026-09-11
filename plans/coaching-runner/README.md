# Coaching Workout Runner

This is a local-only workout runner whose duration is defined by the current reviewed prescription. It has no ChatGPT or OpenAI API integration and does not upload session data.

## Coaching handoff cycle

1. Gavin opens the Today’s Workout runner.
2. Gavin completes the reviewed session.
3. The runner records sets, responses and notes locally.
4. Gavin downloads the JSON or Markdown coaching handoff.
5. Gavin optionally downloads the audio reflection.
6. Gavin uploads the handoff and optional audio to ChatGPT.
7. ChatGPT assesses the response and produces a complete replacement `current-workout.js` plus a Codex update brief.
8. Gavin gives those files to Codex.
9. Codex validates, archives the previous prescription, replaces the current workout and reports the diff.
10. Gavin turns up for the next workout.

ChatGPT provides coaching synthesis and the next reviewed prescription; Codex performs repository implementation and validation. Private session information stays outside the public Git repository.

## Updating a prescription

Run `node scripts/validate-coaching-workout.mjs plans/coaching-runner/current-workout.js`. For a replacement: validate it first, archive the existing prescription under `workout-archive/`, replace the file, validate again, then run the static checks.

The Monday 14 September prescription allows 40–50 minutes with a 45-minute planning target: squat 65 kg × 5 × 3 (existing 60 kg fallback), bench 80 kg × 5 × 3, conventional deadlift 70 kg × 5 × 2, then three row/carry rounds. Each round logs 24 kg/arm × 10/side and 25 kg/hand × 40 seconds separately, with a 40-second inline carry timer. Squat warm-ups are 20 kg × 8, 30 kg × 5 and 50 kg × 3. Main-lift rests remain two minutes and accessory rest remains 75 seconds. Omit accessory sets if necessary rather than rush main lifts or shorten needed rest.

Baseline back above 2/10 or a materially worse warm-up response displays conservative fallback advice. The warm-up response is recorded above the squat sets and exported with assessments. Reported neurological/radiating symptoms disable squat set inputs; a worsening across-set response also displays caution. Actual fallback weights remain editable and are not silently substituted. Back and symptom comments remain available for both squat and deadlift, with next-morning follow-up retained.

Progression guidance is reviewed text, not an automatic calculation from logged RPE or RIR; warm-up RPE cannot change prescribed loads. All 15 clean bench working reps with the bum planted qualify for 82.5 kg at the following workout, subject to readiness. Another isolated bum lift means hold 80 kg; reduce only for meaningful technique deterioration, pain or readiness needs. Deadlift progression requires review of delayed response. Private session recaps remain outside this repository.

Recent completed sessions using the current prescription have an **Open recap** button for next-morning updates after reloading. Older prescription records remain stored but cannot be reopened against a different exercise definition; download the handoff before replacing a prescription.

Saving no longer silently drops sessions beyond the previous 30-session limit. All existing records are retained; if browser storage fills, the existing save-failure message advises copying the recap before leaving.
