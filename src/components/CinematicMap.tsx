// File: /src/components/CinematicMap.tsx
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { useEffect } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const goldIcon = L.divIcon({
  className: 'gold-pin-wrapper',
  html: `<div class="gold-pin-head"></div>`, // The circle part
  iconSize: [20, 30],
  iconAnchor: [10, 30] // Centers the pin and aligns the bottom at the coordinate
});

function MapController({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    if (center && center[0] !== 0) {
      map.setView(center, 5, { animate: true, duration: 1.2 });
      setTimeout(() => map.invalidateSize(), 200);
    }
  }, [center, map]);
  return null;
}

export default function CinematicMap({ activeCoordinates, markers }: { activeCoordinates: [number, number], markers: any[] }) {
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
        
        {markers.map((trip) => trip.centerLat && trip.centerLng && (
          <Marker 
            key={trip.id} 
            position={[trip.centerLat, trip.centerLng]}
            icon={goldIcon} // Use the divIcon here
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