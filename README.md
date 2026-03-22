# Fitness

This repository hosts a static fitness and health website. It includes workout tools, medical calculators, run/walk cadence apps, long-form plans, a few personal recipes and some demo content.

## Directory overview

### Landing experience
- **index.html** – new central landing page that links every tool, program and resource.
- **assets/css/landing.css** – shared styling for the landing experience.

### `apps/`
- **hiit-hrm/** - Garmin-ready HIIT PWA that pairs a BLE heart-rate strap, runs a warm-up, then gates sprint and recovery from live heart-rate thresholds.
- **run-walk-metronome-v2/** - second-generation run/walk metronome with separate run and walk BPM settings, a recovery-friendly walking cadence, presets, session totals and optional voice/vibration cues.
- **run-walk-metronome/** – progressive web app (PWA) for cadence-based run/walk intervals. Includes `metronome.css`, `metronome.js`, a scoped `sw.js` and a `legacy.html` single-file build.
- **exercise-calculators/** – strength & conditioning utilities such as barbell complexes and heavy lifting timers.
- **health-calculators/** – medical calculators (BMI, EDD, NEWS2, CHA<sup>2</sup>DS<sup>2</sup>-VASc, etc.).
- **cerner-server-cycler.html** – rotating server cheat sheet for on-call teams.
- **demo/** – interactive prototype showing theme switching and JSON-driven content.

### `plans/`
- **august-rehab/** – twelve-week shoulder & barefoot running rehab program (`week01.html` through `week12.html`).
- **workouts/** – detailed session write-ups, ankle rehab routines and rest-day templates.
- **exercise-plan.html**, **fitness-plan-index.html**, **fitness-index.html**, **workout-template.html** – additional planning frameworks and indices.

### `resources/`
- Context pages such as **fitness-hub.html**, **fitness.html**, **calendar.html**, **barefoot-running-schedule.html**, **barefoot-days.html**, **my-plan.html** and **warmup.txt**.

### `recipes/`
- **waffles.html** – original waffle recipe.
- **waffles2.html** – freezer-friendly waffle update.

### Other files
- **Train Domain Discern Reports - Admin 2024 - Post Refresh - All PDP.xlsx** – analytics export referenced on the landing page.

## Launching the site
1. Install Python 3 if needed.
2. From the repository root run:
   ```bash
   python3 -m http.server
   ```
3. Open `http://localhost:8000/index.html` in your browser.

## Contributing
Issue reports and pull requests should be made on [GitHub](https://github.com/gwavin/Fitness). Each page links to its edit form (for example in `index.html` lines 209‑210).
## Local AI orchestration workflow
This repository also includes a controlled workflow where tasks, context packs, outputs, reviews, and decisions are stored separately for traceability.

- 00_inbox/ - intake area for new requests, notes, and raw materials.
- 01_tasks/ - active task definitions and work items.
- 02_context/ - context packs, references, and supporting background.
- 03_outputs/ - generated deliverables and completed artifacts.
- 04_reviews/ - review notes, QA checks, and feedback logs.
- 05_decisions/ - decision records and rationale.
- 06_logs/ - run logs, execution notes, and audit trails.
- 07_scripts/ - local helper scripts for the workflow.
- 08_prompts/ - reusable prompts and prompt variants.
- 09_templates/ - starter templates for recurring work.
- source_html/ - source HTML captured or prepared for processing.
- archive/ - retired tasks, outputs, and historical materials.

## Core Templates
- `09_templates/task.template.json` - task brief with scope, inputs, constraints, and deliverables.
- `09_templates/context.template.json` - context pack with selected files, assumptions, risks, and open questions.
- `09_templates/result.template.md` - result note for work completed, findings, outputs, and limits.
- `09_templates/review.template.md` - review note for checks, concerns, and outcome.
- `09_templates/decision.template.md` - decision record with rationale and follow-on actions.
- `09_templates/manifest.template.csv` - source file register for tracking file metadata and topic tags.
- `09_templates/entity_register.template.csv` - entity register for extracted names and source references.
- `08_prompts/codex_role_builder.md` - implementation prompt for safe file generation and local changes.
- `08_prompts/reviewer_role.md` - reviewer prompt for completeness, consistency, risks, and next steps.

## First Task
- `BUILD-001` created the first read-only index of `source_html/` and produced a starter context file, manifest, and archive summary in the workflow folders.
