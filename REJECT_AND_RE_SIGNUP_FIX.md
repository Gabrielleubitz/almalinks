# Fix: Rejected Users Cannot Re-Signup

## Problem

After an admin rejects a user, the user cannot sign up again with the same email because:
1. Firebase Auth account still exists (not deleted)
2. Signup fails with "An account with this email already exists"

## Solution

Implemented a two-part solution:

### Part A: Proper Auth User Deletion on Reject

**Server-Side Endpoint:** `api/user-admin.js` → `reject-and-delete-user` action

**Function:** `rejectAndDeleteUser(req, res, adminId)`

**Steps:**
1. Verifies admin permissions
2. Deletes `joinRequests/{uid}` document
3. Deletes `users/{uid}` document (if exists)
4. **Deletes Firebase Auth user account** (critical - frees email for re-signup)

**Enhanced Logging:**
- Logs Auth instance availability
- Logs Admin SDK initialization status
- Logs detailed error information if Auth deletion fails
- Returns detailed error messages to admin

**Client-Side:**
- `JoinRequestService.rejectAndDeleteUser()` calls server endpoint
- Enhanced error handling with detailed logging
- Shows admin-friendly error messages if deletion fails

### Part B: Fallback UX for Re-Request Access

**New Page:** `src/pages/ReRequestAccessPage.tsx`

**Purpose:** Allows users with existing Auth accounts to submit a new join request

**Flow:**
1. User tries to sign up → Gets "email already exists" error
2. Error message includes link to login
3. User logs in
4. If user is rejected or has no pending request → Redirected to `/re-request-access`
5. User fills out form and submits new join request
6. New `joinRequests/{uid}` created with `status: 'pending'`
7. Admin sees new request in pending registrations

**Key Features:**
- Pre-fills form with existing data (if available)
- Creates/updates join request for existing Auth user
- Does NOT create `users/{uid}` document (only on approval)
- Tracks if request was previously rejected (for audit)

**Service Method:** `JoinRequestService.createOrUpdateJoinRequestForExistingUser()`
- Creates or updates join request for existing Auth user
- Preserves `createdAt` if updating existing request
- Sets `status: 'pending'` and `updatedAt: serverTimestamp()`

## Implementation Details

### 1. Server Endpoint (`api/user-admin.js`)

**Action:** `reject-and-delete-user`

**Request:**
```json
{
  "action": "reject-and-delete-user",
  "uid": "user-uid",
  "adminId": "admin-uid"
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

**Response (Error):**
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

### 2. Client Service (`src/services/joinRequestService.ts`)

**New Methods:**
- `rejectAndDeleteUser(uid, adminId)` - Calls server endpoint
- `getJoinRequestByEmail(email)` - Finds existing request by email
- `createOrUpdateJoinRequestForExistingUser(uid, formData)` - Creates/updates request for existing Auth user

### 3. Admin UI (`src/pages/admin/PendingRegistrations.tsx`)

**Updated:** `handleRejectUser()`
- Calls `JoinRequestService.rejectAndDeleteUser()`
- Enhanced error logging
- Shows detailed error messages to admin
- Verifies deletion results

### 4. Signup Page (`src/pages/SignupPage.tsx`)

**Enhanced Error Message:**
- When email already exists, shows:
  - "This email already has an account. Please log in to submit a new approval request."
  - Link to login page

### 5. Login Flow (`src/pages/LoginPage.tsx`, `src/components/auth/AuthWrapper.tsx`)

**Updated Redirects:**
- Rejected users → Redirected to `/re-request-access`
- Allows them to submit a new join request

### 6. New Re-Request Access Page (`src/pages/ReRequestAccessPage.tsx`)

**Features:**
- Pre-fills form with existing data
- Creates/updates join request
- Shows success message
- Redirects to pending page after submission

## User Flows

### Flow 1: Normal Rejection (Part A Works)
1. Admin rejects user
2. Server deletes:
   - `joinRequests/{uid}`
   - `users/{uid}` (if exists)
   - Firebase Auth user ✅
3. User can sign up again with same email
4. New join request created

### Flow 2: Rejection with Auth Deletion Failure (Part B Fallback)
1. Admin rejects user
2. Server deletes Firestore docs but Auth deletion fails
3. User tries to sign up → "Email already exists"
4. User clicks "Go to Login"
5. User logs in
6. User redirected to `/re-request-access`
7. User submits new join request
8. New `joinRequests/{uid}` created with `status: 'pending'`
9. Admin sees new request

### Flow 3: Legacy Rejected User (Part B)
1. User was rejected before Part A was implemented
2. Auth account still exists
3. User tries to sign up → "Email already exists"
4. User logs in → Redirected to `/re-request-access`
5. User submits new join request
6. Admin sees new request

## Testing

### Test Part A: Auth Deletion
1. Create test user account
2. Admin rejects user
3. Check console logs for:
   - `✅ User deleted from Firebase Auth successfully`
   - `✅ Email should now be available for re-signup`
4. Verify in Firebase Console:
   - Auth user is deleted
   - `joinRequests/{uid}` is deleted
   - `users/{uid}` is deleted (if existed)
5. Try to sign up with same email → Should succeed

### Test Part B: Re-Request Flow
1. Create test user account (or use existing rejected user)
2. Try to sign up with same email → Should show error with login link
3. Click "Go to Login"
4. Log in
5. Should be redirected to `/re-request-access`
6. Fill out form and submit
7. Verify in Firestore:
   - `joinRequests/{uid}` exists with `status: 'pending'`
   - `users/{uid}` does NOT exist
8. Check admin panel → New request should appear

### Test Error Handling
1. Simulate Auth deletion failure (e.g., wrong permissions)
2. Admin rejects user
3. Check admin sees detailed error message
4. User can still use Part B fallback to re-request

## Acceptance Criteria ✅

- [x] Admin rejects user → Auth account is deleted (email becomes available)
- [x] Enhanced logging shows Auth deletion status
- [x] Admin sees detailed error messages if deletion fails
- [x] User can sign up again after successful rejection
- [x] Fallback: User can log in and re-request if Auth account still exists
- [x] Re-request creates new `joinRequests/{uid}` with `status: 'pending'`
- [x] Re-request does NOT create `users/{uid}` document
- [x] Rejected users are redirected to re-request page
- [x] Signup page shows helpful message with login link when email exists

## Files Changed

1. **`api/user-admin.js`**
   - Enhanced `rejectAndDeleteUser()` with detailed logging
   - Better error messages for Auth deletion failures

2. **`src/services/joinRequestService.ts`**
   - Enhanced `rejectAndDeleteUser()` with detailed logging and verification
   - Added `getJoinRequestByEmail()` method
   - Added `createOrUpdateJoinRequestForExistingUser()` method

3. **`src/pages/admin/PendingRegistrations.tsx`**
   - Enhanced error handling and logging in `handleRejectUser()`

4. **`src/pages/SignupPage.tsx`**
   - Enhanced error message for email-already-in-use
   - Added link to login page

5. **`src/pages/LoginPage.tsx`**
   - Updated redirect for rejected users → `/re-request-access`

6. **`src/components/auth/AuthWrapper.tsx`**
   - Updated redirect for rejected users → `/re-request-access`

7. **`src/components/auth/ProtectedRoute.tsx`**
   - Updated redirect for rejected users → `/re-request-access`

8. **`src/pages/ReRequestAccessPage.tsx`** (NEW)
   - New page for rejected users to re-request access
   - Pre-fills form with existing data
   - Creates/updates join request

9. **`src/App.tsx`**
   - Added route for `/re-request-access`

## Troubleshooting

**If Auth deletion still fails:**
1. Check server logs for detailed error messages
2. Verify Firebase Admin SDK is properly initialized
3. Check service account permissions
4. Verify `auth` instance is available in `user-admin.js`
5. Check Firebase Console → Authentication → Users to verify deletion

**If re-request doesn't work:**
1. Verify user is logged in
2. Check Firestore rules allow users to create/update their own join request
3. Verify `createOrUpdateJoinRequestForExistingUser()` is called correctly
4. Check console for errors

**If user still can't sign up:**
1. Check Firebase Console → Authentication to see if Auth user exists
2. If exists, use Part B fallback (log in and re-request)
3. If doesn't exist, check for other issues (network, validation, etc.)
