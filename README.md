# Fitness

This repository hosts a static fitness and health website. It includes workout tools, medical calculators, run/walk cadence apps, long-form plans, a few personal recipes and some demo content.

## Directory overview

### Landing experience
- **index.html** – new central landing page that links every tool, program and resource.
- **assets/css/landing.css** – shared styling for the landing experience.

### `apps/`
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
