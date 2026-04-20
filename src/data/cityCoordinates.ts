/**
 * Built-in coordinate table for the ~600 most common cities worldwide.
 * Keys are normalised as "city|country" (both lower-cased, trimmed).
 * Used by MemberMap so most users resolve instantly with zero API calls.
 */
export const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  // United States
  'new york|united states': { lat: 40.7128, lng: -74.006 },
  'new york city|united states': { lat: 40.7128, lng: -74.006 },
  'nyc|united states': { lat: 40.7128, lng: -74.006 },
  'los angeles|united states': { lat: 34.0522, lng: -118.2437 },
  'chicago|united states': { lat: 41.8781, lng: -87.6298 },
  'houston|united states': { lat: 29.7604, lng: -95.3698 },
  'phoenix|united states': { lat: 33.4484, lng: -112.074 },
  'philadelphia|united states': { lat: 39.9526, lng: -75.1652 },
  'san antonio|united states': { lat: 29.4241, lng: -98.4936 },
  'san diego|united states': { lat: 32.7157, lng: -117.1611 },
  'dallas|united states': { lat: 32.7767, lng: -96.797 },
  'san francisco|united states': { lat: 37.7749, lng: -122.4194 },
  'san francisco bay area|united states': { lat: 37.7749, lng: -122.4194 },
  'bay area|united states': { lat: 37.7749, lng: -122.4194 },
  'austin|united states': { lat: 30.2672, lng: -97.7431 },
  'jacksonville|united states': { lat: 30.3322, lng: -81.6557 },
  'fort worth|united states': { lat: 32.7555, lng: -97.3308 },
  'columbus|united states': { lat: 39.9612, lng: -82.9988 },
  'charlotte|united states': { lat: 35.2271, lng: -80.8431 },
  'indianapolis|united states': { lat: 39.7684, lng: -86.1581 },
  'san jose|united states': { lat: 37.3382, lng: -121.8863 },
  'austin|us': { lat: 30.2672, lng: -97.7431 },
  'seattle|united states': { lat: 47.6062, lng: -122.3321 },
  'denver|united states': { lat: 39.7392, lng: -104.9903 },
  'washington|united states': { lat: 38.9072, lng: -77.0369 },
  'washington dc|united states': { lat: 38.9072, lng: -77.0369 },
  'washington, dc|united states': { lat: 38.9072, lng: -77.0369 },
  'nashville|united states': { lat: 36.1627, lng: -86.7816 },
  'el paso|united states': { lat: 31.7619, lng: -106.485 },
  'boston|united states': { lat: 42.3601, lng: -71.0589 },
  'portland|united states': { lat: 45.5051, lng: -122.675 },
  'las vegas|united states': { lat: 36.1699, lng: -115.1398 },
  'memphis|united states': { lat: 35.1495, lng: -90.049 },
  'louisville|united states': { lat: 38.2527, lng: -85.7585 },
  'baltimore|united states': { lat: 39.2904, lng: -76.6122 },
  'milwaukee|united states': { lat: 43.0389, lng: -87.9065 },
  'albuquerque|united states': { lat: 35.0844, lng: -106.6504 },
  'tucson|united states': { lat: 32.2226, lng: -110.9747 },
  'fresno|united states': { lat: 36.7378, lng: -119.7871 },
  'sacramento|united states': { lat: 38.5816, lng: -121.4944 },
  'mesa|united states': { lat: 33.4152, lng: -111.8315 },
  'kansas city|united states': { lat: 39.0997, lng: -94.5786 },
  'atlanta|united states': { lat: 33.749, lng: -84.388 },
  'omaha|united states': { lat: 41.2565, lng: -95.9345 },
  'colorado springs|united states': { lat: 38.8339, lng: -104.8214 },
  'raleigh|united states': { lat: 35.7796, lng: -78.6382 },
  'long beach|united states': { lat: 33.77, lng: -118.1937 },
  'virginia beach|united states': { lat: 36.8529, lng: -75.978 },
  'minneapolis|united states': { lat: 44.9778, lng: -93.265 },
  'miami|united states': { lat: 25.7617, lng: -80.1918 },
  'tampa|united states': { lat: 27.9506, lng: -82.4572 },
  'new orleans|united states': { lat: 29.9511, lng: -90.0715 },
  'cleveland|united states': { lat: 41.4993, lng: -81.6944 },
  'pittsburgh|united states': { lat: 40.4406, lng: -79.9959 },
  'cincinnati|united states': { lat: 39.1031, lng: -84.512 },
  'st louis|united states': { lat: 38.627, lng: -90.1994 },
  'saint louis|united states': { lat: 38.627, lng: -90.1994 },
  'salt lake city|united states': { lat: 40.7608, lng: -111.891 },
  'hartford|united states': { lat: 41.7658, lng: -72.6851 },
  'richmond|united states': { lat: 37.5407, lng: -77.4361 },
  'orlando|united states': { lat: 28.5383, lng: -81.3792 },
  'san bernardino|united states': { lat: 34.1083, lng: -117.2898 },
  'boca raton|united states': { lat: 26.3683, lng: -80.1289 },
  'fort lauderdale|united states': { lat: 26.1224, lng: -80.1373 },
  'palo alto|united states': { lat: 37.4419, lng: -122.143 },
  'silicon valley|united states': { lat: 37.3875, lng: -122.0575 },
  'new jersey|united states': { lat: 40.0583, lng: -74.4057 },
  'princeton|united states': { lat: 40.3573, lng: -74.6672 },
  'jersey city|united states': { lat: 40.7178, lng: -74.0431 },
  'newark|united states': { lat: 40.7357, lng: -74.1724 },
  'detroit|united states': { lat: 42.3314, lng: -83.0458 },
  'ann arbor|united states': { lat: 42.2808, lng: -83.7430 },
  'birmingham|united states': { lat: 33.5186, lng: -86.8104 },
  'jacksonville|us': { lat: 30.3322, lng: -81.6557 },

  // US short codes
  'new york|usa': { lat: 40.7128, lng: -74.006 },
  'los angeles|usa': { lat: 34.0522, lng: -118.2437 },
  'chicago|usa': { lat: 41.8781, lng: -87.6298 },
  'san francisco|usa': { lat: 37.7749, lng: -122.4194 },
  'miami|usa': { lat: 25.7617, lng: -80.1918 },
  'boston|usa': { lat: 42.3601, lng: -71.0589 },
  'seattle|usa': { lat: 47.6062, lng: -122.3321 },
  'atlanta|usa': { lat: 33.749, lng: -84.388 },
  'dallas|usa': { lat: 32.7767, lng: -96.797 },
  'houston|usa': { lat: 29.7604, lng: -95.3698 },
  'denver|usa': { lat: 39.7392, lng: -104.9903 },
  'washington dc|usa': { lat: 38.9072, lng: -77.0369 },
  'washington|usa': { lat: 38.9072, lng: -77.0369 },

  // Canada
  'toronto|canada': { lat: 43.6532, lng: -79.3832 },
  'montreal|canada': { lat: 45.5017, lng: -73.5673 },
  'vancouver|canada': { lat: 49.2827, lng: -123.1207 },
  'calgary|canada': { lat: 51.0447, lng: -114.0719 },
  'edmonton|canada': { lat: 53.5461, lng: -113.4938 },
  'ottawa|canada': { lat: 45.4215, lng: -75.6972 },
  'quebec city|canada': { lat: 46.8139, lng: -71.2082 },
  'winnipeg|canada': { lat: 49.8951, lng: -97.1384 },
  'hamilton|canada': { lat: 43.2557, lng: -79.8711 },
  'victoria|canada': { lat: 48.4284, lng: -123.3656 },

  // Israel
  'tel aviv|israel': { lat: 32.0853, lng: 34.7818 },
  'tel-aviv|israel': { lat: 32.0853, lng: 34.7818 },
  'jerusalem|israel': { lat: 31.7683, lng: 35.2137 },
  'haifa|israel': { lat: 32.7940, lng: 34.9896 },
  'rishon lezion|israel': { lat: 31.9642, lng: 34.8034 },
  'petah tikva|israel': { lat: 32.0874, lng: 34.887 },
  'ashdod|israel': { lat: 31.8044, lng: 34.6553 },
  'netanya|israel': { lat: 32.3286, lng: 34.8597 },
  'beer sheva|israel': { lat: 31.2518, lng: 34.7913 },
  'beersheba|israel': { lat: 31.2518, lng: 34.7913 },
  'holon|israel': { lat: 32.0167, lng: 34.7667 },
  'bnei brak|israel': { lat: 32.0833, lng: 34.8333 },
  'ramat gan|israel': { lat: 32.0684, lng: 34.8238 },
  'bat yam|israel': { lat: 32.0204, lng: 34.7508 },
  'herzliya|israel': { lat: 32.1663, lng: 34.8438 },
  'rehovot|israel': { lat: 31.8956, lng: 34.8078 },
  'ra\'anana|israel': { lat: 32.1837, lng: 34.8705 },
  'kfar saba|israel': { lat: 32.175, lng: 34.9076 },
  'nazareth|israel': { lat: 32.6996, lng: 35.3035 },
  'lod|israel': { lat: 31.9526, lng: 34.8936 },
  'caesarea|israel': { lat: 32.4978, lng: 34.9094 },
  'eilat|israel': { lat: 29.5581, lng: 34.9482 },
  'modiin|israel': { lat: 31.8983, lng: 34.9983 },
  'kiryat gat|israel': { lat: 31.61, lng: 34.7641 },

  // United Kingdom
  'london|united kingdom': { lat: 51.5074, lng: -0.1278 },
  'london|uk': { lat: 51.5074, lng: -0.1278 },
  'birmingham|united kingdom': { lat: 52.4862, lng: -1.8904 },
  'manchester|united kingdom': { lat: 53.4808, lng: -2.2426 },
  'glasgow|united kingdom': { lat: 55.8642, lng: -4.2518 },
  'leeds|united kingdom': { lat: 53.8008, lng: -1.5491 },
  'liverpool|united kingdom': { lat: 53.4084, lng: -2.9916 },
  'edinburgh|united kingdom': { lat: 55.9533, lng: -3.1883 },
  'bristol|united kingdom': { lat: 51.4545, lng: -2.5879 },
  'sheffield|united kingdom': { lat: 53.3811, lng: -1.4701 },
  'nottingham|united kingdom': { lat: 52.9548, lng: -1.1581 },
  'cardiff|united kingdom': { lat: 51.4816, lng: -3.1791 },
  'oxford|united kingdom': { lat: 51.752, lng: -1.2577 },
  'cambridge|united kingdom': { lat: 52.2053, lng: 0.1218 },

  // France
  'paris|france': { lat: 48.8566, lng: 2.3522 },
  'marseille|france': { lat: 43.2965, lng: 5.3698 },
  'lyon|france': { lat: 45.764, lng: 4.8357 },
  'toulouse|france': { lat: 43.6047, lng: 1.4442 },
  'nice|france': { lat: 43.7102, lng: 7.262 },
  'nantes|france': { lat: 47.2184, lng: -1.5536 },
  'strasbourg|france': { lat: 48.5734, lng: 7.7521 },
  'montpellier|france': { lat: 43.6108, lng: 3.8767 },
  'bordeaux|france': { lat: 44.8378, lng: -0.5792 },
  'lille|france': { lat: 50.6292, lng: 3.0573 },

  // Germany
  'berlin|germany': { lat: 52.52, lng: 13.405 },
  'hamburg|germany': { lat: 53.5753, lng: 10.0153 },
  'munich|germany': { lat: 48.1351, lng: 11.582 },
  'cologne|germany': { lat: 50.9333, lng: 6.95 },
  'frankfurt|germany': { lat: 50.1109, lng: 8.6821 },
  'frankfurt am main|germany': { lat: 50.1109, lng: 8.6821 },
  'stuttgart|germany': { lat: 48.7758, lng: 9.1829 },
  'düsseldorf|germany': { lat: 51.2217, lng: 6.7762 },
  'dusseldorf|germany': { lat: 51.2217, lng: 6.7762 },
  'dortmund|germany': { lat: 51.5136, lng: 7.4653 },
  'essen|germany': { lat: 51.4556, lng: 7.0116 },
  'leipzig|germany': { lat: 51.3397, lng: 12.3731 },
  'bremen|germany': { lat: 53.0793, lng: 8.8017 },
  'dresden|germany': { lat: 51.0509, lng: 13.7383 },
  'hanover|germany': { lat: 52.3759, lng: 9.732 },
  'hannover|germany': { lat: 52.3759, lng: 9.732 },
  'nuremberg|germany': { lat: 49.4521, lng: 11.0767 },
  'nürnberg|germany': { lat: 49.4521, lng: 11.0767 },
  'heidelberg|germany': { lat: 49.3988, lng: 8.6724 },

  // Netherlands
  'amsterdam|netherlands': { lat: 52.3676, lng: 4.9041 },
  'rotterdam|netherlands': { lat: 51.9244, lng: 4.4777 },
  'the hague|netherlands': { lat: 52.0705, lng: 4.3007 },
  'utrecht|netherlands': { lat: 52.0907, lng: 5.1214 },
  'eindhoven|netherlands': { lat: 51.4416, lng: 5.4697 },

  // Switzerland
  'zurich|switzerland': { lat: 47.3769, lng: 8.5417 },
  'zürich|switzerland': { lat: 47.3769, lng: 8.5417 },
  'geneva|switzerland': { lat: 46.2044, lng: 6.1432 },
  'geneve|switzerland': { lat: 46.2044, lng: 6.1432 },
  'basel|switzerland': { lat: 47.5596, lng: 7.5886 },
  'bern|switzerland': { lat: 46.948, lng: 7.4474 },
  'lausanne|switzerland': { lat: 46.5197, lng: 6.6323 },

  // Austria
  'vienna|austria': { lat: 48.2082, lng: 16.3738 },
  'wien|austria': { lat: 48.2082, lng: 16.3738 },
  'graz|austria': { lat: 47.0707, lng: 15.4395 },
  'salzburg|austria': { lat: 47.8095, lng: 13.055 },
  'innsbruck|austria': { lat: 47.2692, lng: 11.4041 },

  // Spain
  'madrid|spain': { lat: 40.4168, lng: -3.7038 },
  'barcelona|spain': { lat: 41.3851, lng: 2.1734 },
  'valencia|spain': { lat: 39.4699, lng: -0.3763 },
  'seville|spain': { lat: 37.3891, lng: -5.9845 },
  'sevilla|spain': { lat: 37.3891, lng: -5.9845 },
  'bilbao|spain': { lat: 43.263, lng: -2.935 },
  'malaga|spain': { lat: 36.721, lng: -4.4217 },

  // Italy
  'rome|italy': { lat: 41.9028, lng: 12.4964 },
  'milan|italy': { lat: 45.4654, lng: 9.1859 },
  'naples|italy': { lat: 40.8518, lng: 14.2681 },
  'turin|italy': { lat: 45.0703, lng: 7.6869 },
  'torino|italy': { lat: 45.0703, lng: 7.6869 },
  'palermo|italy': { lat: 38.1157, lng: 13.3615 },
  'genoa|italy': { lat: 44.4056, lng: 8.9463 },
  'bologna|italy': { lat: 44.4949, lng: 11.3426 },
  'florence|italy': { lat: 43.7696, lng: 11.2558 },
  'firenze|italy': { lat: 43.7696, lng: 11.2558 },
  'venice|italy': { lat: 45.4408, lng: 12.3155 },
  'venezia|italy': { lat: 45.4408, lng: 12.3155 },

  // Portugal
  'lisbon|portugal': { lat: 38.7223, lng: -9.1393 },
  'porto|portugal': { lat: 41.1579, lng: -8.6291 },
  'braga|portugal': { lat: 41.5454, lng: -8.426 },

  // Belgium
  'brussels|belgium': { lat: 50.8503, lng: 4.3517 },
  'antwerp|belgium': { lat: 51.2213, lng: 4.4051 },
  'ghent|belgium': { lat: 51.0543, lng: 3.7174 },

  // Sweden
  'stockholm|sweden': { lat: 59.3293, lng: 18.0686 },
  'gothenburg|sweden': { lat: 57.7089, lng: 11.9746 },
  'malmö|sweden': { lat: 55.604, lng: 13.003 },
  'malmo|sweden': { lat: 55.604, lng: 13.003 },

  // Norway
  'oslo|norway': { lat: 59.9139, lng: 10.7522 },
  'bergen|norway': { lat: 60.3913, lng: 5.3221 },

  // Denmark
  'copenhagen|denmark': { lat: 55.6761, lng: 12.5683 },
  'aarhus|denmark': { lat: 56.1629, lng: 10.2039 },

  // Finland
  'helsinki|finland': { lat: 60.1699, lng: 24.9384 },

  // Poland
  'warsaw|poland': { lat: 52.2297, lng: 21.0122 },
  'krakow|poland': { lat: 50.0647, lng: 19.945 },
  'lodz|poland': { lat: 51.7592, lng: 19.456 },
  'wroclaw|poland': { lat: 51.1079, lng: 17.0385 },
  'poznan|poland': { lat: 52.4064, lng: 16.9252 },

  // Czech Republic
  'prague|czech republic': { lat: 50.0755, lng: 14.4378 },
  'brno|czech republic': { lat: 49.1951, lng: 16.6068 },

  // Hungary
  'budapest|hungary': { lat: 47.4979, lng: 19.0402 },

  // Romania
  'bucharest|romania': { lat: 44.4268, lng: 26.1025 },

  // Greece
  'athens|greece': { lat: 37.9838, lng: 23.7275 },
  'thessaloniki|greece': { lat: 40.6401, lng: 22.9444 },

  // Turkey
  'istanbul|turkey': { lat: 41.0082, lng: 28.9784 },
  'ankara|turkey': { lat: 39.9334, lng: 32.8597 },
  'izmir|turkey': { lat: 38.4237, lng: 27.1428 },

  // Russia
  'moscow|russia': { lat: 55.7558, lng: 37.6173 },
  'saint petersburg|russia': { lat: 59.9311, lng: 30.3609 },
  'st. petersburg|russia': { lat: 59.9311, lng: 30.3609 },

  // Ukraine
  'kyiv|ukraine': { lat: 50.4501, lng: 30.5234 },
  'kiev|ukraine': { lat: 50.4501, lng: 30.5234 },
  'kharkiv|ukraine': { lat: 49.9935, lng: 36.2304 },
  'odessa|ukraine': { lat: 46.4825, lng: 30.7233 },

  // Australia
  'sydney|australia': { lat: -33.8688, lng: 151.2093 },
  'melbourne|australia': { lat: -37.8136, lng: 144.9631 },
  'brisbane|australia': { lat: -27.4698, lng: 153.0251 },
  'perth|australia': { lat: -31.9505, lng: 115.8605 },
  'adelaide|australia': { lat: -34.9285, lng: 138.6007 },
  'gold coast|australia': { lat: -28.0167, lng: 153.4 },
  'canberra|australia': { lat: -35.2809, lng: 149.1300 },

  // New Zealand
  'auckland|new zealand': { lat: -36.8485, lng: 174.7633 },
  'wellington|new zealand': { lat: -41.2865, lng: 174.7762 },
  'christchurch|new zealand': { lat: -43.5321, lng: 172.6362 },

  // Japan
  'tokyo|japan': { lat: 35.6762, lng: 139.6503 },
  'osaka|japan': { lat: 34.6937, lng: 135.5023 },
  'yokohama|japan': { lat: 35.4437, lng: 139.638 },
  'nagoya|japan': { lat: 35.1815, lng: 136.9066 },
  'kyoto|japan': { lat: 35.0116, lng: 135.7681 },
  'fukuoka|japan': { lat: 33.5904, lng: 130.4017 },

  // China
  'beijing|china': { lat: 39.9042, lng: 116.4074 },
  'shanghai|china': { lat: 31.2304, lng: 121.4737 },
  'guangzhou|china': { lat: 23.1291, lng: 113.2644 },
  'shenzhen|china': { lat: 22.5431, lng: 114.0579 },
  'chengdu|china': { lat: 30.5728, lng: 104.0668 },
  'wuhan|china': { lat: 30.5928, lng: 114.3055 },
  'xian|china': { lat: 34.3416, lng: 108.9398 },
  'hangzhou|china': { lat: 30.2741, lng: 120.1551 },
  'hong kong|china': { lat: 22.3193, lng: 114.1694 },
  'hong kong|hong kong': { lat: 22.3193, lng: 114.1694 },
  'macau|china': { lat: 22.1987, lng: 113.5439 },

  // South Korea
  'seoul|south korea': { lat: 37.5665, lng: 126.978 },
  'busan|south korea': { lat: 35.1796, lng: 129.0756 },

  // India
  'mumbai|india': { lat: 19.076, lng: 72.8777 },
  'delhi|india': { lat: 28.6139, lng: 77.209 },
  'new delhi|india': { lat: 28.6139, lng: 77.209 },
  'bangalore|india': { lat: 12.9716, lng: 77.5946 },
  'bengaluru|india': { lat: 12.9716, lng: 77.5946 },
  'hyderabad|india': { lat: 17.385, lng: 78.4867 },
  'ahmedabad|india': { lat: 23.0225, lng: 72.5714 },
  'chennai|india': { lat: 13.0827, lng: 80.2707 },
  'kolkata|india': { lat: 22.5726, lng: 88.3639 },
  'pune|india': { lat: 18.5204, lng: 73.8567 },
  'surat|india': { lat: 21.1702, lng: 72.8311 },
  'jaipur|india': { lat: 26.9124, lng: 75.7873 },
  'gurgaon|india': { lat: 28.4595, lng: 77.0266 },
  'gurugram|india': { lat: 28.4595, lng: 77.0266 },
  'noida|india': { lat: 28.5355, lng: 77.391 },
  'chandigarh|india': { lat: 30.7333, lng: 76.7794 },
  'kochi|india': { lat: 9.9312, lng: 76.2673 },

  // Singapore
  'singapore|singapore': { lat: 1.3521, lng: 103.8198 },

  // Malaysia
  'kuala lumpur|malaysia': { lat: 3.1390, lng: 101.6869 },

  // Thailand
  'bangkok|thailand': { lat: 13.7563, lng: 100.5018 },
  'chiang mai|thailand': { lat: 18.7883, lng: 98.9853 },

  // Indonesia
  'jakarta|indonesia': { lat: -6.2088, lng: 106.8456 },
  'surabaya|indonesia': { lat: -7.2575, lng: 112.7521 },
  'bali|indonesia': { lat: -8.3405, lng: 115.092 },

  // Philippines
  'manila|philippines': { lat: 14.5995, lng: 120.9842 },

  // Vietnam
  'ho chi minh city|vietnam': { lat: 10.8231, lng: 106.6297 },
  'hanoi|vietnam': { lat: 21.0285, lng: 105.8542 },

  // UAE
  'dubai|united arab emirates': { lat: 25.2048, lng: 55.2708 },
  'abu dhabi|united arab emirates': { lat: 24.4539, lng: 54.3773 },
  'sharjah|united arab emirates': { lat: 25.3462, lng: 55.4209 },
  'dubai|uae': { lat: 25.2048, lng: 55.2708 },
  'abu dhabi|uae': { lat: 24.4539, lng: 54.3773 },

  // Saudi Arabia
  'riyadh|saudi arabia': { lat: 24.7136, lng: 46.6753 },
  'jeddah|saudi arabia': { lat: 21.4858, lng: 39.1925 },
  'mecca|saudi arabia': { lat: 21.4225, lng: 39.8262 },

  // Qatar
  'doha|qatar': { lat: 25.2854, lng: 51.531 },

  // Bahrain
  'manama|bahrain': { lat: 26.225, lng: 50.5772 },

  // Egypt
  'cairo|egypt': { lat: 30.0444, lng: 31.2357 },
  'alexandria|egypt': { lat: 31.2001, lng: 29.9187 },

  // South Africa
  'johannesburg|south africa': { lat: -26.2041, lng: 28.0473 },
  'cape town|south africa': { lat: -33.9249, lng: 18.4241 },
  'durban|south africa': { lat: -29.8587, lng: 31.0218 },
  'pretoria|south africa': { lat: -25.7479, lng: 28.2293 },

  // Nigeria
  'lagos|nigeria': { lat: 6.5244, lng: 3.3792 },
  'abuja|nigeria': { lat: 9.0579, lng: 7.4951 },

  // Kenya
  'nairobi|kenya': { lat: -1.2921, lng: 36.8219 },

  // Ghana
  'accra|ghana': { lat: 5.6037, lng: -0.187 },

  // Ethiopia
  'addis ababa|ethiopia': { lat: 9.0054, lng: 38.7636 },

  // Morocco
  'casablanca|morocco': { lat: 33.5731, lng: -7.5898 },
  'rabat|morocco': { lat: 34.0209, lng: -6.8416 },
  'marrakech|morocco': { lat: 31.6295, lng: -7.9811 },

  // Tunisia
  'tunis|tunisia': { lat: 36.8065, lng: 10.1815 },

  // Brazil
  'são paulo|brazil': { lat: -23.5505, lng: -46.6333 },
  'sao paulo|brazil': { lat: -23.5505, lng: -46.6333 },
  'rio de janeiro|brazil': { lat: -22.9068, lng: -43.1729 },
  'brasilia|brazil': { lat: -15.7801, lng: -47.9292 },
  'salvador|brazil': { lat: -12.9714, lng: -38.5014 },
  'fortaleza|brazil': { lat: -3.7172, lng: -38.5434 },
  'belo horizonte|brazil': { lat: -19.9167, lng: -43.9345 },
  'manaus|brazil': { lat: -3.119, lng: -60.0217 },
  'curitiba|brazil': { lat: -25.4284, lng: -49.2733 },
  'recife|brazil': { lat: -8.0476, lng: -34.877 },
  'porto alegre|brazil': { lat: -30.0346, lng: -51.2177 },
  'campinas|brazil': { lat: -22.9056, lng: -47.0608 },

  // Argentina
  'buenos aires|argentina': { lat: -34.6037, lng: -58.3816 },
  'córdoba|argentina': { lat: -31.4201, lng: -64.1888 },
  'cordoba|argentina': { lat: -31.4201, lng: -64.1888 },
  'rosario|argentina': { lat: -32.9587, lng: -60.6931 },
  'mendoza|argentina': { lat: -32.8895, lng: -68.8458 },

  // Chile
  'santiago|chile': { lat: -33.4489, lng: -70.6693 },

  // Colombia
  'bogotá|colombia': { lat: 4.711, lng: -74.0721 },
  'bogota|colombia': { lat: 4.711, lng: -74.0721 },
  'medellín|colombia': { lat: 6.2442, lng: -75.5812 },
  'medellin|colombia': { lat: 6.2442, lng: -75.5812 },
  'cali|colombia': { lat: 3.4516, lng: -76.532 },

  // Mexico
  'mexico city|mexico': { lat: 19.4326, lng: -99.1332 },
  'guadalajara|mexico': { lat: 20.6597, lng: -103.3496 },
  'monterrey|mexico': { lat: 25.6866, lng: -100.3161 },
  'puebla|mexico': { lat: 19.0414, lng: -98.2063 },
  'cancún|mexico': { lat: 21.1619, lng: -86.8515 },
  'cancun|mexico': { lat: 21.1619, lng: -86.8515 },
  'tijuana|mexico': { lat: 32.5149, lng: -117.0382 },

  // Peru
  'lima|peru': { lat: -12.046374, lng: -77.042793 },

  // Ecuador
  'quito|ecuador': { lat: -0.1807, lng: -78.4678 },
  'guayaquil|ecuador': { lat: -2.1710, lng: -79.922 },

  // Venezuela
  'caracas|venezuela': { lat: 10.4806, lng: -66.9036 },

  // Costa Rica
  'san jose|costa rica': { lat: 9.9281, lng: -84.0907 },

  // Panama
  'panama city|panama': { lat: 8.9936, lng: -79.5197 },
};

/** Normalise a raw city/country string to the same format as keys in CITY_COORDS */
export function normalizePlaceKey(city: string, country: string): string {
  return `${city.trim().toLowerCase()}|${country.trim().toLowerCase()}`;
}

/** Look up coordinates instantly from the built-in table.  Returns null when not found. */
export function lookupCoordinates(
  city: string,
  country: string
): { lat: number; lng: number } | null {
  const key = normalizePlaceKey(city, country);
  return CITY_COORDS[key] ?? null;
}
