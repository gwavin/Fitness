# Coaching Workout Runner

This is a local-only, 45-minute workout runner. It has no ChatGPT or OpenAI API integration and does not upload session data.

## Coaching handoff cycle

1. Gavin opens the Today’s Workout runner.
2. Gavin completes the reviewed 45-minute session.
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
