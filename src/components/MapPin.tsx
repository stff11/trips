// 📁 components/MapPin.tsx
import React from 'react';
import { CircleMarker, Tooltip } from 'react-leaflet';

interface Trip {
  id: number;
  name: string;
  centerLat: number;
  centerLng: number;
  coverPhotoUrl: string;
}

interface MapPinProps {
  trip: Trip;
}

export const MapPin: React.FC<MapPinProps> = ({ trip }) => {
  return (
    <CircleMarker 
      center={[trip.centerLat, trip.centerLng]} 
      radius={6} 
      pathOptions={{ 
        color: 'white', 
        fillColor: 'gold', 
        fillOpacity: 1, 
        weight: 2 
      }}
    >
      {/* Tooltip triggers on hover automatically */}
      <Tooltip direction="top" offset={[0, -10]} opacity={1}>
        <div className="preview-card">
          <img src={trip.coverPhotoUrl} alt={trip.name} style={{ width: '100px', display: 'block' }} />
          <a href={`/album/${trip.id}`} style={{ color: 'black', fontWeight: 'bold' }}>
            {trip.name}
          </a>
        </div>
      </Tooltip>
    </CircleMarker>
  );
};