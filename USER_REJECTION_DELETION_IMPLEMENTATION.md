# User Rejection and Complete Deletion Implementation

## Overview

When an admin rejects a user from the Registrations/Approvals page, the user is **completely purged** from the system, allowing them to re-signup with the same email.

## Why Server-Side Deletion is Required

**CRITICAL**: User deletion MUST be done server-side using Firebase Admin SDK because:

1. **Client-side code cannot delete Firebase Auth users** - This is a security restriction enforced by Firebase
2. **Only Admin SDK has permissions** - Regular client SDKs don't have the necessary permissions to delete Auth accounts
3. **Email freeing requires Auth deletion** - The ONLY way to free an email for re-signup is to delete the Auth account using Admin SDK

## Implementation Details

### Server-Side Endpoint (`api/user-admin.js`)

**Function**: `rejectAndDeleteUser(req, res, adminId)`

**Location**: Serverless function endpoint (Vercel/Netlify compatible)

**Admin Verification**:
- Verifies `adminId` is provided
- Checks `users/{adminId}` document exists
- Verifies `role === 'admin'`
- Returns 403 if not admin

**Deletion Steps** (in order):
1. **Fetch user email** from Auth (before deletion, for logging)
2. **Delete `joinRequests/{uid}`** - Direct delete (no status update needed)
3. **Delete `users/{uid}`** - If exists (may not exist for pending requests)
4. **Delete `registrations/{uid}`** - If exists (root-level registrations)
5. **Delete all `events/{eventId}/registrations/{uid}`** - Iterate through all events
6. **Delete Firebase Auth user** - **CRITICAL** - This is what frees the email
7. **Verify deletion** - Confirm Auth user is gone

**Error Handling**:
- If Auth deletion fails → Returns 500 error (user cannot re-signup)
- If Firestore deletions fail but Auth succeeds → Returns 200 with warnings
- Logs all errors with full details
- Never swallows Auth deletion failures

**Logging**:
- Logs when rejection starts
- Logs each deletion step
- Logs Auth deletion explicitly (success or failure)
- Logs verification results
- Logs email that was freed

### Client-Side Service (`src/services/joinRequestService.ts`)

**Method**: `rejectAndDeleteUser(uid: string, adminId: string)`

**Behavior**:
- Calls server endpoint `/api/user-admin` with `action: 'reject-and-delete-user'`
- Handles response and errors
- Returns deletion results to UI
- Throws error if Auth deletion failed

**Returns**:
```typescript
{
  success: boolean;
  message: string;
  details: {
    joinRequestDeleted: boolean;
    userDocDeleted: boolean;
    registrationsDeleted: boolean;
    eventRegistrationsDeleted: number;
    authUserDeleted: boolean; // CRITICAL
    errors: string[];
    deletedCollections: string[];
  };
  email?: string;
  deletedFrom?: string[];
}
```

### Admin UI (`src/pages/admin/PendingRegistrations.tsx`)

**Function**: `handleRejectUser(userId: string)`

**Behavior**:
- Calls `JoinRequestService.rejectAndDeleteUser()`
- Removes user from UI immediately on success
- Shows detailed success/error messages
- Logs deletion results
- Warns if Auth deletion failed

**UI Updates**:
- Removes user from pending list immediately
- Shows success message: "User rejected and fully purged. They can now re-apply with the same email."
- Shows error message if deletion failed
- Logs what collections were deleted

## Prevention of Auto-Recreation

### `onAuthStateChanged` Handler (`src/hooks/useAuth.ts`)

**Behavior**:
- Does NOT auto-create join requests on login
- Checks for existing join request first
- Only creates minimal profile from Auth data (no Firestore writes)
- Prevents rejected users from auto-creating new requests

**Key Code**:
```typescript
// IMPORTANT: Do NOT auto-create join requests on login
// This prevents rejected users from auto-creating new requests
const existingJoinRequest = await JoinRequestService.getJoinRequest(firebaseUser.uid);

if (existingJoinRequest) {
  // Use existing join request
} else {
  // Do NOT auto-create - user must explicitly sign up or re-request
  console.log('⚠️ NOT auto-creating join request - user must do this explicitly');
}
```

## Collections Deleted

| Collection | Path | Deleted? | Notes |
|------------|------|----------|-------|
| Firebase Auth | Auth user account | ✅ YES | **CRITICAL** - Frees email |
| joinRequests | `joinRequests/{uid}` | ✅ YES | Direct delete |
| users | `users/{uid}` | ✅ YES | If exists |
| registrations | `registrations/{uid}` | ✅ YES | If exists |
| event registrations | `events/{eventId}/registrations/{uid}` | ✅ YES | All events |

## API Endpoint

**URL**: `/api/user-admin`

**Method**: `POST`

**Body**:
```json
{
  "action": "reject-and-delete-user",
  "uid": "user-uid-to-delete",
  "adminId": "admin-user-uid"
}
```

**Response (Success)**:
```json
{
  "success": true,
  "message": "User rejected and completely purged from the system. They can now re-apply with the same email.",
  "details": {
    "joinRequestDeleted": true,
    "userDocDeleted": false,
    "registrationsDeleted": false,
    "eventRegistrationsDeleted": 0,
    "authUserDeleted": true,
    "errors": [],
    "deletedCollections": ["joinRequests"]
  },
  "email": "user@example.com",
  "deletedFrom": ["joinRequests"]
}
```

**Response (Error - Auth Deletion Failed)**:
```json
{
  "success": false,
  "error": "Failed to delete Firebase Auth user: ...",
  "details": {
    "joinRequestDeleted": true,
    "userDocDeleted": false,
    "authUserDeleted": false,
    "errors": ["Failed to delete Auth user: ..."]
  },
  "authErrorCode": "auth/...",
  "authErrorMessage": "..."
}
```

## Verification Steps

### 1. Verify Auth Deletion
- Check server logs for: `✅ User deleted from Firebase Auth successfully`
- Check server logs for: `✅ Verified: Auth user successfully deleted`
- Check Firebase Console → Authentication → Users
- Verify user is NOT in the list

### 2. Verify Firestore Cleanup
- Check Firestore Console:
  - `joinRequests/{uid}` - Should NOT exist
  - `users/{uid}` - Should NOT exist
  - `registrations/{uid}` - Should NOT exist
  - `events/{eventId}/registrations/{uid}` - Should NOT exist for any event

### 3. Test Re-Signup
- Try to sign up with the same email
- Should succeed (no "email already exists" error)
- New join request should be created

## Acceptance Criteria

✅ Rejecting a user deletes their Firebase Auth account  
✅ All Firestore records for that user are removed  
✅ The email is no longer "already in use"  
✅ The user can sign up again and submit a new registration request  
✅ No rejected user remains visible anywhere in the admin or members UI  
✅ Implementation uses server-side Admin SDK (not client-side)  
✅ Comprehensive logging for debugging  
✅ No auto-recreation of users or join requests  

## Files Modified

1. **`api/user-admin.js`**
   - `rejectAndDeleteUser()` function with comprehensive deletion
   - Admin verification
   - Detailed logging
   - Error handling

2. **`src/services/joinRequestService.ts`**
   - `rejectAndDeleteUser()` method that calls server endpoint
   - Returns deletion results to UI
   - Error handling

3. **`src/pages/admin/PendingRegistrations.tsx`**
   - `handleRejectUser()` calls server endpoint
   - Removes user from UI on success
   - Shows detailed messages

4. **`src/hooks/useAuth.ts`**
   - Prevents auto-recreation of join requests
   - Only creates minimal profile from Auth data

## Troubleshooting

**If Auth deletion fails:**
1. Check server logs for detailed error
2. Verify Firebase Admin SDK is initialized
3. Check service account permissions
4. Verify `auth` instance is available
5. Check Firebase Console → Authentication

**If user still can't sign up:**
1. Check Firebase Console → Authentication
2. If user exists → Auth deletion failed (check server logs)
3. If user doesn't exist → Check for other issues
4. Use fallback re-request flow if needed

**If Firestore docs remain:**
1. Check server logs for deletion errors
2. Verify Firestore security rules allow admin deletion
3. Check if collections were deleted successfully
4. Manually verify in Firestore Console
