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

The current prescription allows 40–50 minutes with a 45-minute planning target, with separate squat, bench and conventional deadlift sets followed by three row/carry rounds. The countdown uses the 45-minute target; time beyond that target is still within the window up to 50 minutes. The optional `trainingWindow` text appears on the landing page and in readable and JSON handoffs. Each row pair and carry has its own load, result, effort and completion entry; carries retain their 30-second timers. Default accessory loads are 24 kg/arm and 25 kg/hand, subject to safe equipment increments. Omit accessory sets if necessary rather than rush main lifts or shorten needed rest.

Progression guidance is reviewed text, not an automatic calculation from logged RPE or RIR. Bench progression also requires controlled effort and normal recovery; deadlift progression requires review of delayed response. The prescription date is its preparation date, not a requirement to train that day. Private session recaps remain outside this repository.

Recent completed sessions using the current prescription have an **Open recap** button for next-morning updates after reloading. Older prescription records remain stored but cannot be reopened against a different exercise definition; download the handoff before replacing a prescription.
