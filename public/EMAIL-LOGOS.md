# Email logos (Gmail / Outlook)

Gmail and many other clients **block SVG** images. Email templates use **PNG** so logos display.

## Quick setup (recommended)

From the project root run:

```bash
npm run build:email-logos
```

This generates `logo.png` and `igani-logo-placeholder.png` in `public/` from the existing SVGs. Commit and deploy so the site serves them at `/logo.png` and `/igani-logo-placeholder.png`.

## Environment

- **APP_URL** (or **VERCEL_URL** in production) must be your live site (e.g. `https://almalinks.vercel.app`) so the email image URLs resolve. Set this in Vercel (or .env): `APP_URL=https://almalinks.vercel.app`.
- Optional: set **EMAIL_LOGO_URL** and **EMAIL_IGANI_LOGO_URL** to full PNG URLs if you host logos elsewhere.

## Manual option

If you prefer not to run the script: export PNG from your design tool (or use an svg→png converter) and save as `logo.png` and `igani-logo-placeholder.png` in `public/`.
