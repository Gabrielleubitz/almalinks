# Reject and Delete User Action Implementation

## Overview

The `reject-and-delete-user` action is now fully implemented and wired in the backend. This document explains the implementation and how to verify it's working.

## Backend Implementation

### Action Router (`api/user-admin.js`)

**Location**: Lines 114-132

The action is registered in the switch statement:

```javascript
switch (action) {
  case 'create-user':
    return await createUser(req, res, adminId);
  case 'bulk-import':
    return await bulkImport(req, res, adminId);
  case 'force-password-reset':
    return await forcePasswordReset(req, res, adminId);
  case 'update-user':
    return await updateUser(req, res, adminId);
  case 'get-audit-logs':
    return await getAuditLogs(req, res, adminId);
  case 'reject-and-delete-user':  // ✅ Action is registered
    console.log('✅ Action "reject-and-delete-user" recognized, calling rejectAndDeleteUser function');
    return await rejectAndDeleteUser(req, res, adminId);
  default:
    return res.status(400).json({ 
      success: false, 
      error: `Unknown action: ${action}. Available actions: create-user, bulk-import, force-password-reset, update-user, get-audit-logs, reject-and-delete-user`,
      receivedAction: action,
      availableActions: ['create-user', 'bulk-import', 'force-password-reset', 'update-user', 'get-audit-logs', 'reject-and-delete-user']
    });
}
```

### Function Implementation (`api/user-admin.js`)

**Location**: Lines 774-1070

The `rejectAndDeleteUser` function:
1. Verifies admin permissions (already done in main handler)
2. Deletes `joinRequests/{uid}`
3. Deletes `users/{uid}` (if exists)
4. Deletes `registrations/{uid}` (if exists)
5. Deletes all event registrations
6. **Deletes Firebase Auth user** (critical - frees email)
7. Returns success response

## Frontend Implementation

### Service Method (`src/services/joinRequestService.ts`)

**Method**: `rejectAndDeleteUser(uid: string, adminId: string)`

**Request**:
```typescript
{
  action: 'reject-and-delete-user',
  uid: string,
  adminId: string
}
```

**Error Handling**:
- Detects "Unknown action" errors specifically
- Detects permission errors
- Shows actionable error messages

### Admin UI (`src/pages/admin/PendingRegistrations.tsx`)

**Function**: `handleRejectUser(userId: string)`

**Behavior**:
- Calls `JoinRequestService.rejectAndDeleteUser()`
- Shows accurate error messages based on error type
- Removes user from UI on success

## Error Messages

### "Unknown Action" Error

**When it occurs**: Backend doesn't recognize the action (code not deployed or outdated)

**Frontend message**: 
```
Reject failed: Server doesn't support reject-and-delete-user action yet. 
The backend may need to be updated or redeployed. 
Please contact the development team.
```

**Backend response**:
```json
{
  "success": false,
  "error": "Unknown action: reject-and-delete-user. Available actions: ...",
  "receivedAction": "reject-and-delete-user",
  "availableActions": [...]
}
```

### Permission Error

**When it occurs**: Service account lacks Firebase Authentication Admin role

**Frontend message**:
```
Reject failed: Backend lacks permission to delete Auth users. 
Service account needs "Firebase Authentication Admin" role. 
See console for details.
```

**Backend response**:
```json
{
  "success": false,
  "error": "Backend lacks permission to delete Firebase Auth users...",
  "permissionError": true,
  "serviceAccount": "...",
  "projectId": "...",
  "requiredRole": "Firebase Authentication Admin"
}
```

## Verification Steps

### 1. Check Backend Logs

When you click Reject, you should see:
```
🔍 Processing admin action: reject-and-delete-user by admin <admin-id>
✅ Action "reject-and-delete-user" recognized, calling rejectAndDeleteUser function
🔍 rejectAndDeleteUser function called
🗑️ Admin <admin-id> rejecting and purging user <uid>
```

If you see:
```
❌ Unknown action received: reject-and-delete-user
```

Then the backend code hasn't been deployed or is outdated.

### 2. Check Frontend Console

You should see:
```
🗑️ Rejecting and purging user: <uid>
🔍 Calling server endpoint: /api/user-admin with action: reject-and-delete-user
📥 Server response status: 200 OK
✅ User rejected and deleted successfully
```

### 3. Test the Flow

1. Go to Admin → Pending Registrations
2. Click **Reject** on a test user
3. Check console logs (both frontend and backend)
4. Verify user is removed from UI
5. Check Firebase Console → Authentication
   - User should be deleted
6. Try to sign up with the same email
   - Should succeed (no "email already exists" error)

## Troubleshooting

### Error: "Unknown action: reject-and-delete-user"

**Possible causes**:
1. Backend code not deployed
2. Different version of code running
3. Caching issue

**Solutions**:
1. Redeploy the backend (`api/user-admin.js`)
2. Clear any caches
3. Verify the deployed code includes the action in the switch statement
4. Check server logs to see what actions are available

### Error: "Backend lacks permission to delete Auth users"

**Solution**: See `FIREBASE_AUTH_DELETION_PERMISSIONS.md`

Grant "Firebase Authentication Admin" role to the service account.

### Action Not Working After Deployment

1. Verify the function `rejectAndDeleteUser` is defined in the file
2. Verify it's exported/accessible (it should be since it's in the same file)
3. Check for syntax errors in the switch statement
4. Verify the action name matches exactly: `'reject-and-delete-user'` (with hyphens)

## Files Modified

1. **`api/user-admin.js`**
   - Added action to switch statement (line 125-126)
   - Enhanced logging for action processing
   - Function already implemented (line 774+)

2. **`src/services/joinRequestService.ts`**
   - Enhanced error handling to detect "Unknown action" errors
   - Improved error messages

3. **`src/pages/admin/PendingRegistrations.tsx`**
   - Enhanced error handling to show accurate messages
   - Distinguishes between "unknown action" and "permission" errors

## Deployment Checklist

- [ ] Backend code (`api/user-admin.js`) is deployed
- [ ] Frontend code is deployed
- [ ] Service account has "Firebase Authentication Admin" role
- [ ] Test reject flow works end-to-end
- [ ] Verify Auth user is deleted
- [ ] Verify email can be reused for signup
