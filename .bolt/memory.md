# Project memory

## Product intent & audience

- **SegurEPP**: app to manage delivery of Personal Protection Equipment (EPP) in companies.
- Audience: company admins, warehouse staff (almaceneros), and workers.
- Spanish-language UI.

## Brand personality & voice

- Practical, operational, safety-oriented tone.
- Spanish throughout; UI labels and flows use domain terms (trabajadores, sedes, equipos, entregas, EPP).

## Visual design & UX direction

- Multi-step delivery wizard: 5 steps (select worker → choose equipment → review → sign → confirm), ends with downloadable PDF.
- Dashboard with summary cards (monthly deliveries, renewal alerts, stock, expenses).
- CRUD lists with search/filter patterns for workers, sites, history.
- Signature capture via on-screen handwritten signature.
- Excel import/export for workers (bulk import + template download).
- Role-based demo access (admin, almacenero, trabajador) — UI gating only, no real auth yet.

## Decisions, constraints & rationale

- Framework: **Vite + React**.
- Current persistence is hybrid: workers and sites stored locally in browser with partial DB sync; equipment catalog, stock, and history are fixed/sample data (not persisted in DB).
- Login is demo-only; no real user verification yet.
- PDF generation is a core output of the delivery flow.

## Open questions & assumptions

- What does the user want to edit/add first? (pending answer)
- Should login become real (users/passwords) or stay demo?
- Should deliveries, equipment catalog, and stock move to the database for shared/persistent state, or remain local/fixed?
- Assumption: user will likely prioritize persistence and/or real auth, but unconfirmed.