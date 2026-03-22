# AlmaLinks

A comprehensive event management and networking platform for Alma Links events.

## Features

- Event management and registration
- User networking and connections  
- Admin dashboard and tools
- Chat system for attendees
- Speaker management
- Real-time notifications

## Development

### Quick Start

**All commands must be run from the project root directory:**

```bash
# Clone the repository
git clone <repository-url>
cd alma

# Install dependencies (from project root)
npm install

# Start development server (from project root)
npm run dev
```

This starts the Vite dev server on `http://localhost:5173` with React Refresh enabled.

**Important:** The `api/` directory only contains the Vercel serverless function router (`api/index.js`). All npm commands must be run from the **project root**, not from `api/` or any subdirectory.

### Development Modes

**Frontend Development (Recommended for UI work):**
```bash
npm run dev
# or
npm run dev:web
```
- Starts Vite dev server on port 5173
- Full React Refresh support (no `/@react-refresh` 404 errors)
- API calls are automatically proxied to `http://localhost:3000/api/*` (requires `npm run dev:api`)

**Backend API Development (Vercel serverless functions):**
```bash
npm run dev:api
```
- Starts Vercel dev server on port 3000
- Handles `/api/*` endpoints (serverless functions)
- Use this when testing API endpoints

**Full Stack Development:**
```bash
npm run dev:all
```
- Runs both frontend (Vite) and backend (Vercel dev) concurrently
- Frontend: `http://localhost:5173` (React Refresh works)
- Backend: `http://localhost:3000/api/*` (Vercel dev)

**Legacy Express Dev Server:**
```bash
npm run dev:express
```
- Starts Express dev server on port 3001
- Use only if you need to test Express-specific endpoints
- Note: The default proxy points to Vercel dev (port 3000), not Express

### API Proxy Setup

The Vite dev server automatically proxies `/api/*` requests to `http://localhost:3000` (Vercel dev).

**Important:** All API calls in the codebase use relative URLs (`/api/...`), which ensures:
- In development: Requests are proxied to `http://localhost:3000/api/*`
- In production: Requests go to the same origin (Vercel handles them)

**No hardcoded localhost URLs** - all API calls use relative paths for compatibility.

### Environment Variables

Create a `.env.local` file in the root directory with your environment variables:
```bash
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
# ... other variables
```

### Hotjar

Hotjar is automatically disabled on localhost and in non-production environments to prevent console warnings.

## Repository

This project is hosted at: https://github.com/Gabrielleubitz/almalinks

## Handoff & documentation

- **[docs/HANDOFF.md](docs/HANDOFF.md)** — Stack overview, setup, important paths, deploy, known follow-ups.
- Additional topics: `docs/security-overview.md`, `docs/email-flows.md`, HubSpot docs under `docs/`.

## Scripts (reference)

| Command | Purpose |
|---------|---------|
| `npm run dev` | Vite dev server |
| `npm run dev:api` | Vercel dev (API on port 3000) |
| `npm run dev:all` | Frontend + API together |
| `npm run build` | Typecheck + production build to `dist/` |

See `package.json` for the full list (Mailchimp test, email logos, etc.).
