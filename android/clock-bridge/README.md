# Fitness Clock Bridge — Android preview

Purpose: a tap in Fitness/Chrome sends a duration to a small native confirmation screen; that screen requests a timer from **Google Clock** using Android's `ACTION_SET_TIMER`. Google Clock owns its countdown, notification and sound. This is not a native fitness app or a background web-audio workaround.

## Try on the phone

1. Download `plans/fitness-v2/downloads/fitness-clock-bridge-preview.apk` from this repository's deployed site, using the Fitness **Setup** link. Install it on Android 8+ with Google Clock installed/enabled. This is a development-signed preview, not a Play Store release or a production signing arrangement.
2. Close all Fitness tabs/the installed PWA, then reopen after the worker update is ready. The Android timer dock includes **Google Clock** and **Setup** buttons. Desktop browsers keep the existing web timer.
3. Set the web timer duration (15–3600 seconds). If already running, the button hands off the rounded-up current remainder. Tap **Google Clock**, then confirm the displayed duration in the bridge. The web timer pauses before leaving; this is not evidence the native timer started.
4. Verify the native countdown in Google Clock. It may start as soon as the native request arrives, even though `EXTRA_SKIP_UI` is false. Manage pause/reset/dismiss in Clock; the website does not control or mirror it.
5. Test 15 seconds visibly, then with Spotify foregrounded, then screen-off. Check alarm volume, DND and the actual headphones/speaker. Do not infer timely audible delivery from a web timer's expired display.

If Chrome opens the setup page instead, the app was not resolved or launch was blocked. No native timer is confirmed; use Clock manually. Installing the bridge never automatically replays a failed request. Return and tap again for a fresh request. Uninstalling the bridge does not delete fitness records or necessarily cancel timers already owned by Clock.

## Scope, privacy and duplicate handling

The app has one normal permission: `com.android.alarm.permission.SET_ALARM`. No Internet permission, analytics, notification permission, exact-alarm permission, service, receiver, workout history access, Spotify access or battery exemption. It delegates rather than implementing its own alarm. An explicit package query selects `com.google.android.deskclock`; it does not silently use some other installed timer app. Missing/disabled Clock or denied handoff produces visible guidance.

The exported browser entry accepts only `fitnessclock://timer?seconds=...&requestId=...&issuedAt=...`. Bounds, canonical UUID, exact parameter set, duplicate parameters, host/scheme/path and request age are validated natively. Requests expire after two minutes (10 seconds future clock skew allowed), including revalidation when confirming. Nothing from a link can select a component, alternate package, arbitrary message or URL. The Clock label is always `Fitness rest`; no session ID or health notes leave the website.

Any website could attempt to open this custom scheme. That is why the native confirmation is required: a browser launch alone cannot start a timer. Do not treat the displayed request as authenticated to this site. No claim of origin authentication is made.

The app records a request ID synchronously before calling Clock and rejects repeats across process/recreation/back navigation. Records older than ten minutes are pruned after they are already outside the link validity window. A known pre-launch failure permits an explicit retry. A successful Activity launch is only a **request sent** state; it is not Clock acknowledgement or an audible-delivery guarantee. A genuinely new tap gets a new ID and can intentionally create another timer: check existing Clock timers before doing so.

The website pauses its own timer first to avoid duplicate sound. A missing app/fallback leaves that timer paused so the user can explicitly resume it. Auto-rest and carry buttons remain web-only. A handoff is never launched automatically by a callback or set completion. The native timer continues independently when website controls change; those controls are not a remote control for Clock. No schema migration or workout/prescription change is involved.

## Build

Source uses Java/platform Activities only, no runtime dependencies. The wrapper pins Gradle 8.0 and AGP 8.1.0 to the toolchain already installed on this computer, JDK 17, Android SDK/build tools 34, minSdk 26, targetSdk 34. AGP 8.1's compile-SDK certification warning is explicitly suppressed for this preview. Before production/Play distribution, update the toolchain/target and establish a private release-signing process. Do not commit keystores or passwords. The published preview uses the standard development signature; it is for limited testing only, not an authenticity/security boundary.

On Windows:

```
powershell -ExecutionPolicy Bypass -File android/clock-bridge/Build-Preview.ps1
```

Override `-SdkPath` / `-JdkPath` if needed. The script builds app and instrumentation APKs, verifies the app signature, copies only the app preview to the website downloads folder and prints its SHA-256. Generated builds, SDK-local config, Gradle caches and keystores are ignored. The Gradle wrapper JAR and preview APK are deliberately tracked distribution artifacts; neither contains a private signing key. APKs do expose their normal public signing certificate.

To run native boundary checks on an **isolated emulator**, install `app/build/outputs/apk/debug/app-debug.apk` and `app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk`, then:

```
adb -s emulator-5580 shell am instrument -w ie.gavinhoran.fitnessclockbridge.test/ie.gavinhoran.fitnessclockbridge.BridgeChecks
```

Do not assume another emulator uses that serial. No phone was installed to during development.

## Verification — 18 October 2026

- Build: `:app:assembleDebug :app:assembleDebugAndroidTest` PASS. First offline attempt failed on uncached Kotlin build dependencies; retry with normal official repositories succeeded. The app itself has no Kotlin/runtime library dependency.
- APK signature: `apksigner verify --verbose` PASS (v2 signature). First standalone verification needed `JAVA_HOME` set; retry succeeded.
- `:app:lintDebug` PASS, 0 errors / 17 warnings. Remaining warnings cover English-only prototype text/localisation, an intentional synchronous preference commit for duplicate-request handling, and the API-31 backup attributes alongside minSdk 26 (`allowBackup=false` also covers older Android). Backup/extraction rules and an app icon were added after the first lint run. The Gradle distribution's official SHA-256 is pinned; the first checksum-fetch helper needed byte-to-text decoding corrected before writing the pin.
- Native instrumentation: PASS, **20 checks**, on a read-only API 34 x86_64 emulator. Validates durations, exact native action/package/extras, visible Clock UI request, malformed/expired/future/duplicate/injectable URI rejection. This instrumentation suite does not itself test Clock's audio.
- Web/unit tests: **11 passed** (`node --test scripts/fitness-v2.test.mjs scripts/android-clock.test.mjs`).
- Existing isolated-browser regression: **65 passed** (`scripts/verify-fitness-v2-browser.mjs`).
- Android-UA browser checks: **10 passed** (`scripts/verify-clock-bridge-browser.mjs`), covering explicit intent generation, fixed package, fallback, persisted web pause, honest status, 320px layout, invalid-duration block, offline help. First test run attempted an ordinary click on an intentionally disabled zero-duration link; corrected the harness to force the click when testing defensive rejection.
- Manual emulator: Chrome **113.0.5672.136** → bridge confirmation for **01:30** → Google Clock **7.4 (504317960)** → native `Fitness rest` timer visibly counting down at **1:29**. Evidence: `output/clock-bridge-google-clock-90.png`. Earlier test expiry produced a native Clock notification over Chrome. These are emulator UI observations, not verified real-time audio delivery.
- Replay: re-sent an already-recorded request ID; bridge displayed “already handed off” with its launch button disabled. Evidence: `output/clock-bridge-repeat.xml`.
- Some emulator UI-hierarchy captures initially failed to obtain idle/root state while a timer notification/Chrome startup animation was active. Screenshot inspection and later stable captures supplied the evidence; failed captures are not counted as passing checks. First emulator URL used non-secure `10.0.2.2`; final test used adb reverse/localhost as a secure context, matching HTTPS's Web Crypto requirements.
- Emulator started read-only with `-no-window -no-audio -no-snapshot`; it emitted a Vulkan warning but booted. No physical phone was connected. **Spotify, physical sound, current phone Clock version, headphones, screen-off, battery saver, reboot and real-device permission handling remain NOT TESTED.**

## Rollback

Web timing and Classic remain available. To undo this feature, revert the bridge UI/module/cache change and keep or remove the standalone native source/download separately. Uninstalling the preview does not clear browser history. Stop any running native timer in Google Clock yourself; reverting the website cannot cancel it. The prototype does not change system alarm settings or obtain broad battery privileges.

References: [Android timer API](https://developer.android.com/reference/android/provider/AlarmClock#ACTION_SET_TIMER), [Chrome intent links and BROWSABLE requirement](https://developer.chrome.com/docs/android/intents).
