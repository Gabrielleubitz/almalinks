# API Directory

This directory contains the **single Vercel serverless function entrypoint** for the AlmaLinks backend.

## Structure

- `index.js` - Main router that handles all `/api/*` requests

All actual endpoint implementations have been moved to `lib/server/api/` to comply with Vercel Hobby plan limits (max 12 serverless functions).

## Development

**Do NOT run npm commands from this directory.**

All npm commands should be run from the **project root**:

```bash
# From project root (/Users/amitayhanson/Desktop/projects/alma)
npm install
npm run dev          # Frontend only
npm run dev:api      # Backend API (Vercel dev)
npm run dev:all      # Both frontend and backend
```

## How It Works

1. Vercel routes all `/api/*` requests to `api/index.js` (via `vercel.json` rewrite)
2. `api/index.js` routes requests to the appropriate handler in `lib/server/api/`
3. Handlers are organized by feature in `lib/server/api/`

## See Also

- `lib/server/api/` - All endpoint implementations
- `lib/server/firebase-init.js` - Firebase Admin initialization
- Root `package.json` - All npm scripts and dependencies
