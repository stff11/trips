import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { Trip } from '../types';

interface MergeModalProps {
  trips: Trip[];
  sourceTrip: Trip;
  onClose: () => void;
  onConfirm: (targetId: number) => void;
}

export const MergeModal = ({ trips, sourceTrip, onClose, onConfirm }: MergeModalProps) => {
  const listRef = useRef<HTMLDivElement>(null);

  // Close on Esc
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const candidates = trips.filter((t) => t.id !== sourceTrip.id);

  return (
    // Backdrop — click outside to close
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[80vh]">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 p-6 border-b border-zinc-800">
          <div>
            <h2 className="text-base font-bold text-zinc-100">Merge Album</h2>
            <p className="text-sm text-zinc-400 mt-1">
              Merge <span className="text-amber-400 font-medium">"{sourceTrip.name}"</span> into:
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors flex-shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable trip list */}
        <div ref={listRef} className="overflow-y-auto flex-1 p-4 space-y-2">
          {candidates.length === 0 ? (
            <p className="text-zinc-500 text-sm text-center py-6">No other albums to merge into.</p>
          ) : (
            candidates.map((trip) => (
              <button
                key={trip.id}
                onClick={() => onConfirm(trip.id)}
                className="w-full p-4 text-left bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 hover:border-zinc-500 rounded-xl transition-all group"
              >
                <span className="block text-zinc-100 font-medium text-sm group-hover:text-amber-400 transition-colors">
                  {trip.name}
                </span>
                {trip.locationName && (
                  <span className="block text-zinc-500 text-xs mt-0.5">{trip.locationName}</span>
                )}
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-800">
          <button
            onClick={onClose}
            className="w-full py-2.5 text-sm text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-xl transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
