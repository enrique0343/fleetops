# FleetOps: visual redesign

The redesign keeps the existing React/Vite stack, authentication, API endpoints and trip workflows. It introduces a light operational workspace with a navy sidebar, clearer visual priorities, recent trips, visible data refresh state, mobile navigation and an updated sign-in page. Existing administration and driver screens share the light palette.

## Corrections included

- Trip pagination retains the requested page; changing filters resets pagination.
- Date filters send inclusive local-day instants, including the selected end date. Fuel KPIs use the same date filters as the list.
- The fuel summary displays average spend per fill instead of labeling mixed raw quantities as liters. Individual records retain their original L/gal unit. Backend quantity aggregates remain unchanged and must be normalized or grouped by unit before future use.
- Fuel date/time inputs initialize using local time instead of UTC.
- A failed active-trip lookup displays a retry state before a driver can start another journey.
- Shared modals use native dialogs with focus containment and Escape handling. Mobile zoom is enabled.
- API configuration accepts either a server origin or a URL already ending in `/api`.

## Preview

After `npm ci` and `npm run build` in `frontend`, run:

```bash
node design/build-preview.mjs /absolute/output/fleetops-redesign-preview.html
```

The standalone HTML bundles the actual `AdminShell`, `DashboardView` and shared UI components with clearly labeled fictional data. Its desktop/mobile toggle and dialog work locally. It does not authenticate, call a backend, or save operational data. `design/preview.tsx` is not imported by the production application.

## Validation and limits

- Production TypeScript/Vite build passes.
- Focused checks verify pagination, immutable filters and inclusive date boundaries in America/El_Salvador, including a year boundary.
- Independent read-only review found no material introduced regressions.
- No browser or end-to-end tests were run. No live backend was connected.
- Dashboard day boundaries still use the server time zone. Active trips span all dates; daily incidents are the current incidence state among trips started today. These scopes are explicitly labeled.
- This branch is a review proposal and has not been deployed or merged.
