# Join Request Architecture - Implementation Summary

## Overview
This document describes the new architecture where user documents are only created after admin approval. Pending signups are stored in a separate `joinRequests` collection.

## Architecture Changes

### Before (Old Behavior)
- User signs up → `users/{uid}` document created immediately with `status: 'pending'`
- Admin approves → Updates `users/{uid}` to `status: 'approved'`
- Admin rejects → Updates `users/{uid}` to `status: 'rejected'`
- **Problem**: Rejected users still had user documents and appeared in queries

### After (New Behavior)
- User signs up → `joinRequests/{uid}` document created with `status: 'pending'`
- **NO** `users/{uid}` document created at signup
- Admin approves → Creates `users/{uid}` document from join request data
- Admin rejects → Updates `joinRequests/{uid}` to `status: 'rejected'` and ensures no `users/{uid}` exists
- **Result**: Rejected users never have user documents and never appear in Members page

## Collections

### `joinRequests/{uid}`
Stores pending signup requests. Created on signup, updated on approval/rejection.

**Fields:**
- `uid`: string (document ID)
- `email`: string
- `name`: string
- `displayName`: string
- `phone?`: string
- `company?`: string
- `work?`: string
- `linkedinUsername?`: string
- `position?`: string
- `status`: 'pending' | 'approved' | 'rejected'
- `createdAt`: Timestamp
- `approvedAt?`: Timestamp
- `approvedBy?`: string
- `rejectedAt?`: Timestamp
- `rejectedBy?`: string
- Additional profile fields (bio, city, country, etc.)

### `users/{uid}`
Stores approved member profiles. **Only created when admin approves a join request.**

**Fields:**
- All standard user profile fields
- `status`: 'approved' (always, since only approved users have user docs)
- `role`: 'member' | 'admin'

## Key Changes

### 1. Signup Flow (`src/hooks/useAuth.ts`)
- **OLD**: `createOrUpdateUserProfile()` created `users/{uid}` with `status: 'pending'`
- **NEW**: Creates `joinRequests/{uid}` instead
- User document is NOT created until approval

### 2. Admin Approval (`src/pages/admin/PendingRegistrations.tsx`)
- **OLD**: Updated `users/{uid}` status to 'approved'
- **NEW**: 
  - Updates `joinRequests/{uid}` status to 'approved'
  - Creates `users/{uid}` document from join request data

### 3. Admin Rejection (`src/pages/admin/PendingRegistrations.tsx`)
- **OLD**: Updated `users/{uid}` status to 'rejected'
- **NEW**: 
  - Updates `joinRequests/{uid}` status to 'rejected'
  - Deletes `users/{uid}` if it exists (legacy cleanup)

### 4. Auth Profile Loading (`src/hooks/useAuth.ts`)
- **OLD**: Only checked `users/{uid}`
- **NEW**: 
  - First checks `users/{uid}` (approved users)
  - If not found, checks `joinRequests/{uid}` (pending/rejected users)
  - Returns status from join request if no user doc exists

### 5. Members Page (`src/services/userService.ts`)
- Already filters by `status === 'approved'` at query level
- Since rejected users never have user docs, they never appear
- Since pending users don't have user docs, they never appear

### 6. Pending Registrations Page (`src/pages/admin/PendingRegistrations.tsx`)
- **OLD**: Queried `users` collection with `where('status', '==', 'pending')`
- **NEW**: Queries `joinRequests` collection with `where('status', '==', 'pending')`

### 7. Admin Dashboard & Notifications
- Updated to query `joinRequests` for pending count instead of `users`

## Firestore Security Rules

### `joinRequests/{requestId}`
- Users can read their own join request
- Users can create their own join request (on signup) with `status: 'pending'`
- Only admins can update/delete join requests

### `users/{userId}`
- **IMPORTANT**: Only admins can create user documents
- Regular users cannot create their own user documents
- This prevents signup from creating user docs

## Helper Functions

### `src/utils/userHelpers.ts`
- `isApprovedUser(uid)` - Async function that checks both user doc and join request
- `isPendingUser(uid)` - Checks join request status
- `isRejectedUser(uid)` - Checks join request status
- `getApprovalStatus(uid)` - Returns current approval status

## Firestore Indexes Required

### Index 1: Users by status and updatedAt
```
Collection: users
Fields: status (Ascending), updatedAt (Descending)
```

### Index 2: JoinRequests by status and createdAt
```
Collection: joinRequests
Fields: status (Ascending), createdAt (Descending)
```

Both indexes are defined in `firestore.indexes.json`.

## Migration Notes

### Existing Users
- Existing approved users already have `users/{uid}` documents - no migration needed
- Existing pending users in `users/{uid}` should be migrated to `joinRequests/{uid}`
- Existing rejected users in `users/{uid}` should have their documents deleted

### Cleanup Script (Optional)
A cleanup script could:
1. Find all `users/{uid}` with `status: 'pending'` → Create `joinRequests/{uid}` → Delete `users/{uid}`
2. Find all `users/{uid}` with `status: 'rejected'` → Create `joinRequests/{uid}` → Delete `users/{uid}`

## Testing Checklist

- [ ] New signup creates `joinRequests/{uid}`, NOT `users/{uid}`
- [ ] Admin approval creates `users/{uid}` from join request
- [ ] Admin rejection updates join request and ensures no `users/{uid}` exists
- [ ] Pending users see "Waiting for approval" page
- [ ] Rejected users see "Access denied" page
- [ ] Approved users can access all member features
- [ ] Members page only shows approved users (no pending/rejected)
- [ ] Pending Registrations page shows join requests (not user docs)
- [ ] Admin dashboard shows correct pending count from joinRequests

## Files Changed

1. **NEW**: `src/services/joinRequestService.ts` - Service for managing join requests
2. **MODIFIED**: `src/hooks/useAuth.ts` - Creates join requests instead of user docs
3. **MODIFIED**: `src/pages/admin/PendingRegistrations.tsx` - Uses joinRequests collection
4. **MODIFIED**: `src/pages/admin/AdminDashboard.tsx` - Uses joinRequests for pending count
5. **MODIFIED**: `src/hooks/useNotifications.ts` - Uses joinRequests for pending count
6. **MODIFIED**: `src/utils/userHelpers.ts` - Async helpers that check joinRequests
7. **MODIFIED**: `firestore-admin-enhanced.rules` - Rules for joinRequests collection
8. **MODIFIED**: `firestore.indexes.json` - Added index for joinRequests

## Important Notes

- **UserService.createUser()** is still used for admin-created users (they get user docs immediately)
- Regular signups go through joinRequests flow
- The Members page query already filters by `status === 'approved'`, so it will only show users with user documents
- ProtectedRoute already handles pending/rejected users correctly
