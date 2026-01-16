# ⚠️ DEPLOYMENT REQUIRED: Reject and Delete User Action

## Critical: Backend Must Be Redeployed

The `reject-and-delete-user` action has been added to the backend code (`api/user-admin.js`), but **it will not work until the backend is redeployed**.

## Current Status

✅ **Code is implemented** in `api/user-admin.js`:
- Action is registered in switch statement (line 128-130)
- Function `rejectAndDeleteUser` is implemented (line 782+)
- All deletion logic is in place

❌ **Code is NOT deployed** - The error "Unknown action: reject-and-delete-user" indicates the deployed version doesn't have this action.

## Deployment Steps

### For Vercel Deployment

1. **Commit the changes**:
   ```bash
   git add api/user-admin.js
   git commit -m "Add reject-and-delete-user action to backend"
   git push
   ```

2. **Vercel will auto-deploy** if connected to your repo, OR

3. **Manual deploy**:
   ```bash
   vercel --prod
   ```

### For Netlify Deployment

1. **Commit and push** the changes
2. **Netlify will auto-deploy** if connected to your repo, OR
3. **Trigger manual deploy** from Netlify dashboard

### For Firebase Functions

1. **Deploy the function**:
   ```bash
   firebase deploy --only functions:userAdmin
   ```

2. **Or if using a different function name**, check your `firebase.json` and deploy accordingly

### For Other Platforms

- **AWS Lambda**: Deploy the updated `api/user-admin.js` file
- **Google Cloud Functions**: Deploy the updated function
- **Custom server**: Restart the server with the updated code

## Verification After Deployment

1. **Check server logs** when clicking Reject:
   - Should see: `✅ Action "reject-and-delete-user" recognized`
   - Should NOT see: `❌ Unknown action received`

2. **Test the reject flow**:
   - Go to Admin → Pending Registrations
   - Click Reject on a test user
   - Should succeed (no "Unknown action" error)
   - User should be deleted from Firebase Auth
   - Email should be available for re-signup

3. **Check backend response**:
   - Should return `{ success: true, ... }`
   - Should NOT return `{ error: "Unknown action: ..." }`

## Files That Need Deployment

- ✅ `api/user-admin.js` - **MUST BE DEPLOYED**

## What Happens If Not Deployed

- ❌ Reject button will fail with "Unknown action" error
- ❌ Users cannot be properly rejected
- ❌ Firebase Auth users remain (email stays "taken")
- ❌ Rejected users cannot re-signup

## Quick Check: Is It Deployed?

Check your deployment platform's logs when clicking Reject. If you see:
- `✅ Action "reject-and-delete-user" recognized` → **Deployed correctly**
- `❌ Unknown action received: reject-and-delete-user` → **NOT deployed, needs deployment**

## After Deployment

Once deployed, the reject flow should work end-to-end:
1. Admin clicks Reject
2. Backend receives `action: 'reject-and-delete-user'`
3. Backend deletes Firebase Auth user
4. Backend deletes Firestore docs
5. User can re-signup with same email

---

**⚠️ IMPORTANT**: Do not skip deployment. The code changes are useless without deployment.
