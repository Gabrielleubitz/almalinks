import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import 'leaflet.markercluster';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../firebase/config';
import { lookupCoordinates, normalizePlaceKey } from '../data/cityCoordinates';

// ─── types ──────────────────────────────────────────────────────────────────

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

// ─── constants ──────────────────────────────────────────────────────────────

const OPENCAGE_API_KEY = '4ecd33dfc8d04db5af07e19fd0f8db38';
/** Parallel geocoding concurrency – avoids hammering the rate limit */
const GEOCODE_CONCURRENCY = 5;
/** Delay between each parallel batch (ms) */
const GEOCODE_BATCH_DELAY = 250;
/** localStorage key for persisting geocoded coords across sessions */
const LS_KEY = 'memberMapGeoCache_v1';

// ─── localStorage geocache helpers ──────────────────────────────────────────

function loadPersistedCache(): Map<string, { lat: number; lng: number }> {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return new Map();
    const parsed = JSON.parse(raw) as Record<string, { lat: number; lng: number }>;
    return new Map(Object.entries(parsed));
  } catch {
    return new Map();
  }
}

function persistCache(cache: Map<string, { lat: number; lng: number }>) {
  try {
    const obj: Record<string, { lat: number; lng: number }> = {};
    cache.forEach((v, k) => { obj[k] = v; });
    localStorage.setItem(LS_KEY, JSON.stringify(obj));
  } catch {
    // quota exceeded – silently ignore
  }
}

// ─── component ──────────────────────────────────────────────────────────────

const MemberMap: React.FC<MemberMapProps> = ({ isOpen, onClose }) => {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markerClusterGroupRef = useRef<any>(null);
  const geocodeCacheRef = useRef<Map<string, { lat: number; lng: number }>>(loadPersistedCache());
  const locationGroupsRef = useRef<Map<string, LocationGroup>>(new Map());
  const abortRef = useRef(false);

  const [loading, setLoading] = useState(false);
  const [statsText, setStatsText] = useState('Loading members…');

  // ── map teardown ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (isOpen && !mapRef.current) {
      abortRef.current = false;
      initializeMap();
    }
    return () => {
      if (!isOpen && mapRef.current) {
        abortRef.current = true;
        mapRef.current.remove();
        mapRef.current = null;
        markerClusterGroupRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // ── keyboard close ────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape' && isOpen) onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // ── initialise Leaflet ────────────────────────────────────────────────────
  const initializeMap = async () => {
    if (!mapContainerRef.current) return;
    setLoading(true);
    try {
      const map = L.map(mapContainerRef.current, { center: [20, 0], zoom: 2 });
      mapRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);

      const mcg = (L as any).markerClusterGroup({
        maxClusterRadius: 80,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        zoomToBoundsOnClick: true,
        iconCreateFunction: (cluster: any) => {
          const count = cluster.getChildCount();
          const size = count > 10 ? 'large' : count > 5 ? 'medium' : 'small';
          return L.divIcon({
            html: `<div><span>${count}</span></div>`,
            className: `marker-cluster marker-cluster-${size}`,
            iconSize: L.point(40, 40),
          });
        },
      });
      map.addLayer(mcg);
      markerClusterGroupRef.current = mcg;

      await loadUsers();
    } catch (err) {
      console.error('Map init error:', err);
      setStatsText('Error loading map. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── fetch users from Firestore ────────────────────────────────────────────
  const loadUsers = async () => {
    setStatsText('Fetching members…');
    try {
      const snap = await getDocs(
        query(collection(db, 'users'), where('city', '>', ''), where('country', '>', ''), limit(1000))
      );

      const users: MemberLocation[] = [];
      snap.forEach((doc) => {
        const d = doc.data();
        if (d.city && d.country) {
          users.push({
            username:
              d.displayName ||
              `${d.firstName || ''} ${d.lastName || ''}`.trim() ||
              d.email ||
              'Unknown',
            city: d.city,
            country: d.country,
            profileUrl: `/profile/${doc.id}`,
          });
        }
      });

      if (users.length === 0) { setStatsText('No members with location data found'); return; }

      // Group by location
      locationGroupsRef.current.clear();
      for (const user of users) {
        const key = normalizePlaceKey(user.city, user.country);
        if (!locationGroupsRef.current.has(key)) {
          locationGroupsRef.current.set(key, {
            city: user.city.trim(),
            country: user.country.trim(),
            users: [],
            coordinates: null,
          });
        }
        locationGroupsRef.current.get(key)!.users.push(user);
      }

      // PHASE 1 – instant built-in lookup + localStorage cache (no network)
      let resolved = 0;
      const needsGeocoding: [string, LocationGroup][] = [];

      for (const [key, loc] of locationGroupsRef.current) {
        // 1a. built-in table
        const builtin = lookupCoordinates(loc.city, loc.country);
        if (builtin) { loc.coordinates = builtin; resolved++; continue; }

        // 1b. localStorage cache from a prior session
        if (geocodeCacheRef.current.has(key)) {
          loc.coordinates = geocodeCacheRef.current.get(key)!;
          resolved++;
          continue;
        }

        needsGeocoding.push([key, loc]);
      }

      // Render whatever we already have immediately
      addMarkersToMap();
      fitMapBounds();
      setStatsText(
        needsGeocoding.length === 0
          ? `Showing ${users.length} members`
          : `Showing ${users.length} members · resolving ${needsGeocoding.length} location${needsGeocoding.length === 1 ? '' : 's'}…`
      );

      // PHASE 2 – parallel geocode only the unknown locations
      if (needsGeocoding.length > 0) {
        await geocodeBatch(needsGeocoding, users.length);
      }
    } catch (err) {
      console.error('loadUsers error:', err);
      setStatsText('Error loading members. Please try again.');
    }
  };

  // ── parallel batch geocoder ───────────────────────────────────────────────
  const geocodeBatch = useCallback(
    async (pairs: [string, LocationGroup][], totalUsers: number) => {
      let done = 0;
      const chunks: [string, LocationGroup][][] = [];
      for (let i = 0; i < pairs.length; i += GEOCODE_CONCURRENCY) {
        chunks.push(pairs.slice(i, i + GEOCODE_CONCURRENCY));
      }

      for (const chunk of chunks) {
        if (abortRef.current) break;

        await Promise.all(
          chunk.map(async ([key, loc]) => {
            const coords = await geocodeCity(loc.city, loc.country);
            if (coords) {
              loc.coordinates = coords;
              geocodeCacheRef.current.set(key, coords);
            }
            done++;
          })
        );

        // Persist new coords to localStorage after every batch
        persistCache(geocodeCacheRef.current);

        // Incrementally add new markers without clearing existing ones
        addNewMarkers(chunk.map(([, loc]) => loc));

        const remaining = pairs.length - done;
        setStatsText(
          remaining === 0
            ? `Showing ${totalUsers} members`
            : `Showing ${totalUsers} members · ${remaining} location${remaining === 1 ? '' : 's'} left…`
        );

        if (done < pairs.length) await sleep(GEOCODE_BATCH_DELAY);
      }

      fitMapBounds();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // ── geocode a single city via OpenCage ────────────────────────────────────
  const geocodeCity = async (
    city: string,
    country: string
  ): Promise<{ lat: number; lng: number } | null> => {
    try {
      const q = encodeURIComponent(`${city}, ${country}`);
      const res = await fetch(
        `https://api.opencagedata.com/geocode/v1/json?q=${q}&key=${OPENCAGE_API_KEY}&limit=1`
      );
      const data = await res.json();
      if (data.results?.length) {
        const { lat, lng } = data.results[0].geometry;
        return { lat, lng };
      }
    } catch (err) {
      console.error(`Geocode error for ${city}, ${country}:`, err);
    }
    return null;
  };

  // ── marker helpers ────────────────────────────────────────────────────────
  const makeIcon = (count: number) =>
    L.divIcon({
      className: 'custom-marker',
      html: `
        <div style="
          background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);
          width:32px;height:32px;border-radius:50% 50% 50% 0;
          transform:rotate(-45deg);border:3px solid white;
          box-shadow:0 4px 12px rgba(102,126,234,.5);
          display:flex;align-items:center;justify-content:center;">
          <span style="color:white;font-weight:700;font-size:12px;transform:rotate(45deg)">${count}</span>
        </div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -32],
    });

  const makePopup = (loc: LocationGroup) => {
    const count = loc.users.length;
    let html = `
      <div class="member-popup">
        <div class="member-popup-title">
          ${loc.city}, ${loc.country}
          <span style="color:#667eea;font-size:14px">(${count} ${count === 1 ? 'member' : 'members'})</span>
        </div>
        <ul class="member-popup-list">`;
    for (const u of loc.users) {
      html += `
        <li class="member-popup-item">
          <a href="${u.profileUrl}" class="member-popup-link">
            <svg class="member-popup-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
            </svg>
            <span>${u.username}</span>
          </a>
        </li>`;
    }
    html += '</ul></div>';
    return html;
  };

  /** Full re-render (used for initial phase-1 paint) */
  const addMarkersToMap = () => {
    const mcg = markerClusterGroupRef.current;
    if (!mcg) return;
    mcg.clearLayers();
    locationGroupsRef.current.forEach((loc) => {
      if (!loc.coordinates) return;
      const m = L.marker([loc.coordinates.lat, loc.coordinates.lng], { icon: makeIcon(loc.users.length) });
      m.bindPopup(makePopup(loc), { maxWidth: 300, className: 'member-popup-wrapper' });
      mcg.addLayer(m);
    });
  };

  /** Incremental add (used during phase-2 geocoding – no flicker) */
  const addNewMarkers = (locs: LocationGroup[]) => {
    const mcg = markerClusterGroupRef.current;
    if (!mcg) return;
    for (const loc of locs) {
      if (!loc.coordinates) continue;
      const m = L.marker([loc.coordinates.lat, loc.coordinates.lng], { icon: makeIcon(loc.users.length) });
      m.bindPopup(makePopup(loc), { maxWidth: 300, className: 'member-popup-wrapper' });
      mcg.addLayer(m);
    }
  };

  const fitMapBounds = () => {
    const mcg = markerClusterGroupRef.current;
    const map = mapRef.current;
    if (!mcg || !map) return;
    const layers = mcg.getLayers();
    if (!layers.length) return;
    const bounds = L.latLngBounds(layers.map((l: any) => l.getLatLng()));
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
  };

  const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center animate-fadeIn">
      <div className="relative w-[95vw] h-[95vh] bg-white rounded-2xl overflow-hidden shadow-2xl animate-slideUp">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-gray-100 transition-all z-[1000] hover:rotate-90"
        >
          <X className="h-6 w-6 text-gray-700" />
        </button>

        {loading && (
          <div className="absolute inset-0 bg-white bg-opacity-95 z-[999] flex flex-col items-center justify-center">
            <div className="w-12 h-12 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin" />
            <p className="mt-4 text-gray-700 font-medium">{statsText}</p>
          </div>
        )}

        <div ref={mapContainerRef} className="w-full h-[calc(100%-60px)]" />

        <div className="absolute bottom-0 left-0 w-full h-[60px] bg-gradient-to-r from-blue-600 to-purple-600 flex items-center justify-center text-white font-semibold text-lg">
          {statsText}
        </div>
      </div>

      <style>{`
        .leaflet-popup-content-wrapper { border-radius:12px; padding:0; overflow:hidden; }
        .leaflet-popup-content { margin:0; min-width:200px; }
        .member-popup { padding:16px; }
        .member-popup-title { font-size:16px; font-weight:700; color:#1f2937; margin-bottom:12px; padding-bottom:12px; border-bottom:2px solid #e5e7eb; }
        .member-popup-list { list-style:none; padding:0; margin:0; max-height:200px; overflow-y:auto; }
        .member-popup-item { padding:8px 12px; margin-bottom:4px; background:#f9fafb; border-radius:8px; transition:all .2s ease; }
        .member-popup-item:hover { background:#667eea; }
        .member-popup-link { display:flex; align-items:center; gap:8px; text-decoration:none; color:#374151; font-weight:500; font-size:14px; }
        .member-popup-item:hover .member-popup-link { color:white; }
        .member-popup-icon { width:16px; height:16px; color:#667eea; }
        .member-popup-item:hover .member-popup-icon { color:white; }
        .marker-cluster { background:linear-gradient(135deg,#667eea 0%,#764ba2 100%); border:3px solid white; box-shadow:0 4px 12px rgba(102,126,234,.4); }
        .marker-cluster div { background:linear-gradient(135deg,#667eea 0%,#764ba2 100%); color:white; font-weight:700; }
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        @keyframes slideUp { from{transform:translateY(50px);opacity:0} to{transform:translateY(0);opacity:1} }
        .animate-fadeIn { animation:fadeIn .3s ease; }
        .animate-slideUp { animation:slideUp .4s ease; }
      `}</style>
    </div>
  );
};

export default MemberMap;
