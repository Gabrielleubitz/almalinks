# Backend Deployment Guide

## Overview

This project uses **Vercel** for serverless function deployment. The backend API functions are located in the `api/` directory and are automatically deployed when code is pushed to the main branch.

## Deployment Structure

### Serverless Functions Location

- **Directory**: `api/`
- **Main Admin Handler**: `api/user-admin.js`
- **Deployment Platform**: Vercel (configured via `vercel.json`)

### How Vercel Deploys Functions

Vercel automatically detects files in the `api/` directory and deploys them as serverless functions:
- `api/user-admin.js` → Available at `/api/user-admin`
- Each file exports a default async function handler

## Deployment Steps

### Automatic Deployment (Recommended)

1. **Commit your changes**:
   ```bash
   git add api/user-admin.js
   git commit -m "Add reject-and-delete-user action"
   git push origin main
   ```

2. **Vercel auto-deploys**:
   - Vercel is connected to your GitHub repository
   - Pushing to `main` branch triggers automatic deployment
   - Check Vercel dashboard for deployment status

### Manual Deployment

If you need to deploy manually:

```bash
# Install Vercel CLI (if not already installed)
npm i -g vercel

# Deploy to production
vercel --prod
```

### Verify Deployment

1. **Check Vercel Dashboard**:
   - Go to your Vercel project dashboard
   - Check "Deployments" tab
   - Verify latest deployment includes your changes

2. **Test the endpoint**:
   ```bash
   # Test capabilities endpoint (no auth required for this check)
   curl https://your-domain.vercel.app/api/user-admin \
     -X POST \
     -H "Content-Type: application/json" \
     -d '{"action": "get-capabilities", "adminId": "test"}'
   ```

3. **Check server logs**:
   - In Vercel dashboard, go to "Functions" → "user-admin"
   - Check logs when calling the endpoint
   - Should see: `✅ Action "reject-and-delete-user" recognized`

## Current Backend Actions

The following actions are available in `api/user-admin.js`:

- ✅ `create-user` - Create new user with temporary password
- ✅ `bulk-import` - Bulk import users from CSV
- ✅ `force-password-reset` - Force password reset for user
- ✅ `update-user` - Update user profile
- ✅ `get-audit-logs` - Get audit logs
- ✅ `get-capabilities` - Get server capabilities and version
- ✅ `reject-and-delete-user` - **Reject and fully delete user (Auth + Firestore)**

## Troubleshooting

### "Unknown action" Error

**Symptom**: Server returns "Unknown action: reject-and-delete-user"

**Cause**: Backend code not deployed or outdated

**Solution**:
1. Verify `api/user-admin.js` has the action in switch statement
2. Commit and push changes
3. Wait for Vercel deployment to complete
4. Check Vercel dashboard for deployment status

### Check Deployment Status

```bash
# Using Vercel CLI
vercel ls

# Or check Vercel dashboard
# https://vercel.com/your-project/deployments
```

### Verify Code is Deployed

Call the capabilities endpoint:

```bash
curl https://your-domain.vercel.app/api/user-admin \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"action": "get-capabilities", "adminId": "your-admin-id"}'
```

Response should include `reject-and-delete-user` in `availableActions`.

## Environment Variables

Ensure these are set in Vercel dashboard:

- `FIREBASE_SERVICE_ACCOUNT_KEY` - Firebase service account JSON (base64 encoded)
- OR individual variables:
  - `FIREBASE_PROJECT_ID`
  - `FIREBASE_CLIENT_EMAIL`
  - `FIREBASE_PRIVATE_KEY`

## Deployment Checklist

Before deploying:

- [ ] Code is committed to git
- [ ] `api/user-admin.js` includes the new action
- [ ] All environment variables are set in Vercel
- [ ] Test locally if possible (`npm run dev:api`)

After deploying:

- [ ] Check Vercel deployment logs
- [ ] Test capabilities endpoint
- [ ] Test reject action in admin panel
- [ ] Verify Auth user is deleted
- [ ] Verify email can be reused

## Quick Deploy Command

```bash
# One-liner to commit and push (triggers auto-deploy)
git add api/user-admin.js && \
git commit -m "Deploy: Add reject-and-delete-user action" && \
git push origin main
```

## Monitoring

- **Vercel Dashboard**: https://vercel.com/your-project
- **Function Logs**: Vercel Dashboard → Functions → user-admin → Logs
- **Deployment History**: Vercel Dashboard → Deployments

---

**⚠️ IMPORTANT**: Always verify deployment after pushing changes. The code is useless if not deployed!
