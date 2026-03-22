# Repository notes (AI & contributors)

- **Handoff / architecture:** [docs/HANDOFF.md](docs/HANDOFF.md)
- **Environment:** Copy `.env.example` → `.env.local`; never commit secrets.
- **Build:** Run `npm run build` from the **repository root** (not `api/`).
- **API:** Vercel serverless under `api/`; local full stack: `npm run dev:all`.
