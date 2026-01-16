# Deploy Firestore Index for joinRequests

## Index Definition

The required index is already defined in `firestore.indexes.json`:

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

This matches the query:
```javascript
query(
  collection(db, 'joinRequests'),
  where('status', '==', 'pending'),
  orderBy('createdAt', 'desc')
)
```

## Deploy the Index

### Option 1: Using Firebase CLI (Recommended)

1. **Install Firebase CLI** (if not already installed):
   ```bash
   npm install -g firebase-tools
   ```

2. **Login to Firebase**:
   ```bash
   firebase login
   ```

3. **Deploy the index**:
   ```bash
   firebase deploy --only firestore:indexes
   ```

4. **Wait for index to build** (2-5 minutes):
   - Check status in Firebase Console → Firestore → Indexes
   - Status will show "Building" then "Enabled" when ready

### Option 2: Automatic via Browser Console

1. Navigate to Admin → Pending Registrations page
2. Open browser console (F12)
3. Look for error message with link to create index
4. Click the link to create index automatically
5. Wait 2-5 minutes for index to build

### Option 3: Manual in Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Navigate to **Firestore Database** → **Indexes** tab
4. Click **Create Index**
5. Set:
   - **Collection ID**: `joinRequests`
   - **Field 1**: `status` - Order: `Ascending`
   - **Field 2**: `createdAt` - Order: `Descending`
   - **Query scope**: `Collection`
6. Click **Create**
7. Wait 2-5 minutes for indexing to complete

## Verify Index is Deployed

1. Go to Firebase Console → Firestore → Indexes
2. Look for index with:
   - Collection: `joinRequests`
   - Fields: `status` (Ascending), `createdAt` (Descending)
3. Status should be "Enabled" (not "Building")

## Testing

After the index is enabled:
1. Navigate to Admin → Pending Registrations
2. Page should load without errors
3. Pending requests should appear sorted by newest first
4. No console errors about missing indexes

## Troubleshooting

**If index deployment fails:**
- Check Firebase CLI is logged in: `firebase login`
- Verify project is selected: `firebase use <project-id>`
- Check `firebase.json` references `firestore.indexes.json` correctly

**If index exists but query still fails:**
- Verify index status is "Enabled" (not "Building")
- Check index fields match query exactly:
  - `status` must be first field (ASCENDING)
  - `createdAt` must be second field (DESCENDING)
- Ensure query scope matches (COLLECTION vs COLLECTION_GROUP)
