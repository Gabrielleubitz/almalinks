# HubSpot Integration for Next.js

This integration provides a production-ready HubSpot implementation for Next.js (App Router) applications.

## Setup

### 1. Environment Variables

Add these to your `.env.local` file:

```env
# HubSpot Portal ID (public, safe for client-side)
NEXT_PUBLIC_HUBSPOT_PORTAL_ID=your-portal-id

# HubSpot Private App Token (server-side only, never expose to client)
HUBSPOT_PRIVATE_APP_TOKEN=your-private-app-token
```

### 2. Install Dependencies

```bash
npm install @hubspot/api-client
```

## Features

- ✅ Page tracking & analytics (client-side)
- ✅ Lead capture forms (server-side API)
- ✅ Contact creation/updates
- ✅ Optional: Deal creation
- ✅ Optional: Lifecycle stage updates

## Usage

### Tracking Script

The tracking script is automatically loaded via `components/HubSpotTracking.tsx`. 
Include it in your root layout:

```tsx
import HubSpotTracking from '@/components/HubSpotTracking';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <HubSpotTracking />
      </body>
    </html>
  );
}
```

### Form Component

Use the `HubSpotForm` component anywhere:

```tsx
import HubSpotForm from '@/components/HubSpotForm';

<HubSpotForm
  formId="contact-form"
  fields={['email', 'firstname', 'lastname', 'company']}
  onSubmitSuccess={(data) => {
    console.log('Contact created:', data);
  }}
/>
```

### API Usage

You can also use the API routes directly:

```tsx
// Create/update contact
const response = await fetch('/api/hubspot/contacts', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    firstname: 'John',
    lastname: 'Doe',
  }),
});
```

## Security Notes

- `NEXT_PUBLIC_HUBSPOT_PORTAL_ID` is safe for client-side use
- `HUBSPOT_PRIVATE_APP_TOKEN` must NEVER be exposed to the client
- All HubSpot API calls go through server-side API routes
- Input validation is performed on the server

## File Structure

```
hubspot-integration/
├── README.md
├── components/
│   ├── HubSpotTracking.tsx      # Client-side tracking script
│   └── HubSpotForm.tsx          # Reusable form component
├── app/
│   └── api/
│       └── hubspot/
│           ├── contacts/
│           │   └── route.ts     # Contact creation/update
│           ├── deals/
│           │   └── route.ts     # Deal creation (optional)
│           └── lifecycle/
│               └── route.ts     # Lifecycle stage updates (optional)
├── lib/
│   └── hubspot.ts               # HubSpot client utilities
└── types/
    └── hubspot.ts               # TypeScript types
```

