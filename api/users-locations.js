// Users Locations API - Fetch all users with location data for the Member Map
import { db } from './firebase-init.js';

// In-memory cache to avoid hitting Firestore repeatedly
let cachedLocations = null;
let cacheTimestamp = null;
const CACHE_DURATION_MS = 10 * 60 * 1000; // 10 minutes

export default async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
  }

  try {
    // Check if we have valid cached data
    const now = Date.now();
    if (cachedLocations && cacheTimestamp && (now - cacheTimestamp < CACHE_DURATION_MS)) {
      console.log(`✅ Serving ${cachedLocations.length} cached user locations (${Math.floor((now - cacheTimestamp) / 1000)}s old)`);
      return res.status(200).json(cachedLocations);
    }

    console.log('🗺️  Fetching users with location data from Firestore...');

    // EFFICIENT QUERY: Only fetch users who have BOTH city AND country
    // This dramatically reduces the number of documents we need to read
    const usersSnapshot = await db.collection('users')
      .where('city', '!=', null)
      .where('country', '!=', null)
      .limit(1000) // Reasonable limit for most use cases
      .get();

    const usersWithLocations = [];

    usersSnapshot.forEach(doc => {
      const userData = doc.data();

      // Double-check both fields exist (Firestore != null can be quirky)
      if (userData.city && userData.country) {
        // Construct profile URL
        const profileUrl = `/profile/${doc.id}`;

        // Use displayName, or construct from firstName/lastName, or use email
        const username = userData.displayName ||
                        `${userData.firstName || ''} ${userData.lastName || ''}`.trim() ||
                        userData.email ||
                        'Unknown User';

        usersWithLocations.push({
          username,
          city: userData.city,
          country: userData.country,
          profileUrl
        });
      }
    });

    // Cache the results
    cachedLocations = usersWithLocations;
    cacheTimestamp = now;

    console.log(`✅ Found and cached ${usersWithLocations.length} users with location data (${usersSnapshot.size} documents read)`);

    return res.status(200).json(usersWithLocations);

  } catch (error) {
    console.error('❌ Error fetching users with locations:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      stack: error.stack
    });
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch users with locations',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}
