import { Calendar, MapPin } from 'lucide-react';
import { getCoverUrl } from '../utils/photoUtils';

interface TripCoverProps {
  trip: any;
  width?: number; // Optional: default to 600 if not provided
  className?: string; // Optional: to allow extra positioning/sizing styles
}

export default function TripCover({ trip, width = 600, className = "" }: TripCoverProps) {
  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* 1. Image Layer */}
      <img 
        src={getCoverUrl(trip, width)} 
        alt={trip.name}
        className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
      />

      {/* 2. Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

      {/* 3. Content Overlay */}
      <div className="absolute bottom-0 p-6 w-full text-left">
        <h3 className="text-2xl font-serif text-white">{trip.name}</h3>
        
        <div className="flex flex-col gap-1 mt-2">
          <span className="text-zinc-300 text-xs font-medium uppercase tracking-wider flex items-center gap-1">
            <MapPin size={12} /> {trip.locationName || 'Unknown Location'}
          </span>
          
          <span className="text-amber-400 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1">
            <Calendar size={12} />
            {new Date(trip.startDate).toLocaleDateString('en-GB-u-nu-latn').replace(/\//g, '-')}
          </span>
        </div>
        
        <div className="mt-3 text-white/70 text-xs font-bold">
          {trip.photoCount || 0} photos
        </div>
      </div>
    </div>
  );
}