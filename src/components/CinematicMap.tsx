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

const getOptimizedCloudinaryUrl = (url: string, width: number = 300) => {
  if (!url || !url.includes('/upload/')) return url;
  const [baseUrl, path] = url.split('/upload/');
  return `${baseUrl}/upload/w_${width},c_fill,f_auto,q_auto/${path}`;
};

// Helper function to resolve the cover image (optimized for the small popup)
const getPopupImageUrl = (trip: any) => {
  if (!trip.coverPhotoId || !trip.photos) return '/placeholder.jpg';
  const coverPhoto = trip.photos.find((p: any) => p.id === trip.coverPhotoId);
  // Using 300px width for a sharp popup thumbnail
  return coverPhoto ? getOptimizedCloudinaryUrl(coverPhoto.cloudinaryUrl, 300) : '/placeholder.jpg';
};

interface CinematicMapProps {
  activeCoordinates: [number, number];
  markers: any[];
  onSelectTrip: (trip: any) => void; 
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
        
        {markers.map((trip) => trip.centerLat && trip.centerLng && (
          <Marker 
            key={trip.id} 
            position={[trip.centerLat, trip.centerLng]}
            icon={goldIcon} 
          >
            <Popup>
            <button
                className="cursor-pointer group" 
                onClick={(e) => {
                  console.log("Attempting to select trip:", trip.id);
                  // 1. Stop the click from being "eaten" by the Map or Leaflet
                  e.stopPropagation();
                  // 2. Explicitly trigger the selection
                  onSelectTrip(trip);
                }}
              >
                <img 
                  src={getPopupImageUrl(trip)} 
                  className="w-full h-32 object-cover rounded-lg mb-2 transition-transform group-hover:scale-[1.02]" 
                  alt={trip.name}
                />
                <span className="font-bold text-zinc-900 text-xs uppercase tracking-wider">{trip.name}</span>
                <br/>
                <span>{trip.locationName}</span>
                <br/>
                <span className="text-[10px] text-zinc-500 mt-0.5 font-medium">{trip.photos?.length || 0} Photos</span>
              </button>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}