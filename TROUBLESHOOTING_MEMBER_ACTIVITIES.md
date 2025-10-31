# Troubleshooting Member User Activities

## Issue
Member user activities (chat messages, event registration) are not showing up in Activity Management.

## What We Found
Running `npm run check-activities` shows:
- ✅ Admin activities ARE being saved (login, admin_action)
- ❌ NO chat_message activities in database
- ❌ NO event_register activities in database
- ❌ NO page_view activities in database
- ❌ All activities are from admin user only

## Steps to Debug

### 1. Check Browser Console (IMPORTANT!)

When logged in as the **member user**, open DevTools (F12) and:

**A. Check for Success Messages:**
Look for these console logs when performing actions:
```
✅ Activity logged: chat_message
✅ Activity logged: event_register
✅ Activity logged: page_view
```

**B. Check for Errors:**
Look for these error messages:
```
❌ Failed to log activity: [Error details]
```

**C. Check if ActivityTracker is Running:**
You should see page view logs like:
```
✅ Activity logged: page_view
```

### 2. Verify User is Logged In Properly

In the console when the member user is logged in, type:
```javascript
firebase.auth().currentUser
```

Should show the user object with uid, email, displayName.

### 3. Check for Firestore Permission Errors

Look for errors like:
```
FirebaseError: Missing or insufficient permissions
```

This would mean Firestore rules are blocking member users from writing to activity_logs.

### 4. Verify Firestore Rules

Check your Firestore security rules. The `activity_logs` collection should allow:
```
allow create: if request.auth != null;  // Any authenticated user can log activities
```

**NOT:**
```
allow create: if request.auth.token.role == 'admin';  // This would block members!
```

## Quick Fix

### Fix 1: Check Firestore Rules

Go to Firebase Console → Firestore Database → Rules

Make sure you have:
```javascript
match /activity_logs/{activityId} {
  // Allow authenticated users to create activities
  allow create: if request.auth != null;

  // Only admins can read all activities
  allow read: if request.auth != null &&
              get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
}
```

### Fix 2: Verify ActivityTracker Component

Check that `ActivityTracker` is rendered in App.tsx:
```tsx
<Router>
  <ActivityTracker />  {/* This must be here! */}
  <Routes>
    ...
  </Routes>
</Router>
```

### Fix 3: Test with Console Commands

When logged in as member user, open console and run:
```javascript
// Test manual activity logging
import { ActivityService } from './src/services/activityService';

ActivityService.logActivity(
  'test_user_id',
  'test@example.com',
  'Test User',
  'page_view',
  'Manual test activity',
  {}
);
```

Check if it succeeds or throws an error.

## Expected Behavior

When a member user:
1. **Logs in** → Should see "✅ Activity logged: login" in console
2. **Navigates pages** → Should see "✅ Activity logged: page_view" in console
3. **Sends chat message** → Should see "✅ Activity logged: chat_message" in console
4. **Registers for event** → Should see "✅ Activity logged: event_register" in console

Then when admin goes to `/admin/activity`, they should see ALL these activities from the member user.

## Next Steps

1. ✅ Run `npm run check-activities` to see what's in database
2. ✅ Check browser console when member user performs actions
3. ⚠️ Check Firestore security rules
4. ⚠️ Look for permission errors in console
5. ⚠️ Verify ActivityTracker is rendered

## Most Likely Cause

**Firestore security rules are blocking member users from writing to activity_logs collection.**

Check Firebase Console → Firestore → Rules and update them to allow any authenticated user to create activities.
