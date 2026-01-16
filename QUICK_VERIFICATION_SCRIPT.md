# Quick Verification Script

## After Pushing to Main

Run these commands to verify deployment:

### 1. Check Deployment Status

```bash
# Check if code is pushed
git log --oneline -1

# Should show: "Deploy: Add reject-and-delete-user action..."
```

### 2. Test Capabilities Endpoint

Replace `YOUR_DOMAIN` and `YOUR_ADMIN_UID`:

```bash
curl https://YOUR_DOMAIN.vercel.app/api/user-admin \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"action": "get-capabilities", "adminId": "YOUR_ADMIN_UID"}' \
  | jq '.capabilities.availableActions'
```

**Expected output:**
```json
[
  "create-user",
  "bulk-import",
  "force-password-reset",
  "update-user",
  "get-audit-logs",
  "get-capabilities",
  "reject-and-delete-user"  // ✅ Must be present
]
```

### 3. Manual Test Steps

1. **Open Admin Panel** → Pending Registrations
2. **Click Reject** on a test user
3. **Check Console** for success messages
4. **Verify in Firebase Console**:
   - Authentication → Users: User deleted
   - Firestore → joinRequests: Document deleted
5. **Test Signup**: Try to sign up with same email (should work)

---

## One-Liner Test

```bash
# Test if action is available (replace YOUR_DOMAIN and ADMIN_UID)
curl -s https://YOUR_DOMAIN.vercel.app/api/user-admin \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"action": "get-capabilities", "adminId": "ADMIN_UID"}' \
  | grep -q "reject-and-delete-user" && echo "✅ Action available" || echo "❌ Action missing"
```
