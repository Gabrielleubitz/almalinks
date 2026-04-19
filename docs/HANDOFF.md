# Engineering handoff — AlmaLinks

Last reviewed for repository structure, env, and key flows. Update this file when ownership or major architecture changes.

## What this repo is

- **Product:** Event management, member directory, networking, and connections for AlmaLinks.
- **Frontend:** React 18 + TypeScript + Vite + Tailwind (`src/`).
- **Backend:** Vercel serverless API (`api/` → `lib/server/api/`); handlers routed via `api/index.js`.
- **Data:** Firebase (Auth + Firestore + Storage). Client config in `src/firebase/config.ts`.
- **Email:** Mailjet and/or Mailchimp Transactional (see `.env.example`).

## First-time setup

1. `npm install` from repo root (not `api/`).
2. Copy `.env.example` → `.env.local` and fill Firebase client vars (`VITE_*`).
3. For local API + admin user APIs: set Firebase Admin credentials (see `.env.example`).
4. `npm run dev` — Vite on `http://localhost:5173`.
5. Full stack: `npm run dev:all` (Vite + `vercel dev` on port 3000).

See `README.md` for proxy behavior (`/api/*` → Vercel dev).

## Important paths

| Area | Location |
|------|----------|
| Routes | `src/App.tsx` |
| Admin shell | `src/components/admin/AdminLayout.tsx` |
| Firestore rules | `firestore.rules` (see `firebase.json`; deploy with Firebase CLI) |
| API handlers | `lib/server/api/` (imported by `api/index.js`) |
| Connections domain | `src/services/connectionService.ts`, `src/services/adminConnectionService.ts` |
| Events | `src/services/eventService.ts` |
| Env docs | `.env.example` |

## Documentation index (`docs/`)

| Doc | Purpose |
|-----|---------|
| `email-flows.md`, `EMAIL_WORKFLOW.md` | Transactional email behavior |
| `security-overview.md` | High-level security notes |
| `hubspot-sync.md`, `HUBSPOT_SYNC_TRACE.md` | HubSpot integration |
| `MOBILE_AUDIT.md` | Mobile UX notes |

## Deploy

- **Production:** Typically Vercel; env vars in project settings (mirror `.env.example` server-side keys).
- **Firestore rules:** Canonical file is `firestore.rules` (see `firebase.json`). Other `firestore-*.rules` files in the repo are backups/history—do not deploy them unless you rename/replace intentionally. Deploy: `firebase deploy --only firestore:rules` (with Firebase CLI logged into the right project).

## Code hygiene notes

- **No committed secrets:** `.env`, `.env.local` are gitignored.
- **Dead code removed:** Legacy `*Old.tsx` pages/components were deleted when unused; grep before re-adding backups.
- **Logging:** Prefer `import.meta.env.DEV` for verbose client logs; avoid unconditional `console.log` in services used in production.

## Known follow-ups (non-blocking)

- `src/services/userService.ts` — TODOs around shared-events detection.
- `src/pages/admin/UserManagement.tsx` — TODO to convert a path to Vercel API.
- `src/pages/ChatViewPage.tsx` — TODO message deletion.
- `AdminConnectionService.removeConnection` — throws “not implemented”; intentional stub until product decides archive/delete.

## Support

- Repo: see `package.json` `repository.url` and root `README.md`.
