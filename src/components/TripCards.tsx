// 📁 File: /src/components/TripCards.tsx
import React from 'react';
import { Calendar, MapPin } from 'lucide-react';

interface Trip {
  id: number;
  name: string;
  locationName?: string;
  startDate: Date;
  endDate: Date;
  photos?: any[];
}

interface TripCardsProps {
  trips: Trip[];
  selectedTrip: Trip | null;
  onSelectTrip: (trip: Trip) => void;
  onContextMenu: (e: React.MouseEvent, id: number, currentName: string) => void;
}

// Helper function to add size parameters to the cover image URL
const getOptimizedCloudinaryUrl = (url: string, width: number = 600) => {
  if (!url || !url.includes('/upload/')) return url;

  // Split the URL at '/upload/'
  const [baseUrl, path] = url.split('/upload/');
  
  // Insert the transformation string: 
  // w_{width} -> set width
  // c_fill    -> fill the area while keeping aspect ratio (no distortion)
  // f_auto    -> automatic format (WebP/AVIF)
  // q_auto    -> automatic quality optimization
  const transformations = `w_${width},c_fill,f_auto,q_auto`;

  return `${baseUrl}/upload/${transformations}/${path}`;
};

// Helper function to resolve the cover image URL
const getCoverUrl = (trip: any) => {
  // 1. If no cover ID is set, or no photos exist, return a fallback
  if (!trip.coverPhotoId || !trip.photos || trip.photos.length === 0) {
    console.log("no image")
    return '/assets/fallback-image.jpeg'; // Path to a default image
  }
  
  // 2. Find the photo object where the ID matches the trip's coverPhotoId
  const coverPhoto = trip.photos.find((p: any) => p.id === trip.coverPhotoId);
  // console.log("coverPhoto = ",coverPhoto)
  
  // 3. Return the URL if found, or the fallback if not
  return coverPhoto ? getOptimizedCloudinaryUrl(coverPhoto.cloudinaryUrl, 600) : '/assets/fallback-image.jpg';
};

const TripImage = ({ trip }: { trip: any }) => {
  const url = getCoverUrl(trip);
  return (
    <img 
      src={url} 
      className="absolute inset-0 w-full h-full object-cover z-0" 
      alt={trip.name}
    />
  );
};

export default function TripCards({ trips, onSelectTrip, onContextMenu }: TripCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {trips.map((trip) => (
  <button 
    key={trip.id} 
    onContextMenu={(e) => onContextMenu(e, trip.id, trip.name)}
    onClick={() => onSelectTrip(trip)}
    className="group relative aspect-[5/4] w-full overflow-hidden shadow-2xl transition-transform hover:scale-[1.02]"
  >
    <TripImage trip={trip} />

    {/* Overlay container */}
    <div className="absolute bottom-2 p-1 bg-gradient-to-t from-black/80 to-transparent w-full">
        <h3 className="text-2xl font-serif text-white text-left">{trip.name}</h3>
        <span className="text-zinc-400 text-xs font-medium uppercase tracking-wider flex items-center gap-1">
          <MapPin size={10} />
          <span>{trip.locationName}</span>
        </span>
      
      <p className="text-amber-400 text-[10px] font-bold uppercase tracking-widest mt-1 flex items-center gap-1">
        <Calendar size={12} className="text-amber-500" />
        <span>
          (
          {new Date(trip.startDate).toLocaleDateString('en-GB').replace(/\//g,'-')}
          {' - '}
          {new Date(trip.endDate).toLocaleDateString('en-GB').replace(/\//g,'-')}
          )
        </span>
      </p>
    </div>
  </button>
))}
    </div>
  );
}