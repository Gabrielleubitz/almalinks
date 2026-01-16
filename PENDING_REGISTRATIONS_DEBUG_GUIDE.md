# Pending Registrations Debug Guide

## Changes Made

### 1. Enhanced Logging in Signup Flow (`src/services/joinRequestService.ts`)
- Added Firebase project ID logging to verify correct environment
- Added detailed logging of form data received
- Enhanced error logging with permission error detection
- Added verification logging after document creation

### 2. Enhanced Logging in Admin Panel (`src/pages/admin/PendingRegistrations.tsx`)
- Added Firebase project ID logging
- Added current user UID and email logging
- Added query details logging (collection, filters, orderBy)
- Added snapshot metadata logging (fromCache, hasPendingWrites)
- Added per-document logging showing status, email, name, createdAt
- Added empty result warnings with possible causes
- Added debug panel (development only) showing:
  - Firebase project ID
  - Current user UID and email
  - Query details
  - Number of results found

### 3. Fixed `onAuthStateChanged` Handler (`src/hooks/useAuth.ts`)
- Improved logic when no user profile is found
- Now properly re-fetches profile after join request creation
- Ensures join request status is properly reflected in user state

### 4. Security Rules (Already Fixed)
- `isAdminForQuery()` function allows admins to query joinRequests
- `joinRequests` read rule allows admins to read all requests

## Verification Steps

### Step 1: Test Signup Flow

1. **Open browser console** (F12)
2. **Navigate to signup page**
3. **Fill out signup form** and submit
4. **Check console logs** for:
   ```
   🔍 DEBUG: Firebase Project ID: <your-project-id>
   📝 Creating join request for: <uid>
   ✅ Join request created successfully
   ✅ Verified join request document exists in Firestore
   ```
5. **Verify in Firestore Console:**
   - Go to Firebase Console → Firestore
   - Check `joinRequests` collection
   - Find document with UID from signup
   - Verify fields:
     - `status: 'pending'`
     - `createdAt: <timestamp>`
     - `email: <email>`
     - `name: <name>`
     - All other form fields present

### Step 2: Test Admin Panel

1. **Log in as admin user**
2. **Navigate to Admin → Pending Registrations**
3. **Open browser console** (F12)
4. **Check console logs** for:
   ```
   🔍 DEBUG: Firebase Project ID: <your-project-id>
   🔍 DEBUG: Current user UID: <admin-uid>
   🔍 DEBUG: Current user email: <admin-email>
   👂 Setting up realtime listener for pending join requests
   📋 Query: collection="joinRequests", where status == "pending", orderBy createdAt desc
   ✅ Query created, setting up onSnapshot listener...
   📥 Received update from joinRequests listener: X pending requests
   ```
5. **Check debug panel** (if in development mode):
   - Shows Firebase project ID
   - Shows current user UID and email
   - Shows query details
   - Shows number of pending requests found
6. **Verify UI shows pending requests:**
   - Requests should appear in the list
   - Each request shows name, email, phone, company, work, etc.

### Step 3: Check for Errors

**If signup fails:**
- Check console for permission-denied errors
- Verify Firestore rules allow users to create their own join request
- Check that `joinRequests/{uid}` document is created with correct fields

**If admin panel is empty:**
- Check console for permission-denied errors
- Verify admin user has `role: 'admin'` in `users/{adminUid}` document
- Check that `isAdminForQuery()` function works (should return true for admin)
- Verify query is using correct collection name: `joinRequests` (not `joinRequest`)
- Verify query filter: `status == 'pending'` (exact string match)
- Check if index is required (error will show link to create index)

**If query returns empty but documents exist:**
- Check that documents have `status: 'pending'` (exact string, not 'Pending' or 'PENDING')
- Check that documents have `createdAt` field (serverTimestamp should set this)
- Verify you're looking at the correct Firebase project (check project ID in debug panel)

## Common Issues

### Issue: "Permission denied" error in admin panel

**Solution:**
1. Verify admin user has `role: 'admin'` in `users/{adminUid}` document
2. Deploy Firestore rules: `firebase deploy --only firestore:rules`
3. Check that `isAdminForQuery()` function is working (should not require `resource`)

### Issue: Signup creates `users/{uid}` instead of `joinRequests/{uid}`

**Solution:**
1. Check that `createOrUpdateUserProfile` is not being called with existing user data
2. Verify `createOrUpdateUserProfile` checks `!userDoc.exists()` before creating join request
3. Check that no other code path creates `users/{uid}` on signup

### Issue: Admin panel shows 0 requests but documents exist

**Possible causes:**
1. **Wrong Firebase project:** Check project ID in debug panel matches Firestore Console
2. **Wrong collection name:** Verify collection is `joinRequests` (plural)
3. **Status mismatch:** Verify documents have `status: 'pending'` (exact string)
4. **Security rules:** Check that admin can read joinRequests
5. **Index missing:** If using `orderBy`, ensure index is created and enabled

### Issue: `createdAt` field is missing

**Solution:**
1. Verify `serverTimestamp()` is used when creating join request
2. Wait a few seconds for serverTimestamp to resolve
3. Check Firestore Console to see if `createdAt` appears after a moment

## Testing Checklist

- [ ] Signup creates `joinRequests/{uid}` document
- [ ] `joinRequests/{uid}` has `status: 'pending'`
- [ ] `joinRequests/{uid}` has `createdAt` timestamp
- [ ] `joinRequests/{uid}` has all form fields (email, name, phone, company, work, etc.)
- [ ] No `users/{uid}` document is created on signup
- [ ] Admin panel shows pending requests
- [ ] Admin panel query uses correct collection and filters
- [ ] Admin panel shows debug info (in development)
- [ ] Console logs show Firebase project ID
- [ ] Console logs show query details
- [ ] Console logs show number of results
- [ ] No permission-denied errors
- [ ] No index errors (or index is created and enabled)

## Next Steps

1. **Deploy Firestore rules** (if not already deployed):
   ```bash
   firebase deploy --only firestore:rules
   ```

2. **Deploy Firestore indexes** (if index error appears):
   ```bash
   firebase deploy --only firestore:indexes
   ```

3. **Test signup flow** and verify join request is created

4. **Test admin panel** and verify pending requests appear

5. **Check console logs** for any errors or warnings

6. **Verify in Firestore Console** that documents exist with correct structure
