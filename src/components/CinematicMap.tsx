import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { TripWithPhotos } from '../types';

const goldIcon = L.divIcon({
  className: 'gold-pin-wrapper',
  html: `<div class="gold-pin-head"></div>`,
  iconSize: [20, 30],
  iconAnchor: [10, 30],
});

function MapController({ center }: { center: [number, number] }) {
  const map = useMap();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!center || center[0] === 0) return;

    map.setView(center, 5, { animate: true, duration: 1.2 });

    // FIX: guard with getContainer() check before invalidateSize() —
    // if the view switches away before the 200ms fires, the map pane
    // is gone and Leaflet throws "_leaflet_pos" on undefined.
    timerRef.current = setTimeout(() => {
      try {
        if (map.getContainer()) map.invalidateSize();
      } catch {
        // map was removed before the timer fired — safe to ignore
      }
    }, 200);

    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, [center, map]);

  return null;
}

const getOptimizedCloudinaryUrl = (url: string, width = 300) => {
  if (!url || !url.includes('/upload/')) return url;
  const [baseUrl, path] = url.split('/upload/');
  return `${baseUrl}/upload/w_${width},c_fill,f_auto,q_auto/${path}`;
};

const getPopupImageUrl = (trip: TripWithPhotos) => {
  if (!trip.coverPhotoId || !trip.photos) return '/placeholder.jpg';
  const coverPhoto = trip.photos.find((p) => p.id === trip.coverPhotoId);
  return coverPhoto ? getOptimizedCloudinaryUrl(coverPhoto.cloudinaryUrl, 300) : '/placeholder.jpg';
};

interface CinematicMapProps {
  activeCoordinates: [number, number];
  markers: TripWithPhotos[];
  onSelectTrip: (trip: TripWithPhotos) => void;
}

export default function CinematicMap({ activeCoordinates, markers, onSelectTrip }: CinematicMapProps) {
  return (
    <div className="absolute inset-0 z-0 w-screen h-screen">
      <MapContainer
        center={activeCoordinates}
        zoom={4}
        zoomControl={false}
        style={{ width: '100vw', height: '100vh' }}
      >
        <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
        <MapController center={activeCoordinates} />

        {markers.map((trip) =>
          trip.centerLat && trip.centerLng ? (
            <Marker
              key={trip.id}
              position={[trip.centerLat, trip.centerLng]}
              icon={goldIcon}
            >
              <Popup>
                <button
                  className="cursor-pointer group"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectTrip(trip);
                  }}
                >
                  <img
                    src={getPopupImageUrl(trip)}
                    className="w-full h-32 object-cover rounded-lg mb-2 transition-transform group-hover:scale-[1.02]"
                    alt={trip.name}
                  />
                  <span className="font-bold text-zinc-900 text-xs uppercase tracking-wider">{trip.name}</span>
                  <br />
                  <span>{trip.locationName}</span>
                  <br />
                  <span className="text-[10px] text-zinc-500 mt-0.5 font-medium">{trip.photos?.length ?? 0} Photos</span>
                </button>
              </Popup>
            </Marker>
          ) : null
        )}
      </MapContainer>
    </div>
  );
}
