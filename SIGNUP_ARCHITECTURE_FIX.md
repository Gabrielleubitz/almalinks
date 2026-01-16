# Signup Architecture Fix - Complete Implementation

## Problem Solved
Previously, user documents (`users/{uid}`) were created immediately on signup with `status: 'pending'`. This caused rejected users to still have user documents and appear in queries.

## Solution
User documents are now **only created when admin approves**. Pending signups are stored in a separate `joinRequests` collection.

## Architecture Flow

### Signup Flow
1. User signs up → Firebase Auth account created
2. `joinRequests/{uid}` document created with `status: 'pending'`
3. **NO** `users/{uid}` document created
4. User sees "Waiting for approval" page

### Admin Approval Flow
1. Admin clicks "Approve" on join request
2. `joinRequests/{uid}` status updated to `'approved'`
3. `users/{uid}` document **created** from join request data
4. User can now access member features

### Admin Rejection Flow
1. Admin clicks "Reject" on join request
2. `joinRequests/{uid}` status updated to `'rejected'`
3. **Ensures** `users/{uid}` does NOT exist (deletes if legacy doc exists)
4. User sees "Access denied" page

## Key Changes

### 1. New Service: `src/services/joinRequestService.ts`
- `createJoinRequest()` - Creates join request on signup
- `getJoinRequest()` - Gets join request by UID
- `getPendingRequests()` - Gets all pending requests
- `approveRequest()` - Approves and creates user document
- `rejectRequest()` - Rejects and ensures no user document exists
- `isApproved()`, `getApprovalStatus()` - Helper functions

### 2. Modified: `src/hooks/useAuth.ts`
- `createOrUpdateUserProfile()` now creates `joinRequests/{uid}` instead of `users/{uid}`
- `getUserProfile()` checks `joinRequests/{uid}` if no user document exists
- Returns status from join request for pending/rejected users

### 3. Modified: `src/pages/admin/PendingRegistrations.tsx`
- `loadPendingUsers()` queries `joinRequests` collection instead of `users`
- `handleApproveUser()` uses `JoinRequestService.approveRequest()` which creates user doc
- `handleRejectUser()` uses `JoinRequestService.rejectRequest()` which ensures no user doc

### 4. Modified: `src/pages/admin/AdminDashboard.tsx`
- `getPendingUsersCount()` queries `joinRequests` instead of `users`

### 5. Modified: `src/hooks/useNotifications.ts`
- `subscribeToPendingRegistrations()` queries `joinRequests` instead of `users`

### 6. Modified: `src/utils/userHelpers.ts`
- Updated to async functions that check `joinRequests` collection
- `isApprovedUser(uid)`, `isPendingUser(uid)`, `isRejectedUser(uid)`, `getApprovalStatus(uid)`

### 7. Modified: Firestore Security Rules
- `users/{userId}`: Only admins can create user documents
- `joinRequests/{requestId}`: Users can create their own, admins can update/delete

### 8. Modified: Types
- `UserProfile.status` now includes `'approved'` and `'rejected'`
- Admin-created users use `status: 'approved'` instead of `'active'`

## Collections

### `joinRequests/{uid}`
- Created on signup
- Contains all signup data
- Status: `'pending' | 'approved' | 'rejected'`
- Updated on approval/rejection

### `users/{uid}`
- **Only created when admin approves**
- Contains approved member profile
- Status: Always `'approved'` (since only approved users have user docs)

## Firestore Indexes Required

### Index 1: JoinRequests by status and createdAt
```
Collection: joinRequests
Fields: status (Ascending), createdAt (Descending)
Query Scope: Collection
```

Deploy with: `firebase deploy --only firestore:indexes`

Or create manually in Firebase Console.

## Testing Checklist

- [ ] New signup creates `joinRequests/{uid}`, NOT `users/{uid}`
- [ ] Admin approval creates `users/{uid}` from join request
- [ ] Admin rejection updates join request and ensures no `users/{uid}` exists
- [ ] Pending users see "Waiting for approval" page
- [ ] Rejected users see "Access denied" page (redirected to login)
- [ ] Approved users can access all member features
- [ ] Members page only shows approved users (queries `users` with `status === 'approved'`)
- [ ] Pending Registrations page shows join requests
- [ ] Admin dashboard shows correct pending count from `joinRequests`
- [ ] Admin-created users get `users/{uid}` immediately with `status: 'approved'`

## Migration Notes

### Existing Data
- **Approved users**: Already have `users/{uid}` - no migration needed
- **Pending users**: Should migrate `users/{uid}` → `joinRequests/{uid}`, then delete `users/{uid}`
- **Rejected users**: Should migrate `users/{uid}` → `joinRequests/{uid}` with `status: 'rejected'`, then delete `users/{uid}`

### Cleanup Script (Optional)
```javascript
// Find all users/{uid} with status: 'pending'
// Create joinRequests/{uid} from user data
// Delete users/{uid}

// Find all users/{uid} with status: 'rejected'  
// Create joinRequests/{uid} from user data with status: 'rejected'
// Delete users/{uid}
```

## Files Changed

1. **NEW**: `src/services/joinRequestService.ts`
2. **MODIFIED**: `src/hooks/useAuth.ts`
3. **MODIFIED**: `src/pages/admin/PendingRegistrations.tsx`
4. **MODIFIED**: `src/pages/admin/AdminDashboard.tsx`
5. **MODIFIED**: `src/hooks/useNotifications.ts`
6. **MODIFIED**: `src/utils/userHelpers.ts`
7. **MODIFIED**: `src/types/user.ts`
8. **MODIFIED**: `firestore-admin-enhanced.rules`
9. **MODIFIED**: `firestore.indexes.json`
10. **MODIFIED**: `api/user-admin.js` (admin-created users use 'approved' status)

## Important Notes

- **Admin-created users** (via User Management) still get `users/{uid}` immediately - this is correct behavior
- **Regular signups** go through `joinRequests` flow
- **Members page** already filters by `status === 'approved'` - will only show users with user documents
- **ProtectedRoute** already handles pending/rejected users correctly
- **Firestore rules** prevent regular users from creating their own user documents
