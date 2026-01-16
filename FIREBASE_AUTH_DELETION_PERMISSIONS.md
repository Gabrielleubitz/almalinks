# Firebase Auth User Deletion Permissions Setup

## Overview

When an admin rejects a user from the Registrations/Approvals page, the system must delete the Firebase Auth user account to free the email for re-signup. This requires specific IAM permissions on the service account used by the backend.

## Problem

If you see this error:
```
🚫 Admin: Verify service account has permissions to delete Auth users.
Reject failed: Backend lacks permission to delete Auth users.
```

This means the service account running your backend (serverless function) does not have permission to delete Firebase Auth users.

## Solution

### Step 1: Identify Your Service Account

The service account is determined by how you've configured Firebase Admin SDK:

**Option A: Using FIREBASE_SERVICE_ACCOUNT_KEY (Recommended)**
- The service account email is in the `client_email` field of the JSON key
- Check your environment variable or deployment settings

**Option B: Using Individual Environment Variables**
- Service account email is in `FIREBASE_CLIENT_EMAIL`
- Check your `.env` file or deployment settings

**Option C: Default Service Account (Cloud Functions)**
- If using Firebase Cloud Functions, the default service account is:
  - `<project-id>@appspot.gserviceaccount.com`
- If using Vercel/Netlify, use the service account from your service account key

### Step 2: Grant Required IAM Role

The service account needs the **Firebase Authentication Admin** role to delete Auth users.

#### Using Google Cloud Console:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your Firebase project
3. Navigate to **IAM & Admin** → **IAM**
4. Find your service account (or click **+ GRANT ACCESS** to add it)
5. Click **Edit** (pencil icon) next to the service account
6. Click **+ ADD ANOTHER ROLE**
7. Search for and select: **Firebase Authentication Admin**
8. Click **SAVE**

#### Using gcloud CLI:

```bash
# Replace with your actual service account email and project ID
SERVICE_ACCOUNT_EMAIL="your-service-account@project-id.iam.gserviceaccount.com"
PROJECT_ID="your-firebase-project-id"

# Grant Firebase Authentication Admin role
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
  --role="roles/firebaseauth.admin"
```

### Step 3: Verify Project Configuration

Ensure your backend is using the **same Firebase project** as your frontend:

**Backend (Serverless Function):**
- Check `FIREBASE_PROJECT_ID` environment variable
- Or check `project_id` in `FIREBASE_SERVICE_ACCOUNT_KEY`
- Logs should show: `📋 Project ID: <your-project-id>`

**Frontend:**
- Check `VITE_FIREBASE_PROJECT_ID` environment variable
- Should match the backend project ID

**Verify in Code:**
The backend logs will show:
```
✅ Firebase Admin SDK initialized
📋 Project ID: <project-id>
📧 Service Account: <service-account-email>
```

### Step 4: Test the Fix

1. Go to Admin → Pending Registrations
2. Click **Reject** on a test user
3. Check server logs for:
   - `✅ User deleted from Firebase Auth successfully`
   - `✅ Verified: Auth user successfully deleted`
4. Verify in Firebase Console → Authentication → Users
   - User should be deleted
5. Try to sign up with the same email
   - Should succeed (no "email already exists" error)

## Required IAM Role

**Role Name:** `Firebase Authentication Admin`  
**Role ID:** `roles/firebaseauth.admin`

**Permissions Included:**
- `firebaseauth.users.delete` - Delete Firebase Auth users
- `firebaseauth.users.get` - Get Firebase Auth user details
- `firebaseauth.users.list` - List Firebase Auth users
- And other Firebase Auth management permissions

## Alternative: Custom Role (Minimal Permissions)

If you prefer minimal permissions, create a custom role with only:
- `firebaseauth.users.delete`
- `firebaseauth.users.get`

However, using the built-in `Firebase Authentication Admin` role is recommended for simplicity and future-proofing.

## Troubleshooting

### Error: "Backend lacks permission to delete Auth users"

**Check:**
1. Service account email is correct
2. Role is granted to the correct service account
3. Project ID matches between frontend and backend
4. IAM changes may take a few minutes to propagate

**Verify in Google Cloud Console:**
1. IAM & Admin → IAM
2. Find your service account
3. Verify it has `Firebase Authentication Admin` role

### Error: "Firebase project ID is not set"

**Check:**
1. `FIREBASE_PROJECT_ID` environment variable is set
2. Or `project_id` is in `FIREBASE_SERVICE_ACCOUNT_KEY`
3. Environment variables are loaded correctly in your deployment

### Error: "Auth user still exists after deletion attempt"

**Check:**
1. Service account has correct permissions
2. Project ID is correct
3. User UID is correct
4. Check server logs for detailed error messages

## Security Notes

- **Never commit service account keys to version control**
- Use environment variables or secret management (Vercel/Netlify secrets)
- Rotate service account keys regularly
- Use least-privilege principle (but `Firebase Authentication Admin` is appropriate for this use case)

## Related Files

- `api/user-admin.js` - Server-side deletion function
- `src/services/joinRequestService.ts` - Client-side service
- `src/pages/admin/PendingRegistrations.tsx` - Admin UI

## Support

If issues persist:
1. Check server logs for detailed error messages
2. Verify service account in Google Cloud Console
3. Test with a different service account
4. Check Firebase project settings
