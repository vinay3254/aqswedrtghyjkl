import { useState, useCallback, useRef } from 'react';
import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from '@react-google-maps/api';

const LIBRARIES = [];
const MAP_CENTER_DEFAULT = { lat: 20.5937, lng: 78.9629 };
const MAP_OPTIONS = {
  disableDefaultUI: true,
  zoomControl: true,
  mapTypeControl: false,
  streetViewControl: false,
  fullscreenControl: false,
  clickableIcons: false,
};

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function hospitalIcon(isHospital) {
  const color = isHospital ? '#dc2626' : '#2563eb';
  const svg = encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
      <rect x="1" y="1" width="30" height="30" rx="8" fill="${color}" stroke="white" stroke-width="2"/>
      <line x1="8" y1="16" x2="24" y2="16" stroke="white" stroke-width="3.5" stroke-linecap="round"/>
      <line x1="16" y1="8" x2="16" y2="24" stroke="white" stroke-width="3.5" stroke-linecap="round"/>
    </svg>`
  );
  return {
    url: `data:image/svg+xml;charset=UTF-8,${svg}`,
    scaledSize: new window.google.maps.Size(32, 32),
    anchor: new window.google.maps.Point(16, 16),
  };
}

function userLocationIcon() {
  return {
    path: window.google.maps.SymbolPath.CIRCLE,
    scale: 10,
    fillColor: '#2563eb',
    fillOpacity: 1,
    strokeColor: '#ffffff',
    strokeWeight: 3,
  };
}

export default function NearbyHospitalsPage() {
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_KEY,
    libraries: LIBRARIES,
  });

  const mapRef = useRef(null);
  const [query, setQuery]               = useState('');
  const [center, setCenter]             = useState(null);
  const [radius, setRadius]             = useState(5);
  const [hospitals, setHospitals]       = useState([]);
  const [loading, setLoading]           = useState(false);
  const [geoLoading, setGeoLoading]     = useState(false);
  const [error, setError]               = useState(null);
  const [selectedIdx, setSelectedIdx]   = useState(null);
  const [locationLabel, setLocationLabel] = useState('');

  const onMapLoad = useCallback((map) => { mapRef.current = map; }, []);

  const reverseGeocode = useCallback((c) => {
    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ location: c }, (results, status) => {
      if (status === 'OK' && results[0]) {
        setLocationLabel(results[0].formatted_address.split(',').slice(0, 3).join(', '));
      } else {
        setLocationLabel(`${c.lat.toFixed(4)}, ${c.lng.toFixed(4)}`);
      }
    });
  }, []);

  const fetchHospitals = useCallback(async (c, radiusKm) => {
    setLoading(true);
    setError(null);
    setSelectedIdx(null);
    const overpassQuery = `[out:json][timeout:25];(node["amenity"="hospital"](around:${radiusKm * 1000},${c.lat},${c.lng});way["amenity"="hospital"](around:${radiusKm * 1000},${c.lat},${c.lng});node["amenity"="clinic"](around:${radiusKm * 1000},${c.lat},${c.lng});node["healthcare"="hospital"](around:${radiusKm * 1000},${c.lat},${c.lng}););out center;`;
    try {
      const res = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        body: overpassQuery,
        signal: AbortSignal.timeout(20000),
      });
      const data = await res.json();
      if (!data.elements?.length) {
        setHospitals([]);
        setError(`No hospitals found within ${radiusKm}km. Try increasing the radius.`);
        setLoading(false);
        return;
      }
      const mapped = data.elements
        .filter(e => (e.lat && e.lon) || (e.center?.lat && e.center?.lon))
        .map(e => {
          const lat = e.lat ?? e.center.lat;
          const lng = e.lon ?? e.center.lon;
          return {
            place_id: String(e.id),
            name: e.tags?.name || e.tags?.['name:en'] || 'Hospital',
            address: e.tags?.['addr:street']
              ? `${e.tags['addr:housenumber'] || ''} ${e.tags['addr:street']}`.trim()
              : e.tags?.['addr:full'] || '',
            lat, lng,
            isHospital: e.tags?.amenity === 'hospital' || e.tags?.healthcare === 'hospital',
            rating: null,
            distKm: haversine(c.lat, c.lng, lat, lng),
          };
        })
        .sort((a, b) => a.distKm - b.distKm);
      setHospitals(mapped);
      if (mapRef.current && mapped.length > 0) {
        const bounds = new window.google.maps.LatLngBounds();
        bounds.extend(c);
        mapped.forEach(h => bounds.extend({ lat: h.lat, lng: h.lng }));
        mapRef.current.fitBounds(bounds, 60);
      }
    } catch {
      setError('Could not fetch hospital data. Check your internet connection.');
    } finally {
      setLoading(false);
    }
  }, []);

  const applyCenter = useCallback((c, label) => {
    setCenter(c);
    setSelectedIdx(null);
    if (label) setLocationLabel(label);
    else reverseGeocode(c);
    fetchHospitals(c, radius);
    mapRef.current?.panTo(c);
  }, [radius, reverseGeocode, fetchHospitals]);

  const handleSearch = useCallback(() => {
    if (!query.trim() || !isLoaded) return;
    setLoading(true);
    setError(null);
    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ address: query }, (results, status) => {
      if (status === 'OK' && results[0]) {
        const loc = results[0].geometry.location;
        const c = { lat: loc.lat(), lng: loc.lng() };
        const label = results[0].formatted_address.split(',').slice(0, 3).join(', ');
        applyCenter(c, label);
      } else {
        setError('Location not found. Try a more specific address or city name.');
        setLoading(false);
      }
    });
  }, [query, isLoaded, applyCenter]);

  const handleRadiusChange = useCallback((r) => {
    setRadius(r);
    if (center) fetchHospitals(center, r);
  }, [center, fetchHospitals]);

  const useMyLocation = useCallback(() => {
    if (!navigator.geolocation) { setError('Geolocation is not supported by your browser.'); return; }
    setGeoLoading(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        applyCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoLoading(false);
      },
      () => {
        setError('Could not get your location. Please allow location access or search manually.');
        setGeoLoading(false);
      }
    );
  }, [applyCenter]);

  const selectHospital = useCallback((h, idx) => {
    setSelectedIdx(idx);
    if (mapRef.current) {
      mapRef.current.panTo({ lat: h.lat, lng: h.lng });
      mapRef.current.setZoom(16);
    }
  }, []);

  return (
    <div className="min-h-[calc(100vh-56px)] bg-slate-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-screen-2xl mx-auto flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-lg font-bold text-slate-800 flex items-center gap-2">🏥 Nearby Hospitals</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Search any location or click the map — powered by Google Maps
            </p>
          </div>
          {locationLabel && (
            <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5">
              <span className="text-xs">📍</span>
              <span className="text-xs text-blue-700 font-medium max-w-xs truncate">{locationLabel}</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 flex max-w-screen-2xl mx-auto w-full p-5 gap-5" style={{ minHeight: 0 }}>
        {/* ── Left panel ── */}
        <div className="w-80 flex-shrink-0 flex flex-col gap-4" style={{ maxHeight: 'calc(100vh - 136px)', overflowY: 'auto' }}>

          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
            <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">Find Hospitals Near</p>

            <div className="flex gap-2">
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder="City, area, or address…"
                className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 placeholder:text-slate-400"
              />
              <button
                onClick={handleSearch}
                disabled={loading || !query.trim() || !isLoaded}
                className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm"
              >
                🔍
              </button>
            </div>

            <button
              onClick={useMyLocation}
              disabled={geoLoading || loading || !isLoaded}
              className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-blue-200 text-blue-700 rounded-lg hover:bg-blue-50 transition-colors text-sm font-semibold disabled:opacity-50"
            >
              {geoLoading
                ? <><div className="w-3.5 h-3.5 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin" />Getting location…</>
                : <><span>📍</span>Use My Location</>}
            </button>

            <div>
              <p className="text-xs text-slate-500 font-semibold mb-1.5">Search Radius</p>
              <div className="flex gap-1.5">
                {[2, 5, 10, 20].map(r => (
                  <button key={r} onClick={() => handleRadiusChange(r)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                      radius === r ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-200 text-slate-600 hover:border-blue-400'
                    }`}>
                    {r}km
                  </button>
                ))}
              </div>
            </div>

            <p className="text-xs text-slate-400 text-center">
              Or <span className="text-blue-600 font-medium">click anywhere on the map</span> to set location
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-2">
              <span className="text-red-500 text-sm mt-0.5 flex-shrink-0">⚠</span>
              <p className="text-xs text-red-700">{error}</p>
            </div>
          )}

          {loading && (
            <div className="bg-white rounded-xl border border-slate-200 p-6 text-center">
              <div className="w-8 h-8 border-2 border-slate-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-slate-500">Searching nearby hospitals…</p>
              <p className="text-xs text-slate-400 mt-1">Querying Google Places</p>
            </div>
          )}

          {!loading && !hospitals.length && !error && isLoaded && (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
              <div className="text-4xl mb-3">🏥</div>
              <p className="text-sm font-semibold text-slate-700">Search for a location</p>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                Type an address, click "Use My Location", or click anywhere on the map
              </p>
            </div>
          )}

          {!loading && hospitals.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white">
                <p className="text-xs font-bold text-slate-700">
                  {hospitals.length} result{hospitals.length !== 1 ? 's' : ''} found
                </p>
                <span className="text-xs text-slate-400">within {radius}km</span>
              </div>

              {hospitals.map((h, i) => {
                const isSelected = selectedIdx === i;
                return (
                  <div
                    key={h.place_id}
                    onClick={() => selectHospital(h, i)}
                    className={`px-4 py-3 cursor-pointer border-b border-slate-50 transition-all hover:bg-slate-50 ${
                      isSelected ? 'bg-blue-50 border-l-[3px] border-l-blue-500' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-800 leading-snug">{h.name}</p>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <span className="text-xs font-semibold text-slate-500">{h.distKm.toFixed(1)} km</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                            h.isHospital ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'
                          }`}>{h.isHospital ? 'Hospital' : 'Medical'}</span>
                          {h.rating && <span className="text-xs text-slate-400">⭐ {h.rating}</span>}
                        </div>
                        {h.address && <p className="text-xs text-slate-400 mt-0.5 truncate">{h.address}</p>}
                        <a
                          href={`https://www.google.com/maps/dir/?api=1&destination=${h.lat},${h.lng}`}
                          target="_blank" rel="noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="inline-block mt-1.5 text-xs text-blue-600 hover:underline font-medium"
                        >
                          Get directions ↗
                        </a>
                      </div>
                      <svg className="w-3.5 h-3.5 text-slate-300 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Map ── */}
        <div className="flex-1 rounded-xl border border-slate-200 overflow-hidden shadow-sm relative" style={{ minHeight: 500 }}>
          {isLoaded ? (
            <GoogleMap
              mapContainerStyle={{ width: '100%', height: '100%' }}
              center={center || MAP_CENTER_DEFAULT}
              zoom={center ? 14 : 5}
              options={MAP_OPTIONS}
              onLoad={onMapLoad}
              onClick={(e) => {
                const c = { lat: e.latLng.lat(), lng: e.latLng.lng() };
                applyCenter(c);
              }}
            >
              {/* User location marker */}
              {center && (
                <Marker position={center} icon={userLocationIcon()} zIndex={2000} title="Chosen Location" />
              )}

              {/* Hospital markers */}
              {hospitals.map((h, i) => (
                <Marker
                  key={h.place_id}
                  position={{ lat: h.lat, lng: h.lng }}
                  icon={hospitalIcon(h.isHospital)}
                  zIndex={1000}
                  onClick={() => selectHospital(h, i)}
                />
              ))}

              {/* Info window for selected hospital */}
              {selectedIdx !== null && hospitals[selectedIdx] && (
                <InfoWindow
                  position={{ lat: hospitals[selectedIdx].lat, lng: hospitals[selectedIdx].lng }}
                  onCloseClick={() => setSelectedIdx(null)}
                >
                  <div style={{ fontFamily: 'system-ui,sans-serif', minWidth: 170, maxWidth: 220 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 3, color: '#1e293b' }}>
                      {hospitals[selectedIdx].name}
                    </div>
                    <div style={{ color: '#64748b', fontSize: 11 }}>
                      {hospitals[selectedIdx].distKm.toFixed(1)} km away
                      {hospitals[selectedIdx].rating ? ` · ⭐ ${hospitals[selectedIdx].rating}` : ''}
                    </div>
                    {hospitals[selectedIdx].address && (
                      <div style={{ color: '#94a3b8', fontSize: 11, marginTop: 2 }}>
                        {hospitals[selectedIdx].address}
                      </div>
                    )}
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${hospitals[selectedIdx].lat},${hospitals[selectedIdx].lng}`}
                      target="_blank" rel="noreferrer"
                      style={{
                        display: 'inline-block', marginTop: 7, padding: '3px 10px',
                        background: '#2563eb', color: 'white', borderRadius: 5,
                        fontSize: 11, fontWeight: 600, textDecoration: 'none',
                      }}
                    >
                      Get Directions ↗
                    </a>
                  </div>
                </InfoWindow>
              )}
            </GoogleMap>
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-slate-100">
              <div className="text-center">
                <div className="w-8 h-8 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-3" />
                <p className="text-sm text-slate-500">Loading Google Maps…</p>
              </div>
            </div>
          )}

          {/* Hint overlay when no location selected */}
          {isLoaded && !center && (
            <div style={{ pointerEvents: 'none' }} className="absolute inset-0 flex items-center justify-center">
              <div className="bg-white/90 backdrop-blur-sm rounded-2xl px-6 py-4 shadow-lg border border-slate-200 text-center max-w-xs">
                <div className="text-3xl mb-2">🗺️</div>
                <p className="text-sm font-bold text-slate-700">Pick a location</p>
                <p className="text-xs text-slate-500 mt-1">
                  Search an address, use GPS, or click anywhere on the map to find hospitals near that spot
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
