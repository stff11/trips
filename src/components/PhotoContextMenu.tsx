interface PhotoContextMenuProps {
  onDeleteTrip?: (tripId: number) => void;
  onDeletePhoto?: (photoId: number,tripId: number) => void; 
  onEditName?: (tripId: number) => void;
  onSetCover?: (photoId: number) => void;
  tripId: number;
  photoId?: number; // Optional, only needed if acting on a specific photo
}

export const PhotoContextMenu = ({ 
  onDeleteTrip,
  onDeletePhoto,
  onEditName,
  onSetCover,
  tripId,
  photoId
}: PhotoContextMenuProps) => {
  return (
    <div className="absolute z-50 bg-white rounded-lg shadow-xl border border-zinc-200 py-1 w-48 animate-in fade-in zoom-in duration-100">
      
      {/* Photo Actions */}
      {photoId && (
        <>
          <button onClick={() => onSetCover?.(photoId)} className="block w-full text-left px-4 py-2 hover:bg-zinc-100 text-xs text-zinc-700">
            Set as Album Cover
          </button>
          <button onClick={() => onDeletePhoto?.(photoId, tripId)} className="block w-full text-left px-4 py-2 hover:bg-zinc-100 text-xs text-red-600">
            Delete Photo
          </button>
          <div className="h-px bg-zinc-200 my-1" />
        </>
      )}

      {/* Album Actions */}
      <button onClick={() => onEditName?.(tripId)} className="block w-full text-left px-4 py-2 hover:bg-zinc-100 text-xs text-zinc-700">
        Edit Album Name
      </button>
      <button onClick={() => onDeleteTrip?.(tripId)} className="block w-full text-left px-4 py-2 hover:bg-zinc-100 text-xs text-red-600">
        Delete Entire Album
      </button>
    </div>
  );
};