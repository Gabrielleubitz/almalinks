# Firestore Indexes Required for Connections Feature

## Issue
The Connections feature on the user dashboard isn't showing connections because the required Firestore composite indexes haven't been created.

## Required Indexes

The following composite indexes are required for the connections feature to work:

### Index 1: Query connections where user is uid1
```
Collection: connections
Fields:
  - uid1 (Ascending)
  - updatedAt (Descending)
Query scope: Collection
```

### Index 2: Query connections where user is uid2
```
Collection: connections
Fields:
  - uid2 (Ascending)
  - updatedAt (Descending)
Query scope: Collection
```

## How to Create the Indexes

### Option 1: Automatic (Recommended)

1. Open your app in the browser: http://localhost:5174/
2. Log in and navigate to the Dashboard
3. Open the browser console (Press F12 or right-click → Inspect → Console tab)
4. Look for an error message like: "The query requires an index..."
5. The error will include a direct link to create the index in Firebase Console
6. Click the link and Firebase will automatically create the index
7. Wait 2-5 minutes for the index to build
8. Refresh your dashboard page

### Option 2: Manual

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `alma-links-test`
3. Navigate to **Firestore Database** → **Indexes** tab
4. Click **Create Index**

**For Index 1:**
- Collection ID: `connections`
- Field 1: `uid1` - Order: `Ascending`
- Field 2: `updatedAt` - Order: `Descending`
- Query scope: `Collection`
- Click **Create**

**For Index 2:**
- Collection ID: `connections`
- Field 1: `uid2` - Order: `Ascending`
- Field 2: `updatedAt` - Order: `Descending`
- Query scope: `Collection`
- Click **Create**

5. Wait 2-5 minutes for indexing to complete

## Testing After Index Creation

Once the indexes are built:

1. Refresh your dashboard: http://localhost:5174/
2. The "My Connections" section should now display your connections
3. You should be able to filter by event using the dropdown
4. Profile images and connection details should display correctly

## Why This Happened

Firestore requires composite indexes for queries that combine:
- A `where` clause filtering on a field (e.g., `where('uid1', '==', userId)`)
- An `orderBy` clause sorting on a different field (e.g., `orderBy('updatedAt', 'desc')`)

These indexes weren't created automatically and must be manually added in the Firebase Console.

## Additional Notes

- Indexes are project-wide and only need to be created once
- Index building typically takes 2-5 minutes for small collections
- For large collections, it may take longer
- Once built, queries will be fast and efficient
