# Deploy Firestore Indexes

Two composite indexes are defined in `firestore.indexes.json`. Deploy both with:

```bash
firebase deploy --only firestore:indexes
```

Wait 2–5 minutes for indexes to build, then refresh the app.

---

## 1. joinRequests index (Pending Registrations)

## ✅ Index Definition Verified

The index is **correctly defined** in `firestore.indexes.json`:

```json
{
  "collectionGroup": "joinRequests",
  "queryScope": "COLLECTION",
  "fields": [
    {
      "fieldPath": "status",
      "order": "ASCENDING"
    },
    {
      "fieldPath": "createdAt",
      "order": "DESCENDING"
    }
  ]
}
```

**This matches the query exactly:**
- `where('status', '==', 'pending')` → requires `status` field (ASCENDING) ✓
- `orderBy('createdAt', 'desc')` → requires `createdAt` field (DESCENDING) ✓

## 🚀 Deploy the Index

The index is defined but needs to be deployed to Firebase. Choose one method:

### Method 1: Firebase CLI (Recommended - Version Controlled)

```bash
# 1. Install Firebase CLI (if not installed)
npm install -g firebase-tools

# 2. Login to Firebase
firebase login

# 3. Select your project (if needed)
firebase use <your-project-id>

# 4. Deploy the index
firebase deploy --only firestore:indexes
```

**Expected output:**
```
✔  Deploy complete!

Firestore indexes have been deployed successfully.
```

**Wait 2-5 minutes** for the index to build, then refresh the admin page.

### Method 2: Automatic via Browser Console

1. Navigate to **Admin → Pending Registrations** page
2. Open browser console (F12)
3. Look for error message with a link like:
   ```
   https://console.firebase.google.com/project/.../firestore/indexes?create_composite=...
   ```
4. Click the link to create the index automatically
5. Wait 2-5 minutes for index to build
6. Refresh the page

### Method 3: Manual in Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Navigate to **Firestore Database** → **Indexes** tab
4. Click **Create Index**
5. Configure:
   - **Collection ID**: `joinRequests`
   - **Field 1**: `status` - Order: `Ascending`
   - **Field 2**: `createdAt` - Order: `Descending`
   - **Query scope**: `Collection`
6. Click **Create**
7. Wait 2-5 minutes for status to change from "Building" to "Enabled"

## ✅ Verify Index is Deployed

1. Go to Firebase Console → Firestore → Indexes
2. Look for index with:
   - Collection: `joinRequests`
   - Fields: `status` (Ascending), `createdAt` (Descending)
3. Status should be **"Enabled"** (green checkmark)

## 🧪 Testing

After index is enabled:
1. Navigate to **Admin → Pending Registrations**
2. Page should load **without errors**
3. Pending requests should appear **sorted by newest first**
4. No console errors about missing indexes
5. Realtime listener should work correctly

## 📋 Index Details

- **Collection**: `joinRequests`
- **Query Scope**: `COLLECTION` (single collection, not collection group)
- **Field 1**: `status` - `ASCENDING`
- **Field 2**: `createdAt` - `DESCENDING`
- **Purpose**: Query pending join requests sorted by creation date (newest first)

---

## 2. users index (Members directory / Email autocomplete)

- **Collection**: `users`
- **Fields**: `status` (ASCENDING), `updatedAt` (DESCENDING)
- **Purpose**: `getAllMembersForDirectory` – approved users sorted by `updatedAt` (newest first). Used by Members page, Create Chat Group, and Email Recipient Autocomplete.

If this index is not deployed, the app falls back to a query without `orderBy` and sorts in memory; the console will show:  
`⚠️ Index required: users collection, fields: status (Ascending), updatedAt (Descending)`.  
Deploy with `firebase deploy --only firestore:indexes` to remove the warning and use the index.

## ⚠️ Troubleshooting

**If deployment fails:**
- Ensure Firebase CLI is logged in: `firebase login`
- Verify project is selected: `firebase use <project-id>`
- Check `firebase.json` references `firestore.indexes.json` correctly (it does ✓)

**If index exists but query still fails:**
- Verify index status is **"Enabled"** (not "Building")
- Check index fields match query exactly (they do ✓)
- Ensure query scope matches: `COLLECTION` (not `COLLECTION_GROUP`)

**If index is building:**
- Wait 2-5 minutes for small collections
- Can take longer for large collections
- Check Firebase Console → Firestore → Indexes for status
