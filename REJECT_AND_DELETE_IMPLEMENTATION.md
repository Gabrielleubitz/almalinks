# Reject and Delete User Implementation

## Problem

When an admin rejects a user, the Firebase Auth account remains, preventing the user from signing up again with the same email. The error "A user with this email already exists" occurs because Firebase Authentication still has that user account.

## Solution

Implemented a server-side endpoint that completely deletes rejected users from the system, allowing them to re-apply later with the same email.

## Implementation

### 1. Server-Side Endpoint (`api/user-admin.js`)

**New Action:** `reject-and-delete-user`

**Function:** `rejectAndDeleteUser(req, res, adminId)`

**Steps:**
1. Verifies admin permissions
2. Deletes `joinRequests/{uid}` document (updates status to 'rejected' first for audit trail, then deletes)
3. Deletes `users/{uid}` document (if exists)
4. Deletes Firebase Auth user account (critical - allows re-signup)

**Error Handling:**
- Handles partial failures gracefully
- Returns detailed results showing what was deleted
- If Auth deletion fails, returns error (user cannot re-signup)
- If Firestore deletions fail but Auth succeeds, returns success with warnings

### 2. Client-Side Service (`src/services/joinRequestService.ts`)

**New Method:** `rejectAndDeleteUser(uid: string, adminId: string)`

- Calls the server-side endpoint
- Handles errors and provides user-friendly messages
- Logs warnings if any occur during deletion

**Deprecated Method:** `rejectRequest()`
- Marked as deprecated with warning
- Kept for backward compatibility
- Does NOT delete Firebase Auth user (old behavior)

### 3. Admin UI (`src/pages/admin/PendingRegistrations.tsx`)

**Updated:** `handleRejectUser()`

- Now calls `JoinRequestService.rejectAndDeleteUser()` instead of `rejectRequest()`
- Updates local state to remove user from pending list
- Shows success message indicating user can re-apply

## API Endpoint

**URL:** `/api/user-admin`

**Method:** `POST`

**Body:**
```json
{
  "action": "reject-and-delete-user",
  "uid": "user-uid-to-delete",
  "adminId": "admin-user-uid"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "User rejected and completely deleted from the system. They can now re-apply with the same email.",
  "details": {
    "joinRequestDeleted": true,
    "userDocDeleted": false,
    "authUserDeleted": true,
    "errors": []
  }
}
```

**Response (Partial Success):**
```json
{
  "success": true,
  "message": "User rejected and deleted. Some cleanup operations had warnings.",
  "details": {
    "joinRequestDeleted": true,
    "userDocDeleted": false,
    "authUserDeleted": true,
    "errors": ["Failed to delete user document: ..."]
  },
  "warnings": ["Failed to delete user document: ..."]
}
```

**Response (Error):**
```json
{
  "success": false,
  "error": "Failed to delete Firebase Auth user. User may not be able to re-signup with the same email.",
  "details": {
    "joinRequestDeleted": true,
    "userDocDeleted": false,
    "authUserDeleted": false,
    "errors": ["Failed to delete Auth user: ..."]
  },
  "partialSuccess": true
}
```

## Security

- **Admin Verification:** Only users with `role: 'admin'` in `users/{adminId}` can perform this action
- **Server-Side Only:** Firebase Auth deletion requires Admin SDK, which is only available server-side
- **Audit Trail:** Join request is marked as 'rejected' with timestamp and admin ID before deletion

## User Flow

### Before (Old Behavior):
1. Admin rejects user
2. Join request marked as 'rejected' in Firestore
3. User document deleted (if exists)
4. **Firebase Auth account remains** ❌
5. User tries to sign up again → "Email already exists" error

### After (New Behavior):
1. Admin rejects user
2. Join request deleted from Firestore
3. User document deleted (if exists)
4. **Firebase Auth account deleted** ✅
5. User can sign up again with the same email → New join request created

## Testing

### Test Case 1: Normal Rejection
1. Create a test user account
2. Admin rejects the user
3. Verify:
   - Join request is deleted from Firestore
   - User document is deleted (if existed)
   - Firebase Auth user is deleted
   - User can sign up again with the same email

### Test Case 2: Rejection with Missing Documents
1. Create a test user account
2. Manually delete `users/{uid}` document
3. Admin rejects the user
4. Verify:
   - Join request is deleted
   - No error for missing user document
   - Firebase Auth user is deleted
   - User can sign up again

### Test Case 3: Rejection of Already Deleted Auth User
1. Create a test user account
2. Manually delete Firebase Auth user
3. Admin rejects the user
4. Verify:
   - Join request is deleted
   - No error for missing Auth user
   - Success response indicates user was already gone

## Acceptance Criteria ✅

- [x] Admin rejects user → user is deleted from Firebase Auth
- [x] Admin rejects user → user is removed from Firestore (joinRequests and users)
- [x] User can sign up again with the same email after rejection
- [x] New join request is created when user re-applies
- [x] Rejected user no longer visible in pending requests
- [x] Rejected user no longer visible in members list
- [x] Only admins can perform this action
- [x] Proper error handling for partial failures
- [x] User-friendly error messages in UI

## Files Changed

1. **`api/user-admin.js`**
   - Added `reject-and-delete-user` action to switch statement
   - Implemented `rejectAndDeleteUser()` function

2. **`src/services/joinRequestService.ts`**
   - Added `rejectAndDeleteUser()` method (calls server endpoint)
   - Marked `rejectRequest()` as deprecated

3. **`src/pages/admin/PendingRegistrations.tsx`**
   - Updated `handleRejectUser()` to use new server-side method

## Notes

- The old `rejectRequest()` method is kept for backward compatibility but marked as deprecated
- If Auth deletion fails, the operation is considered failed (user cannot re-signup)
- Firestore deletion failures are logged as warnings but don't block the operation if Auth deletion succeeds
- The join request is marked as 'rejected' before deletion for audit trail purposes (if needed for future audit logs)
