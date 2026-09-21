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

The Wednesday 23 September prescription allows 40–50 minutes with a 45-minute planning target: squat 75 kg × 5 × 3, bench 80 kg × 5 × 3, conventional deadlift 75 kg × 5 × 2, then three unchanged row/carry rounds. Each round logs 24 kg/arm × 12/side and 25 kg/hand × 45 seconds separately, with a 45-second inline carry timer. Main-lift rests remain two minutes and accessory rest remains 75 seconds. Reduce accessories to two rounds if the session approaches 50 minutes rather than rush main lifts or shorten needed rest.

Baseline back above 2/10 calls for review. Recovery, warm-up performance or symptoms can trigger the 72.5 kg squat fallback when movement remains comfortable. The warm-up response is recorded above the squat sets and exported with assessments. Reported neurological/radiating symptoms disable squat set inputs; a worsening across-set response also displays caution. Actual fallback weights remain editable and are not silently substituted. The deadlift also uses a 72.5 kg fallback when readiness, warm-ups or symptoms do not support 75 kg. Current neurological symptoms still require reassessment. Back and symptom comments and next-morning follow-up remain available.

Progression guidance is reviewed text, not an automatic calculation from logged RPE or RIR; warm-up RPE cannot change prescribed loads. Bench is reduced to 80 kg and must be completed for two sessions before 82.5 kg is considered, subject to technique, reserve and recovery. The structured glute-contact answer is retained in text and JSON recaps. Any hip lift ends that set; recurrence at 80 kg calls for further load reduction rather than automatic progression. Private session recaps remain outside this repository.

Recent completed sessions using the current prescription have an **Open recap** button for next-morning updates after reloading. Older prescription records remain stored but cannot be reopened against a different exercise definition; download the handoff before replacing a prescription.

Saving no longer silently drops sessions beyond the previous 30-session limit. All existing records are retained; if browser storage fills, the existing save-failure message advises copying the recap before leaving.

## Set logging and validation

Each exercise has a separate set array indexed by prescribed set. Valid field edits save immediately to browser localStorage; there is no separate per-set submit action. Load/reps start with prescription defaults, so those values alone are not proof that the set was performed. The Completed checkbox determines inclusion in completed work in both readable and JSON recaps. Entered-but-unchecked results remain stored but are excluded from completed work. Navigating or reloading preserves valid saved entries.

On Finish and recap, prescribed working sets (required RIR/RPE, excluding warm-ups) without a completed, structured result trigger a confirmation. The user can cancel to review or complete anyway. Missing sets are listed separately in the readable recap and in the additive JSON `unrecordedPrescribedSets` field. No missing results are fabricated and no checkbox is automatically selected.

All set RPE inputs, including warm-ups, and overall session effort accept finite values from 0 through 10. Invalid input stays editable with an inline error, is not saved or clamped, and must be corrected or cleared before navigation/export. The last valid stored value is retained. Blank optional RPE is allowed; existing required working-set effort checks remain.

The September missing-set investigation cannot establish what happened on the user's device: there is no event audit trail or server copy. Tests reproduced entries persisting while an unchecked set was omitted from completed work, and did not reproduce loss of checked entries. A recap alone cannot distinguish non-entry, an unticked checkbox, later edits or a storage failure. Original browser storage may provide more evidence, but prescribed default loads/reps are not entry evidence. Historical sessions are not repaired or rewritten automatically.
