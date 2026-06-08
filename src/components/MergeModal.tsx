import { Trip } from '../types';

interface MergeModalProps {
    trips: Trip[];
    sourceTrip: Trip;
    onClose: () => void;
    onConfirm: (targetId: number) => void;
  }

  export const MergeModal = ({ trips, sourceTrip, onClose, onConfirm }: MergeModalProps) => {
    return (
      <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center">
        <div className="bg-white p-6 rounded-lg shadow-xl w-96">
          <h2 className="text-lg font-bold mb-4">Merge "{sourceTrip.name}"</h2>
          <p className="text-sm text-zinc-600 mb-4">Select the album to merge this album into: </p>
          
          <div className="space-y-2 mb-6">
            {trips
              .filter((t: Trip) => t.id !== sourceTrip.id)
              .map((trip: Trip) => (
                <button
                  key={trip.id}
                  onClick={() => onConfirm(trip.id)}
                  className="w-full p-3 text-left border rounded hover:bg-zinc-50 transition-colors"
                >
                  {trip.name}
                </button>
              ))}
          </div>
          
          <button onClick={onClose} className="w-full text-zinc-500 text-sm hover:underline">
            Cancel
          </button>
        </div>
      </div>
    );
  };