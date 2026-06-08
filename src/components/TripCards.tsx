import TripCover from "./TripCover";

interface TripCardsProps {
  trips: any[];
  selectedTrip: any | null;
  onSelectTrip: (trip: any) => void;
  onContextMenu: (e: React.MouseEvent, id: number, name: string) => void;
}

export default function TripCards({
  trips,
  onSelectTrip,
  onContextMenu,
}: TripCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {trips.map((trip) => (
        <button
          key={trip.id}
          onContextMenu={(e) => onContextMenu(e, trip.id, trip.name)}
          onClick={() => onSelectTrip(trip)}
          className="group relative aspect-[5/4] w-full overflow-hidden rounded-2xl shadow-xl transition-all hover:scale-[1.02] hover:shadow-2xl"
        >
          <TripCover trip={trip} width={600} className="w-full h-full rounded-2xl" />
        </button>
      ))}
    </div>
  );
}
