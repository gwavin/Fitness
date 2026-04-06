# Rental Property Management Prototype (Static)

A polished static web application prototype for landlords and letting agents, designed to run on **GitHub Pages** with no backend runtime.

## What this prototype does

- Dashboard with monthly KPIs and recent activity.
- CRUD-style management for landlords, tenants, properties, and tenancies.
- Monthly ledger with deductions, agent fees, and manual adjustments.
- Monthly statement preview (with print/download via browser print).
- Yearly statement preview with month-by-month totals.
- Settings panel for organization defaults and statement footer.
- Simulated statement emailing with an `emailLog` entity.

## Static architecture

- **Static prototype only** (HTML + CSS + vanilla JS modules).
- **Data is stored in browser `localStorage`**.
- **Email sending is simulated only**; no real email API is called.
- **Statements are generated client-side** from local data.
- No npm packages, no build step, no server assumptions.

## How to run locally

Because this app uses ES modules, run from a local static server (not `file://`):

```bash
# Option A (Python)
python3 -m http.server 8080
# then open http://localhost:8080/rental-management/
```

## GitHub Pages deployment

1. Push this repository to GitHub.
2. In **Settings → Pages**, choose branch (usually `main`) and root folder.
3. If publishing from repo root, app URL will be:
   - `https://<user>.github.io/<repo>/rental-management/`
4. Ensure module script and asset paths remain relative (already configured).

## Current limitations of static hosting

- No user authentication or role-based access control.
- No immutable server audit logs.
- Data is browser-local and device-specific.
- No transactional email integration.
- No scheduled backend jobs for auto statement runs.

## Migration path to a real backend

The code separates storage/service logic from UI rendering for easy replacement:

1. Replace `assets/js/store.js` localStorage functions with API calls.
2. Replace `assets/js/services.js` CRUD methods with endpoint-backed services.
3. Replace `simulateEmailStatement()` with transactional provider integration.
4. Add authentication and user/org tenancy controls.
5. Move scheduled monthly statement generation to backend cron/job workers.
6. Persist ledger/statement data in a real relational database.

## Project structure

```text
rental-management/
  index.html
  assets/
    css/styles.css
    js/
      app.js
      router.js
      store.js
      seed.js
      services.js
      utils.js
      statements.js
      email.js
      ui.js
  pages/
    dashboard.html
    landlords.html
    landlord-detail.html
    tenants.html
    tenant-detail.html
    properties.html
    property-detail.html
    tenancies.html
    tenancy-detail.html
    ledger.html
    monthly-statement.html
    yearly-statement.html
    settings.html
  README.md
```
