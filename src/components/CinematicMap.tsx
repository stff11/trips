// 📁 File: /src/components/CinematicMap.tsx
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { useEffect } from 'react';
import L from 'leaflet';

// Explicitly ensure Leaflet CSS stays compiled
import 'leaflet/dist/leaflet.css';

const CinematicIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

function MapController({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    if (center && center[0] !== 0) {
      map.setView(center, 5, { animate: true, duration: 1.2 });
      // 🌟 Explicitly trigger a container dimension update event to fix initialization layout collapse
      setTimeout(() => {
        map.invalidateSize();
      }, 200);
    }
  }, [center, map]);
  return null;
}

export default function CinematicMap({ activeCoordinates, markers }: { activeCoordinates: [number, number], markers: any[] }) {
  return (
    <div className="absolute inset-0 z-0 w-screen h-screen grayscale-[10%] contrast-[110%] brightness-[85%]">
      {/* 🌟 FORCE HARD CODED VIEWPORT ENVELOPE DIMENSIONS */}
      <MapContainer 
        center={activeCoordinates} 
        zoom={4} 
        zoomControl={false} 
        style={{ width: '100vw', height: '100vh' }}
      >
        <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
        <MapController center={activeCoordinates} />
        
        {markers.map((trip) => trip.centerLat && trip.centerLng && (
          <Marker 
            key={trip.id} 
            position={[trip.centerLat, trip.centerLng]}
            icon={CinematicIcon}
          >
            <Popup>
              <div className="p-1 font-sans">
                <p className="font-bold text-zinc-900 text-xs uppercase tracking-wider">{trip.name}</p>
                <p className="text-[10px] text-zinc-500 mt-0.5">{trip.photos?.length || 0} Files Archived</p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}