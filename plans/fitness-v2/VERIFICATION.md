# Verification record — 18 October 2026

## Day and equipment follow-up

Added Dublin weekday/time-of-day directions, the recommended workout heading, and equipment lists that follow manual session selection. Startup now shows Today with explicit draft resume; returning to Today after midnight refreshes the date and schedule. No schema, stored history, loads, prescription or timer-alarm capability changed. Worker shell version advanced to 2 for this update.

Follow-up verification: `node --test scripts/fitness-v2.test.mjs` PASS (9 tests); Playwright CLI browser regression PASS (65 checks); `node --check plans/fitness-v2/app.mjs` PASS; `git diff --check` PASS. No failures in these runs. New checks simulate Tuesday evening at 320px, confirm Indoor A and its bands/dumbbells, manual equipment changes, Wednesday/midnight refresh, and explicit resume without losing draft sets/timer state. Reviewed `output/playwright/fitness-v2-tuesday-direction-320.png` visually. Existing real-device alert limitations below still apply.

Implementation branch: `codex/fitness-v2`, baseline `58f416e`. Tests use synthetic records only, in memory or an isolated automated-browser context. Gavin's real phone history was not accessed, migrated or independently backed up during development. The on-device migration runs when v2 is first opened on the existing origin/browser profile.

## Automated results

| Command / check | Actual result |
| --- | --- |
| `node --test scripts/fitness-v2.test.mjs` | PASS, 8 tests. Dublin schedule/DST/midnight; exact prescription adaptation; legacy backup/migration and 55-record preservation; blocked/corrupt storage; Unicode/snapshot roundtrip; invalid imports; merge policy; deadline timer/deduplication. |
| `npx --yes --package @playwright/cli playwright-cli --raw run-code --filename=scripts/verify-fitness-v2-browser.mjs` | PASS, 56 checks in isolated Chromium. See coverage below. Requires the loopback static server and an open CLI browser session. |
| `node scripts/validate-coaching-workout.mjs plans/coaching-runner/current-workout.js` | PASS: `controlled-strength-progression-2026-09-23-v1`, 5 source steps, 45 minutes. |
| `node --check plans/fitness-v2/app.mjs` | PASS. |
| `node --check plans/fitness-v2/sw.js` | PASS. |
| `node --check scripts/verify-fitness-v2-browser.mjs` | PASS. |
| `git diff --check` | PASS. Git reported normal LF-to-CRLF conversion notices. |
| `git diff --exit-code 58f416e -- plans/coaching-runner` | PASS: no changes to source prescription, runner or archives. |
| `git hash-object plans/todays-workout-classic.html` vs `git rev-parse 58f416e:plans/todays-workout.html` | MATCH: `62fc6e2b1f9c1f2447777d168b3400c0302174d3`. |

Browser coverage: manual SBD/A/B selection; one exercise screen; existing load suggestions without completion; exact Classic raw backup; unit-preserving steppers; field/completion reload; undo and set/exercise skip; arbitrary jumps and keyboard navigation; quit/resume; 90-second deadline, ±15, pause, refresh, resume and reset; backwards clock correction at pause; active-page expiry and exactly three Web Audio oscillator starts; alerted ID persistence; optional/empty Comments; finish confirmation for missing sets; audited history edits; rest preference; Unicode JSON download/import; malformed/cancelled/merge/replace imports and pre-import recovery copy; indoor introduction and manual set addition; auto-rest except final set; unilateral reps; triceps variation; 320px layout/target heights and timer clearance; dark 390px and desktop layouts; cached offline reload/edits under `/Fitness/`; existing public-entry forwarding; concurrent-tab warning; injected quota failure preserving stored record; corrupt startup preserving original text; no uncaught browser errors.

Timer expiry was advanced with Playwright's virtual clock. Oscillator scheduling was instrumented; neither a physical speaker nor actual Android background audio was verified. Layout checks simulate viewport sizes, not mobile browser chrome, an on-screen keyboard, safe-area hardware or a screen reader.

## Observed failures and corrections

- `rg --files -g AGENTS.md` returned no file (exit 1); supplied chat instructions were used. Searching `.github` also returned no directory; there is no repository workflow to inspect.
- Python preview launch failed: “Python was not found” (Windows Store alias). The first browser navigation consequently returned `ERR_CONNECTION_REFUSED`. A temporary loopback Node `http-server` served the existing repository successfully instead.
- First unit run: 6 passed / 2 failed due to cross-realm VM array prototypes in the test fixture. Normalising that fixture through JSON corrected the test; the production browser uses a single realm. Final run: 8/8.
- First timer browser run installed the virtual clock after app intervals existed, so expiry was not advanced by the harness. Installing it before navigation corrected the test setup.
- An import browser assertion raced asynchronous file reading. The harness now waits for completion. Inspection also found that Settings handlers could retain the old settings object after import; re-rendering Settings after successful import fixed this production issue.
- Screenshot review found low-contrast dark-mode links; links and status text now use readable colours independent of filled-button green.

## Manual visual review

Inspected `output/playwright/fitness-v2-squat-320.png`, `fitness-v2-exercise-dark-390.png` and `fitness-v2-summary-desktop.png`. The final regression run regenerated the dark/mobile/desktop evidence after corrections. Also captured `fitness-v2-exercise-320.png` as a full-page image. Screenshots show synthetic test data only and are not committed. Final source diff was reviewed for scope, entry paths, data preservation, escaping, import validation, timer state and rollback. Existing unrelated untracked directories remain uncommitted.

## Real-device / deployment matrix

| Environment or scenario | Actual status | Required follow-up |
| --- | --- | --- |
| Desktop Chromium, active page | Automated PASS for state and audio scheduling; physical sound NOT TESTED | Confirm audible sound on actual speaker/headphones. |
| Desktop real background tab | NOT TESTED for timely alerts | Observe delivery time while hidden; do not infer sound from return state. |
| Chrome Android, visible page | NOT TESTED | Test touch/keyboard layout, sound unlock, vibration, pause/refresh. |
| Chrome Android → Spotify, 90 seconds | NOT TESTED; browser cannot guarantee timely alert | Record actual audible delivery/time with Spotify foregrounded. |
| Android screen off / battery saver | NOT TESTED; browser cannot guarantee timely alert | Repeat separately with actual device power settings. |
| Installed Android PWA | NOT TESTED | Install after cache priming, repeat Spotify and screen-off tests. |
| Offline | Desktop Chromium cached reload/edit PASS | Repeat offline installation/relaunch on Android. |
| Phone restart | NOT TESTED | Persisted state reconciles only on reopen; no web alarm is scheduled at OS level. |
| Native Android Clock alongside Spotify | NOT TESTED on target phone | Best practical alternative; verify alarm volume, DND, output device and battery saver. |
| Notifications / vibration / wake lock | Implemented but real delivery/hardware NOT TESTED | Grant permissions explicitly and verify each capability on phone. |
| GitHub Pages production | NOT DEPLOYED or remotely verified | Review branch, export existing phone records, then deploy separately and run same-origin migration check. |
| Worker update waiting/activation | Strategy source-reviewed; multi-version upgrade NOT TESTED | Test saved draft across a cache-version bump before a future update. |

## Repeat browser checks locally

From the repository, start a loopback server with the parent folder as root so URLs include `/Fitness/`:

```
npx --yes http-server C:\Users\gavin\Documents\GitHub -p 8765 -a 127.0.0.1 -c-1
npx --yes --package @playwright/cli playwright-cli open http://127.0.0.1:8765/Fitness/plans/fitness-v2/index.html --headed
npx --yes --package @playwright/cli playwright-cli --raw run-code --filename=scripts/verify-fitness-v2-browser.mjs
```

The browser script creates and closes its own isolated context, and deliberately injects corrupt/quota-failure fixtures there. Do not run those fixture mutations manually in a real profile. Stop the owned server when finished. No build/lint configuration exists for this new buildless app; syntax, data, browser and diff checks are the applicable checks.
