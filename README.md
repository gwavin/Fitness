# Fitness

This repository hosts a static fitness and health website. It includes workout tools, medical calculators, a few personal recipe pages and some demo content.

## Directory overview

### Root HTML pages
- **index.html** – main landing page with quotes and links to calculators, a waffle recipe, movie plan, and a demo.
- **demo.html** – showcases theme switching and dynamic content loaded from `sample-data.json`.
- **myPlan.html** – long-form treatment for a documentary titled *Watson - The Duel in the Sun and Beyond*.
- **waffles.html** – original waffle recipe.
- **waffles2.html** – updated waffle recipe with make‑ahead tips.

### Subdirectories
- **exercise-calculators/** – collection of workout tools:
  - `barbell-complex-workout.html`
  - `heavy-lifting-timer.html`
  - `strength-rehab-plan.html`
- **health-calculators/** – medical calculators such as BMI, EDD, NEWS2 and more. See the directory for the full list of pages.

Other files include `sample-data.json` (used by the demo page) and an example spreadsheet `Train Domain Discern Reports - Admin 2024 - Post Refresh - All PDP.xlsx`.

## Launching the site
1. Install Python 3 if needed.
2. From the repository root run:
   ```bash
   python3 -m http.server
   ```
3. Open `http://localhost:8000/index.html` in your browser.

## Contributing
Issue reports and pull requests should be made on [GitHub](https://github.com/gwavin/Fitness). Each page links to its edit form (for example in `index.html` lines 209‑210).
