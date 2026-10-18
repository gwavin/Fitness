# Fitness v2

Buildless, local-first workout runner. Entry: `plans/fitness-v2/index.html`; public `plans/todays-workout.html` forwards here. No package install/build/backend is required. Serve the repository over localhost for testing or HTTPS for installation. Use the same deployed origin/browser profile to access existing history; localhost cannot read GitHub Pages storage.

The opening screen names the current Dublin weekday and time of day (for example, Tuesday evening), the scheduled workout, and the equipment to gather for the selected session. Manual session changes update the equipment list. Each launch opens Today; unfinished sessions remain available through Resume rather than hiding the current day's direction. This does not change the weekly schedule, optional Tuesday preference, loads or stored history.

## Audit and source of truth

Baseline: `58f416e`, `main`, with pre-existing untracked `.playwright-cli/`, `apps/todays-workout-site/`, `mcps/`, `output/`. Those folders are outside this implementation. No `.github/` directory/workflow was present. The existing site is static and its source paths match GitHub Pages project hosting; the actual remote Pages settings/deployed revision were not inspected or changed.

`../coaching-runner/current-workout.js` remains unchanged. `model.mjs` adapts every non-empty set plan, retaining warm-ups, labels, reps, loads, rest guidance, fallback instructions, three row/carry rounds and 45-second carry targets. No separate current Monday/Wednesday/Friday prescriptions were found; all three use this single reviewed source. Archived prescriptions remain unchanged. The combined accessory block stays together to preserve its alternating round order.

Working loads remain squat 75 kg × 5 × 3, bench 80 kg × 5 × 3, deadlift 75 kg × 5 × 2, subject to the unchanged manually chosen fallbacks. Latest comparable local values become editable suggestions, never completed results. The hold starts 18 October 2026 and ends 15 November 2026 (exclusive); change its start in Settings. There is no automatic progression even after that date. The UI removes questionnaires and required effort fields but retains safety guidance in collapsible cues. It does not reproduce Classic's symptom-based input blocking; users who need that guided workflow should use Classic.

Indoor A/B are separate versioned templates. Two sets each initially; later targets are guidance only. Adding sets requires a manual action. Tuesday is shown as optional and initially not enabled in the plan; it remains manually selectable. Enabling it records the preference and changes the schedule explanation. No automatic fortnight transition, failure training, intensity techniques or kettlebell rows are introduced. A concentration-curl set covers both arms; right reps may be recorded separately without doubling the set count. Edit an exercise definition in `model.mjs`; existing sessions retain their definition snapshots. Increment template/definition version for programme changes and bump the worker cache version for asset updates.

## Storage and recovery

LocalStorage is retained to match the existing static architecture. All fields, completion, skips, navigation, comments and settings save immediately; set suggestions are not proof of completion. A session has its own template/version snapshot and edit audit. No 30-session cap. Elapsed duration includes time away. Session IDs use `crypto.randomUUID` (HTTPS or localhost).

On first launch, validate and copy Classic records into the version-2 `fitness-v2` database. The exact original `fitness-coaching-runner-v1` text is backed up as `fitness-v2-classic-backup` before creating v2. The original key is never written. `legacyRaw` and `legacySessions` are included in JSON export. Incompatible/malformed/quota-blocked data stops startup instead of silently replacing it. A recovery download is offered. No attempt is made to infer whether a prefilled Classic load was actually performed.

New drafts resume in v2. Unfinished Classic sessions remain in Classic, with a direct link; they are not converted to a different logging schema. Preserved Classic history is inspectable in v2 and matching current-prescription recaps remain editable in Classic. Old Classic definitions are not invented or replayed against a new prescription. “Refresh Classic snapshot” explicitly confirms before replacing the snapshot and makes a pre-refresh backup. Later Classic edits are not silently synced. Last-used suggestions match exact exercise IDs; older unmatched IDs remain intact but are not guessed.

Import accepts v2 JSON exports only, up to 10 MB, validating schema, dates, values, snapshots, timer state, unique v2 IDs and unsafe properties. Merge explicitly confirms that incoming matching session IDs win; it retains local settings/live timer and Classic raw snapshot. Replace explicitly confirms a whole v2 replacement. Both first save the current in-memory database as `fitness-v2-before-import`, downloadable in Settings. Neither changes Classic's key. The original database is retained if validation, backup or final write fails. Export/import preserves Unicode. A Classic export can be recovered in Classic or kept in a full v2 export; arbitrary legacy JSON uploads are not accepted as v2 backups.

Storage errors show a persistent red NOT SAVED message; keep the tab open and export its in-memory records. Concurrent v2 writes are detected by revision and `storage` events; the stale tab must export/reload rather than silently overwrite newer data. This is a conflict guard, not a multi-user database or cross-tab transaction lock: use one v2 tab. Exports, edit audits and Classic snapshots can contain private fitness notes; keep them out of Git and shared screenshots. Nothing uploads automatically. Browser data is not a backup; export regularly. LocalStorage quota, eviction and synchronous writes remain limitations. Long field-level audits and snapshots can increase space use; a future IndexedDB migration should preserve these records and provide independent backups.

## Timer capability: best effort, not an exact Android alarm

Timer state, default, presets, preferences, paused duration, session reference, expiry ID, end timestamp and alerted ID are persisted. Every draw derives remaining time from the absolute deadline. A live-page monotonic anchor guards against a backwards clock change lengthening the timer. Reload/restart falls back to wall time; changing the system clock across a restart can change the displayed remainder. Visibility/page-show events reconcile expiry; delayed callbacks do not create timer drift. Navigation never resets a running timer. Expiry is marked once before requesting cues; there is no repeated cue on resume/reload in a single tab. A missed audible cue is not retried automatically. Auto-rest defaults off and does not run after the final set. Explicit carry timing uses the same prominent timer, with confirmation before replacing a running timer.

Active-page audio requires a user gesture and running AudioContext. Test sound requests an audible cue but cannot tell whether a speaker/headphone actually sounded. Vibration is optional and browser-dependent. Notifications require explicit permission via Test notification and a ready service worker. A notification is requested by the page at observed expiry, not scheduled by Android. Test notification tests delivery now, not future background delivery. Screen wake lock is attempted during a visible active workout and released on leaving/hidden state. It cannot keep execution alive when Spotify takes over.

**Spotify foreground, screen-off, phone restart and battery saver alert delivery are unverified on Gavin's phone and cannot be guaranteed by this web deployment.** A frozen/discarded page cannot run an on-time callback or audio cue. A correct expired display on return is not evidence of a timely alert. No silent-audio keepalive, push server or battery-restriction evasion is used. Installed PWA/offline caching does not change this limitation.

Primary references:
- [Chrome page lifecycle: frozen tasks are suspended](https://developer.chrome.com/docs/web-platform/page-lifecycle-api)
- [Screen Wake Lock: visible documents and automatic release](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API)
- [Notifications through a worker registration](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration/showNotification)
- [Android alarm scheduling and exact-alarm permissions](https://developer.android.com/develop/background-work/services/alarms)
- [Android audio focus and Android 15 foreground restrictions](https://developer.android.com/media/optimize/audio-focus)

### Native alternative (documentation only)

For reliable practical use now, start the **native Android Clock timer** alongside the workout. Verify its audible behaviour with Spotify, the actual headphones/speaker, alarm volume, Do Not Disturb and battery saver on the target phone. Do not assume every device setting allows sound.

If an integrated timer is required, the smallest custom path is a native Android companion (or a wrapper with a real native timer bridge) that schedules a user-requested system alarm, persists timer IDs/deadlines, cancels/replaces alarms on pause/reset and posts an appropriate local notification with alarm sound. A WebView alone does not solve suspension. A native alarm receiver/appropriately declared foreground service can deliver the audible phase; audio attributes/focus, notification channels and user settings must be handled explicitly. Android 12+ exact alarms need the applicable exact-alarm capability; Android 13+ notification permission and exact-alarm permission/policy choices must be reviewed. Permission availability differs by target SDK/install state; `SCHEDULE_EXACT_ALARM` may require user-granted special access. `USE_EXACT_ALARM` is restricted to qualifying use cases and distribution policy. Do not choose it casually for a workout app. Reboot cancels system alarms unless a permitted reboot receiver restores them from durable state. Force-stop, user-disabled alarms/notifications, DND and OEM policy still require explicit testing and truthful capability reporting. Android 15+ audio-focus requests require the top app or a foreground service. A short audible alarm service must obey current service types/start restrictions; no continuous silent playback.

This introduces an Android toolchain, signed APK/install updates, native bridge maintenance, version-specific permission UX, and possible Play distribution review. No native build/backend is introduced here; obtain Gavin's approval before that separate project. Even a native path should only claim tested reliability under stated device/settings conditions, not unconditional sound delivery.

## Offline and updates

Manifest/start/scope use relative URLs under `/Fitness/plans/fitness-v2/`. The worker caches the app shell, module model, current prescription, manifest, docs and icons. Shell caching is atomic: “Offline cache ready” appears after activation. It does not cache or control unrelated apps or Classic. Install using the browser menu after this status appears; launch the installed app or v2 URL offline. The forwarding public entry and Classic are not promised to work offline unless independently cached by the browser. No catch-all root service worker is installed.

Updates install in a waiting worker while v2 tabs remain open. Save, close all v2 tabs and reopen to activate. No forced reload in a workout, no `skipWaiting`, and only this app's old shell caches are removed. No workout storage is deleted. Bump `CACHE` in `sw.js` for each shell/prescription update; cached prescription consistency is deliberate. Browser cache priming can fail independently of workout saving; the UI reports that failure.

## Rollback

`../todays-workout-classic.html` is a byte-for-byte copy of the pre-v2 public HTML; original coaching CSS, JS, prescriptions and archives remain unchanged. Open it directly at any time, including before deployment. For a code rollback restore `plans/todays-workout.html` from `plans/todays-workout-classic.html`; the old public route then behaves as before. V2 storage stays separate; export it before removing v2 code. Reverting does not put new v2 sessions into Classic's incompatible schema. Its worker is scoped to `fitness-v2/`; clearing that scope's cache/unregistering that worker is optional and must not clear localStorage. No push or deployment is part of this change.

## Verification

Run from repository root:

```
node --test scripts/fitness-v2.test.mjs
node scripts/validate-coaching-workout.mjs plans/coaching-runner/current-workout.js
node --check plans/fitness-v2/app.mjs
node --check plans/fitness-v2/sw.js
git diff --check
```

Browser and real-device results are recorded in `VERIFICATION.md`. Tests use invented records only. Do not mark an audible test passed merely because the UI later shows expiry.
