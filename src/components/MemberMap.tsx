import React, { useState, useEffect, useRef } from 'react';
import { X, MapPin } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import 'leaflet.markercluster';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../firebase/config';

interface MemberLocation {
  username: string;
  city: string;
  country: string;
  profileUrl: string;
}

interface LocationGroup {
  city: string;
  country: string;
  users: MemberLocation[];
  coordinates: { lat: number; lng: number } | null;
}

interface MemberMapProps {
  isOpen: boolean;
  onClose: () => void;
}

const OPENCAGE_API_KEY = '4ecd33dfc8d04db5af07e19fd0f8db38';
const GEOCODE_DELAY = 200;

const MemberMap: React.FC<MemberMapProps> = ({ isOpen, onClose }) => {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markerClusterGroupRef = useRef<any>(null);
  const [loading, setLoading] = useState(false);
  const [statsText, setStatsText] = useState('Loading members...');
  const geocodeCache = useRef<Map<string, { lat: number; lng: number }>>(new Map());
  const locationGroupsRef = useRef<Map<string, LocationGroup>>(new Map());

  useEffect(() => {
    if (isOpen && !mapRef.current) {
      initializeMap();
    }

    return () => {
      if (mapRef.current && !isOpen) {
        mapRef.current.remove();
        mapRef.current = null;
        markerClusterGroupRef.current = null;
      }
    };
  }, [isOpen]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  const initializeMap = async () => {
    if (!mapContainerRef.current) return;

    try {
      setLoading(true);

      // Create map
      const map = L.map(mapContainerRef.current, {
        center: [20, 0],
        zoom: 2,
        zoomControl: true,
      });

      mapRef.current = map;

      // Add OpenStreetMap tiles
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);

      // Initialize marker cluster group
      const markerClusterGroup = (L as any).markerClusterGroup({
        maxClusterRadius: 80,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        zoomToBoundsOnClick: true,
        iconCreateFunction: (cluster: any) => {
          const count = cluster.getChildCount();
          let size = 'small';
          if (count > 10) size = 'large';
          else if (count > 5) size = 'medium';

          return L.divIcon({
            html: `<div><span>${count}</span></div>`,
            className: `marker-cluster marker-cluster-${size}`,
            iconSize: L.point(40, 40),
          });
        },
      });

      map.addLayer(markerClusterGroup);
      markerClusterGroupRef.current = markerClusterGroup;

      // Load users
      await loadUsers();

      setLoading(false);
    } catch (error) {
      console.error('Error initializing map:', error);
      setStatsText('Error loading map. Please try again.');
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      setStatsText('Fetching members...');

      // Query Firestore directly for users with location data
      // Only fetch users who have both city AND country
      const usersRef = collection(db, 'users');
      const q = query(
        usersRef,
        where('city', '>', ''),
        where('country', '>', ''),
        limit(1000)
      );

      const snapshot = await getDocs(q);
      const users: MemberLocation[] = [];

      snapshot.forEach(doc => {
        const userData = doc.data();

        // Double-check both fields exist
        if (userData.city && userData.country) {
          // Construct profile URL
          const profileUrl = `/profile/${doc.id}`;

          // Use displayName, or construct from firstName/lastName, or use email
          const username = userData.displayName ||
                          `${userData.firstName || ''} ${userData.lastName || ''}`.trim() ||
                          userData.email ||
                          'Unknown User';

          users.push({
            username,
            city: userData.city,
            country: userData.country,
            profileUrl
          });
        }
      });

      if (users.length === 0) {
        setStatsText('No members with location data found');
        return;
      }

      setStatsText(`Geocoding ${users.length} member locations...`);

      // Group users by location
      groupUsersByLocation(users);

      // Geocode locations
      await geocodeLocations();

      // Add markers
      addMarkersToMap();

      // Fit bounds
      fitMapBounds();

      const locationCount = locationGroupsRef.current.size;
      setStatsText(`Showing ${users.length} members from ${locationCount} locations`);
    } catch (error) {
      console.error('Error loading users:', error);
      setStatsText('Error loading members. Please try again.');
    }
  };

  const groupUsersByLocation = (users: MemberLocation[]) => {
    locationGroupsRef.current.clear();

    users.forEach((user) => {
      if (!user.city || !user.country) return;

      const locationKey = `${user.city.trim()}, ${user.country.trim()}`;

      if (!locationGroupsRef.current.has(locationKey)) {
        locationGroupsRef.current.set(locationKey, {
          city: user.city.trim(),
          country: user.country.trim(),
          users: [],
          coordinates: null,
        });
      }

      locationGroupsRef.current.get(locationKey)!.users.push(user);
    });
  };

  const geocodeLocations = async () => {
    const locations = Array.from(locationGroupsRef.current.entries());
    let processed = 0;

    for (const [locationKey, location] of locations) {
      processed++;
      setStatsText(`Geocoding locations... (${processed}/${locations.length})`);

      // Check cache
      if (geocodeCache.current.has(locationKey)) {
        location.coordinates = geocodeCache.current.get(locationKey)!;
        continue;
      }

      // Geocode
      try {
        const coords = await geocodeCity(location.city, location.country);
        if (coords) {
          location.coordinates = coords;
          geocodeCache.current.set(locationKey, coords);
        }
      } catch (error) {
        console.error(`Failed to geocode ${locationKey}:`, error);
      }

      // Rate limit delay
      if (processed < locations.length) {
        await sleep(GEOCODE_DELAY);
      }
    }
  };

  const geocodeCity = async (city: string, country: string): Promise<{ lat: number; lng: number } | null> => {
    const query = encodeURIComponent(`${city}, ${country}`);
    const url = `https://api.opencagedata.com/geocode/v1/json?q=${query}&key=${OPENCAGE_API_KEY}&limit=1`;

    try {
      const response = await fetch(url);
      const data = await response.json();

      if (data.results && data.results.length > 0) {
        const result = data.results[0];
        return {
          lat: result.geometry.lat,
          lng: result.geometry.lng,
        };
      }

      return null;
    } catch (error) {
      console.error(`Geocoding error for ${city}, ${country}:`, error);
      return null;
    }
  };

  const addMarkersToMap = () => {
    if (!markerClusterGroupRef.current) return;

    markerClusterGroupRef.current.clearLayers();

    locationGroupsRef.current.forEach((location) => {
      if (!location.coordinates) return;

      const { lat, lng } = location.coordinates;

      // Create custom marker
      const icon = L.divIcon({
        className: 'custom-marker',
        html: `
          <div style="
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            width: 32px;
            height: 32px;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            border: 3px solid white;
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
          ">
            <span style="
              color: white;
              font-weight: bold;
              font-size: 12px;
              transform: rotate(45deg);
            ">${location.users.length}</span>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32],
      });

      const marker = L.marker([lat, lng], { icon });

      // Create popup
      const popupContent = createPopupContent(location);
      marker.bindPopup(popupContent, {
        maxWidth: 300,
        className: 'member-popup-wrapper',
      });

      markerClusterGroupRef.current.addLayer(marker);
    });
  };

  const createPopupContent = (location: LocationGroup): string => {
    const userCount = location.users.length;
    const title = `${location.city}, ${location.country}`;

    let html = `
      <div class="member-popup">
        <div class="member-popup-title">
          ${title}
          <span style="color: #667eea; font-size: 14px;">(${userCount} ${userCount === 1 ? 'member' : 'members'})</span>
        </div>
        <ul class="member-popup-list">
    `;

    location.users.forEach((user) => {
      html += `
        <li class="member-popup-item">
          <a href="${user.profileUrl}" class="member-popup-link">
            <svg class="member-popup-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
            <span>${user.username}</span>
          </a>
        </li>
      `;
    });

    html += `</ul></div>`;
    return html;
  };

  const fitMapBounds = () => {
    if (!markerClusterGroupRef.current || !mapRef.current) return;

    const markers = markerClusterGroupRef.current.getLayers();
    if (markers.length === 0) return;

    const bounds = L.latLngBounds(markers.map((marker: any) => marker.getLatLng()));
    mapRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
  };

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center animate-fadeIn">
      <div className="relative w-[95vw] h-[95vh] bg-white rounded-2xl overflow-hidden shadow-2xl animate-slideUp">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-gray-100 transition-all z-[1000] hover:rotate-90"
        >
          <X className="h-6 w-6 text-gray-700" />
        </button>

        {/* Loading Overlay */}
        {loading && (
          <div className="absolute inset-0 bg-white bg-opacity-95 z-[999] flex flex-col items-center justify-center">
            <div className="w-12 h-12 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin" />
            <p className="mt-4 text-gray-700 font-medium">{statsText}</p>
          </div>
        )}

        {/* Map Container */}
        <div ref={mapContainerRef} className="w-full h-[calc(100%-60px)]" />

        {/* Stats Bar */}
        <div className="absolute bottom-0 left-0 w-full h-[60px] bg-gradient-to-r from-blue-600 to-purple-600 flex items-center justify-center text-white font-semibold text-lg">
          {statsText}
        </div>
      </div>

      <style>{`
        .leaflet-popup-content-wrapper {
          border-radius: 12px;
          padding: 0;
          overflow: hidden;
        }
        .leaflet-popup-content {
          margin: 0;
          min-width: 200px;
        }
        .member-popup {
          padding: 16px;
        }
        .member-popup-title {
          font-size: 16px;
          font-weight: 700;
          color: #1f2937;
          margin-bottom: 12px;
          padding-bottom: 12px;
          border-bottom: 2px solid #e5e7eb;
        }
        .member-popup-list {
          list-style: none;
          padding: 0;
          margin: 0;
          max-height: 200px;
          overflow-y: auto;
        }
        .member-popup-item {
          padding: 8px 12px;
          margin-bottom: 4px;
          background: #f9fafb;
          border-radius: 8px;
          transition: all 0.2s ease;
        }
        .member-popup-item:hover {
          background: #667eea;
        }
        .member-popup-link {
          display: flex;
          align-items: center;
          gap: 8px;
          text-decoration: none;
          color: #374151;
          font-weight: 500;
          font-size: 14px;
        }
        .member-popup-item:hover .member-popup-link {
          color: white;
        }
        .member-popup-icon {
          width: 16px;
          height: 16px;
          color: #667eea;
        }
        .member-popup-item:hover .member-popup-icon {
          color: white;
        }
        .marker-cluster {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border: 3px solid white;
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        }
        .marker-cluster div {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          font-weight: 700;
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from {
            transform: translateY(50px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease;
        }
        .animate-slideUp {
          animation: slideUp 0.4s ease;
        }
      `}</style>
    </div>
  );
};

export default MemberMap;
