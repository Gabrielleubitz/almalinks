# Comprehensive User Purge on Rejection

## Problem

After admin rejects a user, the email remains "taken" in Firebase Authentication, preventing re-signup. The system needs to completely purge all user data from:
- Firebase Authentication (critical - frees email)
- Firestore collections (joinRequests, users, registrations, event registrations)

## Solution

Implemented a comprehensive purge function that deletes user data from ALL storage locations.

## Storage Locations Identified

### 1. Firebase Authentication
- **Location**: Firebase Auth user account
- **Impact**: Email remains "taken" if not deleted
- **Deletion**: `admin.auth().deleteUser(uid)`

### 2. Firestore Collections

#### `joinRequests/{uid}`
- Stores pending/approved/rejected join requests
- **Deletion**: Direct delete (no need to mark as rejected first in full purge)

#### `users/{uid}`
- Stores approved member profiles
- **Deletion**: Delete if exists (may not exist for pending requests)

#### `registrations/{uid}`
- Root-level registrations collection
- **Deletion**: Delete if exists

#### `events/{eventId}/registrations/{uid}`
- Event-specific registrations (subcollection)
- **Deletion**: Iterate through all events and delete registrations

## Implementation

### Server-Side Function (`api/user-admin.js`)

**Function:** `rejectAndDeleteUser(req, res, adminId)`

**Steps:**
1. **Fetch user email from Auth** (before deletion, for logging)
2. **Delete `joinRequests/{uid}`** - Direct delete
3. **Delete `users/{uid}`** - If exists
4. **Delete `registrations/{uid}`** - If exists
5. **Delete all `events/{eventId}/registrations/{uid}`** - Iterate through all events
6. **Delete Firebase Auth user** - CRITICAL - frees email
7. **Verify deletion** - Confirm Auth user is gone

**Enhanced Features:**
- Fetches email before deletion for logging
- Verifies Auth deletion succeeded
- Logs all deleted collections
- Returns detailed deletion results
- Handles partial failures gracefully

**Error Handling:**
- If Auth deletion fails → Returns error (user cannot re-signup)
- If Firestore deletions fail but Auth succeeds → Returns success with warnings
- Logs all errors with full details

### Client-Side (`src/services/joinRequestService.ts`)

**Method:** `rejectAndDeleteUser(uid, adminId)`

- Calls server endpoint
- Enhanced logging of request/response
- Verifies deletion results
- Throws error if Auth deletion failed
- Shows admin-friendly error messages

### Admin UI (`src/pages/admin/PendingRegistrations.tsx`)

**Updated:** `handleRejectUser()`

- Calls purge function
- Shows detailed success/error messages
- Logs deletion results
- Removes user from UI on success

## API Endpoint Details

**URL:** `/api/user-admin`

**Method:** `POST`

**Body:**
```json
{
  "action": "reject-and-delete-user",
  "uid": "user-uid-to-purge",
  "adminId": "admin-user-uid"
}
```

**Response (Success):**
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
    "deletedCollections": ["joinRequests", "users"]
  },
  "email": "user@example.com",
  "deletedFrom": ["joinRequests", "users"]
}
```

**Response (Error - Auth Deletion Failed):**
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

### Step 1: Verify Auth Deletion
1. Admin rejects user
2. Check server logs for:
   - `✅ User deleted from Firebase Auth successfully`
   - `✅ Verified: Auth user successfully deleted (user-not-found as expected)`
   - `✅ Email {email} should now be available for re-signup`
3. Check Firebase Console → Authentication → Users
4. Verify user is NOT in the list

### Step 2: Verify Firestore Cleanup
1. Check Firestore Console:
   - `joinRequests/{uid}` - Should NOT exist
   - `users/{uid}` - Should NOT exist
   - `registrations/{uid}` - Should NOT exist
   - `events/{eventId}/registrations/{uid}` - Should NOT exist for any event

### Step 3: Test Re-Signup
1. Try to sign up with the same email
2. Should succeed (no "email already exists" error)
3. New join request should be created

## Collections Cleaned Up

| Collection | Path | Deleted? | Notes |
|------------|------|----------|-------|
| Firebase Auth | Auth user account | ✅ YES | Critical - frees email |
| joinRequests | `joinRequests/{uid}` | ✅ YES | Direct delete |
| users | `users/{uid}` | ✅ YES | If exists |
| registrations | `registrations/{uid}` | ✅ YES | If exists |
| event registrations | `events/{eventId}/registrations/{uid}` | ✅ YES | All events |

## Prevention of Auto-Recreation

### `onAuthStateChanged` Handler
- Checks for existing join request before creating new one
- If join request exists (even if rejected), does NOT create new one
- Only creates join request if NO join request exists AND no user doc exists
- This prevents rejected users from auto-creating new requests on login

### Signup Flow
- Creates join request only on new signup
- If email already exists → Shows error with login link
- User must explicitly log in and re-request

## Fallback: Re-Request Access Page

If Auth deletion fails or user already has Auth account:
1. User tries to sign up → "Email already exists"
2. User clicks "Go to Login"
3. User logs in
4. Redirected to `/re-request-access`
5. User submits new join request
6. Admin sees new request

## Testing Checklist

- [ ] Admin rejects user → Auth account deleted
- [ ] Admin rejects user → All Firestore docs deleted
- [ ] User can sign up again with same email
- [ ] No "email already exists" error after rejection
- [ ] Server logs show successful Auth deletion
- [ ] Server logs show all collections cleaned
- [ ] Admin sees detailed success/error messages
- [ ] Fallback re-request flow works if Auth deletion fails

## Files Changed

1. **`api/user-admin.js`**
   - Enhanced `rejectAndDeleteUser()` to:
     - Fetch email before deletion
     - Delete from all collections (joinRequests, users, registrations, event registrations)
     - Verify Auth deletion succeeded
     - Return detailed deletion results

2. **`src/services/joinRequestService.ts`**
   - Enhanced `rejectAndDeleteUser()` with better error handling
   - Verifies deletion results
   - Logs detailed information

3. **`src/pages/admin/PendingRegistrations.tsx`**
   - Enhanced success/error messages
   - Logs deletion results

## Troubleshooting

**If Auth deletion still fails:**
1. Check server logs for detailed error
2. Verify Firebase Admin SDK is initialized
3. Check service account permissions
4. Verify `auth` instance is available
5. Check Firebase Console → Authentication to see if user exists

**If user still can't sign up:**
1. Check Firebase Console → Authentication
2. If user exists → Auth deletion failed (check server logs)
3. If user doesn't exist → Check for other issues (network, validation, etc.)
4. Use fallback re-request flow if needed

**If Firestore docs remain:**
1. Check server logs for deletion errors
2. Verify Firestore security rules allow admin deletion
3. Check if collections were deleted successfully
4. Manually verify in Firestore Console
