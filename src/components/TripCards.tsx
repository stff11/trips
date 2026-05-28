// 📁 File: /src/components/TripCards.tsx
import React from 'react';
import { Calendar, MapPin } from 'lucide-react';

interface Trip {
  id: number;
  name: string;
  locationName?: string;
  photos?: any[];
}

interface TripCardsProps {
  trips: Trip[];
  selectedTrip: Trip | null;
  onSelectTrip: (trip: Trip) => void;
  onContextMenu: (e: React.MouseEvent, id: number, currentName: string) => void;
}

export default function TripCards({ trips, selectedTrip, onSelectTrip, onContextMenu }: TripCardsProps) {
  return (
    <div className="space-y-2">
      {trips.map((trip) => (
        <div
          key={trip.id}
          onContextMenu={(e) => onContextMenu(e, trip.id, trip.name)}
          onClick={() => onSelectTrip(trip)}
          className={`p-3 rounded-xl border transition-all cursor-pointer select-none ${
            selectedTrip?.id === trip.id
              ? 'bg-zinc-900 border-amber-500/40 shadow-lg shadow-amber-500/5'
              : 'bg-zinc-950/40 border-zinc-800/60 hover:bg-zinc-900/60 hover:border-zinc-700/60'
          }`}
        >
          <h4 className="text-xs font-bold text-zinc-200 uppercase truncate flex items-center gap-2">
            <Calendar size={12} className="text-amber-500" /> {trip.name}
          </h4>
          <p className="text-[10px] text-zinc-500 mt-1 flex items-center gap-1.5">
            <MapPin size={10} /> {trip.locationName || 'Historical Cluster'}
          </p>
        </div>
      ))}
    </div>
  );
}