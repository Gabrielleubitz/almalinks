# HubSpot Integration - Example Usage

## 1. Setup in Root Layout

Add the tracking script to your root layout:

```tsx
// app/layout.tsx
import HubSpotTracking from '@/components/HubSpotTracking';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
        <HubSpotTracking />
      </body>
    </html>
  );
}
```

## 2. Using the Form Component

### Basic Contact Form

```tsx
// app/contact/page.tsx
import HubSpotForm from '@/components/HubSpotForm';

export default function ContactPage() {
  return (
    <div className="max-w-md mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6">Contact Us</h1>
      <HubSpotForm
        formId="contact-page-form"
        fields={['email', 'firstname', 'lastname', 'company', 'phone']}
        onSubmitSuccess={(data) => {
          console.log('Contact submitted:', data);
          // Optionally redirect or show success message
        }}
        onSubmitError={(error) => {
          console.error('Form error:', error);
        }}
      />
    </div>
  );
}
```

### Newsletter Signup Form

```tsx
// app/newsletter/page.tsx
import HubSpotForm from '@/components/HubSpotForm';

export default function NewsletterPage() {
  return (
    <div className="max-w-sm mx-auto p-8">
      <h2 className="text-xl font-bold mb-4">Subscribe to Our Newsletter</h2>
      <HubSpotForm
        formId="newsletter-form"
        fields={['email', 'firstname']}
        submitText="Subscribe"
        onSubmitSuccess={() => {
          alert('Thank you for subscribing!');
        }}
      />
    </div>
  );
}
```

## 3. Using the API Directly

### Create Contact Programmatically

```tsx
// app/api/example/route.ts or in a server component
async function createContact() {
  const response = await fetch('/api/hubspot/contacts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: 'user@example.com',
      firstname: 'John',
      lastname: 'Doe',
      company: 'Acme Corp',
      phone: '+1234567890',
    }),
  });

  const result = await response.json();
  
  if (result.success) {
    console.log('Contact created:', result.data);
  } else {
    console.error('Error:', result.error);
  }
}
```

### Client-Side Form Submission

```tsx
'use client';

import { useState } from 'react';

export default function CustomForm() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage('');

    try {
      const response = await fetch('/api/hubspot/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const result = await response.json();

      if (result.success) {
        setMessage('Success! Check your email.');
        setEmail('');
      } else {
        setMessage(result.error || 'Something went wrong');
      }
    } catch (error) {
      setMessage('Network error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Enter your email"
        required
        disabled={isSubmitting}
      />
      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Submitting...' : 'Submit'}
      </button>
      {message && <p>{message}</p>}
    </form>
  );
}
```

## 4. Creating Deals (Optional)

```tsx
// Example: Create a deal after contact submission
async function createDealForContact(contactId: string) {
  const response = await fetch('/api/hubspot/deals', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      dealname: 'New Customer Deal',
      amount: '5000',
      dealstage: 'appointmentscheduled', // Your deal stage ID
      pipeline: 'default', // Your pipeline ID
      associatedcontactids: [contactId],
      closedate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
    }),
  });

  const result = await response.json();
  return result;
}
```

## 5. Updating Lifecycle Stage (Optional)

```tsx
// Example: Update contact lifecycle stage
async function updateLifecycleStage(contactId: string, stage: string) {
  const response = await fetch('/api/hubspot/lifecycle', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contactId,
      lifecycleStage: stage, // e.g., 'lead', 'customer', etc.
    }),
  });

  const result = await response.json();
  return result;
}
```

## 6. Integration with Existing Forms

If you have existing forms, you can integrate HubSpot submission:

```tsx
'use client';

export default function ExistingForm() {
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    const formData = new FormData(e.currentTarget);
    const data = {
      email: formData.get('email'),
      firstname: formData.get('firstname'),
      lastname: formData.get('lastname'),
    };

    // Submit to your existing backend
    await fetch('/api/your-existing-endpoint', {
      method: 'POST',
      body: JSON.stringify(data),
    });

    // Also submit to HubSpot
    await fetch('/api/hubspot/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Your existing form fields */}
    </form>
  );
}
```

