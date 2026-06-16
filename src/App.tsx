import { useState, useEffect, useMemo } from 'react';
import CinematicMap from './components/CinematicMap';
import TripCards from './components/TripCards';
import PhotoGallery from './components/PhotoGallery';
import Lightbox from './components/Lightbox';
import { PhotoContextMenu } from './components/PhotoContextMenu';
import TripCover from './components/TripCover';
import { MergeModal } from './components/MergeModal';
import { Trip, Photo } from './types';
import { Compass, Map as MapIcon, ChevronLeft, Plus } from 'lucide-react';
import './index.css';

// ─── Types ───────────────────────────────────────────────────────────────────

interface TripWithPhotos extends Trip {
  photos: Photo[];
  centerLat?: number;
  centerLng?: number;
  locationName?: string;
  coverPhotoId?: number;
}

interface ContextMenuState {
  x: number;
  y: number;
  type: 'trip' | 'photo';
  id: number;
  extra?: { currentName?: string; publicId?: string; tripId?: number };
}

interface LightboxState {
  open: boolean;
  index: number;
  photos: Photo[];
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function App() {
  const [trips, setTrips] = useState<TripWithPhotos[]>([]);
  const [selectedTripId, setSelectedTripId] = useState<number | null>(null);
  const [view, setView] = useState<'map' | 'journeys'>('map');
  const [isDragging, setIsDragging] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [lightbox, setLightbox] = useState<LightboxState>({ open: false, index: 0, photos: [] });
  const [mergingTrip, setMergingTrip] = useState<Trip | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  const selectedTrip = useMemo(
    () => trips.find((t) => t.id === selectedTripId) ?? null,
    [trips, selectedTripId],
  );

  // ─── Data Loading ─────────────────────────────────────────────────────────

  const reloadData = async () => {
    try {
      const res = await fetch('/api/fetch-trips');
      if (res.ok) setTrips(await res.json());
    } catch (err) {
      console.error('Fetch error:', err);
    }
  };

  useEffect(() => { void reloadData(); }, []);

  // ─── File Upload ──────────────────────────────────────────────────────────

  const handleFileUpload = async (files: File[]) => {
    setIsProcessing(true);
    setProgress(0);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const formData = new FormData();
      formData.append('file', file);
      formData.append('tripId', selectedTrip?.id?.toString() ?? '');

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/process-uploads');

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const currentFileProgress = (event.loaded / event.total) * 100;
            const totalProgress = Math.round(
              ((i / files.length) * 100) + (currentFileProgress / files.length),
            );
            setProgress(totalProgress);
          }
        };

        xhr.onload = () => {
          if (xhr.status === 200) {
            resolve();
          } else if (xhr.status === 504) {
            // FIX: was missing resolve/reject — the loop would hang forever on timeout
            alert('The server is taking too long to process the location data. Trying again...');
            resolve(); // continue to next file rather than stalling
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        };

        xhr.onerror = () => reject(new Error('Network error'));
        xhr.send(formData);
      });
    }

    setProgress(100);
    await new Promise((r) => setTimeout(r, 500));

    setIsProcessing(false);
    setProgress(0);
    setIsDragging(false);
    await reloadData();
  };

  // ─── Actions ──────────────────────────────────────────────────────────────

  const handleMerge = async (sourceId: number, targetId: number) => {
    await fetch('/api/merge-trips', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceTripId: sourceId, targetTripId: targetId }),
    });
    setMergingTrip(null);
    await reloadData();
  };

  const handleAction = async (
    action: 'delete' | 'edit' | 'cover',
    type: 'trip' | 'photo',
    id: number,
    extra?: ContextMenuState['extra'],
  ) => {
    setContextMenu(null);

    if (action === 'delete') {
      if (!window.confirm(`Delete this ${type}?`)) return;

      const isPhoto = type === 'photo';
      const body = isPhoto
        ? { photoId: id, tripId: extra?.tripId }
        : { action: 'DELETE', tripId: id };
      const url = isPhoto ? '/api/delete-photo' : '/api/manage-trip';

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        alert(`Error: ${errorText}`);
        return;
      }

      if (type === 'trip') setSelectedTripId(null);

    } else if (action === 'edit') {
      const newName = window.prompt('Enter new title:', extra?.currentName);
      if (newName) {
        await fetch('/api/manage-trip', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'EDIT', tripId: id, newName }),
        });
      }

    } else if (action === 'cover') {
      await fetch('/api/manage-trip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'SET_COVER', tripId: extra?.tripId, photoId: id }),
      });
    }

    await reloadData();
  };

  const handleMapTripSelect = (trip: TripWithPhotos) => {
    setSelectedTripId(trip.id);
    setView('journeys');
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div
      className="flex w-screen h-screen bg-[#0a0c14] text-zinc-100 font-sans"
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        handleFileUpload(Array.from(e.dataTransfer.files));
      }}
      onClick={() => setContextMenu(null)}
    >
      {isDragging && (
        <div className="absolute inset-0 z-50 bg-amber-500/10 border-4 border-dashed border-amber-500 flex items-center justify-center pointer-events-none font-bold text-amber-500 text-xl">
          DROP TO UPLOAD
        </div>
      )}

      {/* SIDE NAV */}
      <nav className="hidden md:flex w-64 border-r border-zinc-800/50 p-8 flex-col gap-12 z-20 bg-[#0a0c14]">
        <h1 className="font-bold text-lg flex items-center gap-3">
          <div className="p-2 bg-amber-400 rounded-full"><Compass size={20} /></div>
          Photo Diary
        </h1>
        <div className="flex flex-col gap-2">
          <button
            onClick={() => setView('map')}
            className={`flex items-center gap-4 px-4 py-3 rounded-xl ${view === 'map' ? 'bg-zinc-800' : ''}`}
          >
            <MapIcon size={18} /> Map
          </button>
          <button
            onClick={() => setView('journeys')}
            className={`flex items-center gap-4 px-4 py-3 rounded-xl ${view === 'journeys' ? 'bg-zinc-800' : ''}`}
          >
            <Compass size={18} /> Journeys
          </button>
        </div>
        <label className="cursor-pointer bg-amber-400 hover:bg-zinc-700 text-white p-4 rounded-2xl flex items-center justify-center gap-2 font-bold text-xs">
          <Plus size={16} /> UPLOAD
          <input
            type="file"
            multiple
            className="hidden"
            onChange={(e) => e.target.files && handleFileUpload(Array.from(e.target.files))}
          />
        </label>
      </nav>

      {/* Mobile Bottom Bar */}
      <div className="md:hidden fixed bottom-0 w-full flex justify-around p-4 bg-zinc-900 z-50">
        <button onClick={() => setView('map')}>Map</button>
        <button onClick={() => setView('journeys')}>Journeys</button>
        {/* FIX: was missing onChange handler — mobile uploads did nothing */}
        <label>
          Upload
          <input
            type="file"
            hidden
            onChange={(e) => e.target.files && handleFileUpload(Array.from(e.target.files))}
          />
        </label>
      </div>

      {/* MAIN CONTENT */}
      <main className="flex-1 overflow-y-auto relative">
        {view === 'map' ? (
          <CinematicMap
            activeCoordinates={[49.8225, 19.0441]}
            markers={trips}
            onSelectTrip={handleMapTripSelect}
          />
        ) : selectedTrip ? (
          <div className="animate-in fade-in duration-500">
            <button
              onClick={() => setSelectedTripId(null)}
              // className="absolute top-8 left-8 z-20 p-2 bg-zinc-900 rounded-full"
              className="fixed top-6 left-6 z-30 p-2.5 bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-700/50 backdrop-blur-sm rounded-full shadow-lg transition-colors"
            >
              <ChevronLeft />
            </button>
            <div className="h-[25vh] md:h-[40vh] w-full relative bg-zinc-900">
              <TripCover trip={selectedTrip} width={1200} className="w-full h-full" />
            </div>
            <div className="p-10">
              <PhotoGallery
                photos={selectedTrip.photos ?? []}
                onPhotoClick={(idx: number) =>
                  setLightbox({ open: true, index: idx, photos: selectedTrip.photos })
                }
                onContextMenu={(e: React.MouseEvent, id: number, publicId: string) => {
                  e.preventDefault();
                  setContextMenu({
                    x: e.clientX,
                    y: e.clientY,
                    type: 'photo',
                    id,
                    // FIX: was setting publicId but handleAction reads tripId for delete payload
                    extra: { publicId, tripId: selectedTrip.id },
                  });
                }}
              />
            </div>
          </div>
        ) : (
          <div className="p-4">
            <h2 className="text-3xl font-bold mb-4">Journeys</h2>
            <TripCards
              trips={trips}
              selectedTrip={selectedTrip}
              onSelectTrip={(trip) => setSelectedTripId(trip.id)}
              onContextMenu={(e: React.MouseEvent, id: number, name: string) => {
                e.preventDefault();
                setContextMenu({ x: e.clientX, y: e.clientY, type: 'trip', id, extra: { currentName: name } });
              }}
            />
          </div>
        )}

        {isProcessing && (
          <div className="fixed inset-0 z-[100] bg-zinc-950/80 flex flex-col items-center justify-center backdrop-blur-sm">
            <div className="w-64 bg-zinc-900 border border-zinc-700 rounded-2xl p-6 shadow-2xl">
              <h3 className="font-bold mb-2">Uploading Photos...</h3>
              <div className="w-full bg-zinc-700 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-amber-400 h-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-zinc-400 mt-2 text-right">{progress}%</p>
            </div>
          </div>
        )}
      </main>

      {/* CONTEXT MENU */}
      {contextMenu && (
        <div
          className="fixed z-[9999]"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <PhotoContextMenu
            tripId={contextMenu.type === 'trip' ? contextMenu.id : (selectedTrip?.id ?? 0)}
            photoId={contextMenu.type === 'photo' ? contextMenu.id : undefined}
            onDeleteTrip={(id) => handleAction('delete', 'trip', id)}
            onDeletePhoto={(id) =>
              handleAction('delete', 'photo', id, {
                ...contextMenu.extra,
                tripId: selectedTrip?.id,
              })
            }
            onEditName={(id) => handleAction('edit', 'trip', id, contextMenu.extra)}
            onSetCover={(id) => handleAction('cover', 'photo', id, { tripId: selectedTrip?.id })}
            onMerge={(id) => {
              const tripToMerge = trips.find((t) => t.id === id);
              if (tripToMerge) setMergingTrip(tripToMerge);
            }}
          />
        </div>
      )}

      {/* MERGE MODAL */}
      {mergingTrip && (
        <MergeModal
          trips={trips}
          sourceTrip={mergingTrip}
          onClose={() => setMergingTrip(null)}
          onConfirm={(targetId) => handleMerge(mergingTrip.id, targetId)}
        />
      )}

      {/* LIGHTBOX */}
      {lightbox.open && (
        <Lightbox
          photos={lightbox.photos}
          activeIndex={lightbox.index}
          onClose={() => setLightbox((p) => ({ ...p, open: false }))}
          onPrev={() => setLightbox((p) => ({ ...p, index: Math.max(0, p.index - 1) }))}
          onNext={() =>
            setLightbox((p) => ({ ...p, index: Math.min(p.photos.length - 1, p.index + 1) }))
          }
        />
      )}
    </div>
  );
}
