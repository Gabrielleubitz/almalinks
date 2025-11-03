# Member Map Feature - Setup Instructions

## Important: Vercel Function Consolidation

The Member Map API endpoint has been consolidated into `api/user-admin.js` to stay within Vercel Hobby plan's 12 function limit. The endpoint `/api/users-locations` still works the same way - it's just routed through user-admin.js internally.

## Firestore Index Required

The Member Map uses an efficient query that requires a Firestore composite index:

```
Collection: users
Fields: city (!=) + country (!=)
```

### How to Create the Index:

**Option 1: Automatic (Recommended)**
1. Try opening the Member Map in your app
2. If the index doesn't exist, you'll see an error in the console with a link
3. Click the link to automatically create the index in Firebase Console
4. Wait 2-5 minutes for the index to build

**Option 2: Manual**
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `alma-links-test`
3. Navigate to **Firestore Database** → **Indexes** tab
4. Click **Create Index**
5. Set:
   - Collection ID: `users`
   - Field 1: `city` - Order: `Ascending`
   - Field 2: `country` - Order: `Ascending`
6. Query scope: `Collection`
7. Click **Create**
8. Wait 2-5 minutes for indexing to complete

## Performance Optimizations

### 1. Server-Side Caching (✅ Implemented)
- Results cached for 10 minutes in server memory
- Subsequent requests within 10 minutes return cached data instantly
- Zero Firestore reads for cached requests

### 2. Efficient Firestore Query (✅ Implemented)
- Only fetches users with BOTH city AND country populated
- Avoids reading thousands of users without location data
- Limit of 1000 users (adjustable if needed)

### 3. Rate Limit Protection
- 10-minute cache prevents hitting Firebase rate limits
- Suitable for Firebase Spark (free) plan

## Scalability

**Current Setup handles:**
- ✅ Up to 1,000 users with location data
- ✅ Unlimited map views (cached)
- ✅ Firebase Spark plan compatible

**For 1,000+ users:**
- Increase limit in `api/user-admin.js` getUserLocations function (line 595)
- Consider pagination or geographic clustering
- Upgrade to Firebase Blaze plan for higher quotas

## Testing After Rate Limit Reset

Once Firebase rate limits reset (30-60 minutes), test by:
1. Navigate to Members page: `http://localhost:5174/members`
2. Click "View Map" button
3. First load: Fetches from Firestore (logs "Fetching users...")
4. Subsequent loads within 10 min: Instant (logs "Serving cached...")

## Cache Invalidation

Cache automatically expires after 10 minutes. To clear manually:
- Restart the dev server: `npm run dev`

## Production Deployment

For production (Vercel/Netlify):
- Cache persists per serverless function instance
- Each function instance has its own cache
- Cold starts fetch fresh data
- Warm instances serve cached data

## Cost Estimation (Firebase)

**Spark Plan (Free):**
- 50K reads/day
- With 10-min cache: ~144 Firestore reads/day (6 per hour)
- Supports ~347 users with locations (50K / 144)

**Blaze Plan (Pay-as-you-go):**
- $0.06 per 100K reads
- With caching: ~$0.01/month for typical usage
