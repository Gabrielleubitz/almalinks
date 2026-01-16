# End-to-End Verification Guide: Reject and Delete User

## ✅ Step 1: Deployment

### Commit Status
✅ **Committed**: Changes have been committed locally
- Commit hash: `7593625`
- Files included:
  - `api/user-admin.js` (with reject-and-delete-user action)
  - `src/services/joinRequestService.ts`
  - `src/pages/admin/PendingRegistrations.tsx`
  - `package.json`
  - `DEPLOYMENT.md`
  - `BACKEND_ACTION_VERIFICATION.md`

### Push to Deploy
⚠️ **Action Required**: Push to trigger Vercel deployment

```bash
git push origin main
```

**Note**: If you get permission errors, you may need to:
- Configure SSH keys
- Use HTTPS with personal access token
- Or push manually through your Git client

### Verify Deployment Started
1. Go to Vercel Dashboard: https://vercel.com/your-project
2. Check "Deployments" tab
3. Verify new deployment is in progress/completed
4. Check deployment logs for any errors

---

## ✅ Step 2: Verify Deployment

### 2.1 Check Capabilities Endpoint

Once deployment completes, test the capabilities endpoint:

**Using curl:**
```bash
curl https://your-domain.vercel.app/api/user-admin \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"action": "get-capabilities", "adminId": "your-admin-uid"}'
```

**Expected Response:**
```json
{
  "success": true,
  "capabilities": {
    "version": "2024-...",
    "projectId": "your-project-id",
    "availableActions": [
      "create-user",
      "bulk-import",
      "force-password-reset",
      "update-user",
      "get-audit-logs",
      "get-capabilities",
      "reject-and-delete-user"  // ✅ Should be present
    ],
    "firebaseAdminInitialized": true,
    "authAvailable": true,
    "firestoreAvailable": true
  }
}
```

**✅ Success Criteria:**
- `reject-and-delete-user` appears in `availableActions` array
- `success: true`
- No errors in response

**❌ Failure Indicators:**
- `reject-and-delete-user` missing from `availableActions`
- Error message about unknown action
- Deployment not completed yet

### 2.2 Check Server Logs

In Vercel Dashboard:
1. Go to Functions → `user-admin`
2. Check recent logs
3. Look for: `✅ Action "reject-and-delete-user" recognized`

---

## ✅ Step 3: Test Reject Flow

### 3.1 Prepare Test User

1. **Create a test user** (if needed):
   - Sign up with a test email (e.g., `test-reject@example.com`)
   - Complete registration form
   - User should appear in Admin → Pending Registrations

2. **Note the user details**:
   - User UID (from Firestore or browser console)
   - Email address
   - Current status (should be "pending")

### 3.2 Execute Reject

1. **Go to Admin Panel**:
   - Navigate to: Admin → Pending Registrations
   - Find the test user

2. **Click Reject**:
   - Click the "Reject" button
   - Confirm the action if prompted

3. **Monitor Console**:
   - Open browser DevTools → Console
   - Watch for logs:
     - `🗑️ Rejecting and purging user: <uid>`
     - `✅ User rejected and deleted successfully`
     - `✅ Deleted from collections: [...]`

4. **Check UI Feedback**:
   - Should see success toast: "User rejected and fully purged. They can now re-apply with the same email."
   - User should disappear from pending list immediately

---

## ✅ Step 4: Verify Expected Results

### 4.1 Firebase Authentication

**Check:**
1. Go to Firebase Console → Authentication → Users
2. Search for the test user's email
3. **Expected**: User should NOT exist (deleted)

**Verification Command:**
```bash
# If you have Firebase CLI
firebase auth:export users.json
# Then check if user email is in the file
```

**✅ Success**: User not found in Auth
**❌ Failure**: User still exists → Auth deletion failed

### 4.2 Firestore: joinRequests

**Check:**
1. Go to Firebase Console → Firestore Database
2. Navigate to `joinRequests` collection
3. Look for document with ID = user UID
4. **Expected**: Document should NOT exist (deleted)

**✅ Success**: Document not found
**❌ Failure**: Document still exists → Firestore deletion failed

### 4.3 Firestore: users

**Check:**
1. Go to Firebase Console → Firestore Database
2. Navigate to `users` collection
3. Look for document with ID = user UID
4. **Expected**: Document should NOT exist (or never existed for pending users)

**✅ Success**: Document not found
**❌ Failure**: Document still exists → Firestore deletion failed

### 4.4 Email Reusability

**Test:**
1. Go to Signup page
2. Try to sign up with the same email that was rejected
3. **Expected**: Should succeed (no "email already exists" error)
4. New join request should be created

**✅ Success**: Can sign up with same email
**❌ Failure**: "Email already exists" error → Auth user not deleted

---

## 📋 Verification Checklist

Use this checklist to track progress:

### Deployment
- [ ] Code committed locally
- [ ] Code pushed to main branch
- [ ] Vercel deployment triggered
- [ ] Deployment completed successfully
- [ ] No deployment errors in logs

### Capabilities Check
- [ ] Capabilities endpoint accessible
- [ ] `reject-and-delete-user` in availableActions
- [ ] Server logs show action recognized

### Reject Flow Test
- [ ] Test user created
- [ ] Reject button clicked
- [ ] Success message shown
- [ ] User removed from UI
- [ ] No errors in console

### Firebase Auth
- [ ] User deleted from Authentication
- [ ] Email not in Auth users list
- [ ] Can verify deletion in Firebase Console

### Firestore
- [ ] `joinRequests/{uid}` deleted
- [ ] `users/{uid}` does not exist
- [ ] No related documents remain

### Email Reusability
- [ ] Can sign up with same email
- [ ] New join request created
- [ ] No "email already exists" error

---

## 🔍 Troubleshooting

### Issue: "Unknown action" Error Still Appears

**Possible Causes:**
1. Deployment not completed yet
2. Cached response (try hard refresh)
3. Wrong endpoint being called

**Solutions:**
1. Wait for deployment to complete (check Vercel dashboard)
2. Clear browser cache
3. Check network tab to see actual endpoint called
4. Verify capabilities endpoint shows the action

### Issue: Auth User Not Deleted

**Possible Causes:**
1. Service account lacks permissions
2. Auth deletion failed silently
3. Wrong UID used

**Solutions:**
1. Check server logs for Auth deletion errors
2. Verify service account has "Firebase Authentication Admin" role
3. See `FIREBASE_AUTH_DELETION_PERMISSIONS.md`
4. Check UID in request matches Auth user

### Issue: Firestore Docs Not Deleted

**Possible Causes:**
1. Firestore security rules blocking deletion
2. Deletion failed silently
3. Wrong collection paths

**Solutions:**
1. Check server logs for Firestore errors
2. Verify Firestore security rules allow admin deletion
3. Check collection names match exactly

### Issue: Email Still "Already Exists"

**Possible Causes:**
1. Auth user not deleted
2. Multiple Auth users with same email
3. Email in different Auth provider

**Solutions:**
1. Verify Auth deletion succeeded (check Firebase Console)
2. Check for multiple Auth users
3. Try different email to confirm flow works

---

## 📊 Expected Server Logs

When reject is successful, you should see in Vercel function logs:

```
🔍 Processing admin action: reject-and-delete-user by admin <admin-id>
✅ Action "reject-and-delete-user" recognized, calling rejectAndDeleteUser function
🔍 rejectAndDeleteUser function called
🗑️ Admin <admin-id> rejecting and purging user <uid>
📧 User email: <email>
✅ Join request deleted from Firestore
✅ User document deleted from Firestore (or: User document not found)
✅ User deleted from Firebase Auth successfully
✅ Verified: Auth user successfully deleted
✅ Email <email> should now be available for re-signup
✅ Purge complete. Deleted from X location(s)
```

---

## ✅ Final Verification

Once all checks pass:

1. **Reject flow works end-to-end** ✅
2. **Auth user is deleted** ✅
3. **Firestore docs are removed** ✅
4. **Email can be reused** ✅
5. **No errors in logs** ✅

**Status**: 🎉 **Implementation Complete and Verified**

---

## 📝 Notes

- Deployment typically takes 1-3 minutes on Vercel
- If deployment fails, check Vercel dashboard for error details
- Service account permissions must be set before Auth deletion will work
- Test with a non-critical email first
- Keep server logs open during testing for real-time feedback
