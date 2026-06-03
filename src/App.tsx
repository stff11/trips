import { useState, useEffect, useMemo } from 'react';
import CinematicMap from './components/CinematicMap';
import TripCards from './components/TripCards';
import PhotoGallery from './components/PhotoGallery';
import Lightbox from './components/Lightbox';
import { PhotoContextMenu } from './components/PhotoContextMenu';
import TripCover from './components/TripCover';
import { Compass, Map as MapIcon, ChevronLeft, Plus } from 'lucide-react';
import './index.css';

export default function App() {
  const [trips, setTrips] = useState<any[]>([]);
  const [selectedTripId, setSelectedTripId] = useState<number | null>(null);
  const [view, setView] = useState<'map' | 'journeys'>('map');
  const [isDragging, setIsDragging] = useState(false);
  const [contextMenu, setContextMenu] = useState<any>(null);
  const [lightbox, setLightbox] = useState({ open: false, index: 0, photos: [] as any[] });

  const reloadData = async () => {
    try {
      const res = await fetch('/api/fetch-trips');
      if (res.ok) setTrips(await res.json());
    } catch (err) { console.error("Fetch error:", err); }
  };

  const selectedTrip = useMemo(() => 
    trips.find(t => t.id === selectedTripId) || null, 
  [trips, selectedTripId]);
  
  const handleMapTripSelect = (trip: any) => {
    setSelectedTripId(trip.id);
    setView('journeys');
  };

  useEffect(() => { void reloadData(); }, []);

  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0); // 0 to 100
  
// Unified Drag/Upload Logic
const handleFileUpload = async (files: FileList) => {
  const fileArray = Array.from(files);
  setIsDragging(false);
  setIsProcessing(true);

  const processFile = (file: File) => {
    return new Promise<any>((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve({ 
        name: file.name, 
        base64Data: (e.target?.result as string).split(',')[1],
        type: file.type 
      });
      reader.readAsDataURL(file);
    });
  };

  for (let i = 0; i < fileArray.length; i++) {
    const converted = await processFile(fileArray[i]);

    try {
      // Send one by one
      await fetch('/api/process-uploads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photos: [converted], tripId: selectedTrip?.id || null })
      });
      setProgress(Math.round(((i + 1) / fileArray.length) * 100));
    } catch (err) {
      console.error("Upload failed for:", fileArray[i].name);
    }
  }
  setIsProcessing(false);
  await reloadData();
};

  const handleAction = async (action: 'delete' | 'edit' | 'cover', type: 'trip' | 'photo', id: number, extra?: any) => {
    setContextMenu(null);
    if (action === 'delete') {
      if (!window.confirm(`Delete this ${type}?`)) return;
      const body = type === 'photo' ? { photoId: id, cloudinaryPublicId: extra?.publicId } : { action: 'DELETE', tripId: id };
      await fetch(type === 'photo' ? '/api/delete-photo' : '/api/manage-trip', { 
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) 
      });
      if (type === 'trip') setSelectedTripId(null);
    } else if (action === 'edit') {
      const newName = window.prompt("Enter new title:", extra?.currentName);
      if (newName) {
        await fetch('/api/manage-trip', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'EDIT', tripId: id, newName }) });
      }
    } else if (action === 'cover') {
      await fetch('/api/manage-trip', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ action: 'SET_COVER', tripId: extra?.tripId, photoId: id }) 
      });
    }
    await reloadData();
  };

  return (
    <div 
      className="flex w-screen h-screen bg-[#0a0c14] text-zinc-100 font-sans"
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => { e.preventDefault(); handleFileUpload(e.dataTransfer.files); }}
      onClick={() => setContextMenu(null)}
    >
      {isDragging && <div className="absolute inset-0 z-50 bg-amber-500/10 border-4 border-dashed border-amber-500 flex items-center justify-center pointer-events-none font-bold text-amber-500 text-xl">DROP TO UPLOAD</div>}

      {/* SIDE NAV */}
      <nav className="hidden md:flex w-64 border-r border-zinc-800/50 p-8 flex flex-col gap-12 z-20 bg-[#0a0c14]">
        <h1 className="font-bold text-lg flex items-center gap-3"><div className="p-2 bg-amber-400 rounded-full"><Compass size={20}/></div>Photo Diary</h1>
        <div className="flex flex-col gap-2">
          <button onClick={() => setView('map')} className={`flex items-center gap-4 px-4 py-3 rounded-xl ${view === 'map' ? 'bg-zinc-800' : ''}`}><MapIcon size={18} /> Map</button>
          <button onClick={() => setView('journeys')} className={`flex items-center gap-4 px-4 py-3 rounded-xl ${view === 'journeys' ? 'bg-zinc-800' : ''}`}><Compass size={18} /> Journeys</button>
        </div>
        <label className="cursor-pointer bg-amber-400 hover:bg-zinc-700 text-white p-4 rounded-2xl flex items-center justify-center gap-2 font-bold text-xs">
          <Plus size={16} /> UPLOAD
          <input type="file" multiple className="hidden" onChange={(e) => e.target.files && handleFileUpload(e.target.files)} />
        </label>
      </nav>
      {/* Mobile Bottom Bar: Only shows on mobile */}
      <div className="md:hidden fixed bottom-0 w-full flex justify-around p-4 bg-zinc-900 z-50">
        <button onClick={() => setView('map')}>Map</button>
        <button onClick={() => setView('journeys')}>Journeys</button>
        <label>Upload <input type="file" hidden /></label>
      </div>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 overflow-y-auto relative">
        {view === 'map' ? (
          <CinematicMap 
            activeCoordinates={[49.8225, 19.0441]} // Bielsko
            markers={trips} 
            onSelectTrip={handleMapTripSelect}
          />
        ) : selectedTrip ? (
          <div className="animate-in fade-in duration-500">
            <button onClick={() => setSelectedTripId(null)} className="absolute top-8 left-8 z-20 p-2 bg-zinc-900 rounded-full"
              ><ChevronLeft />
            </button>
            <div className="h-[25vh] md:h-[40vh] w-full relative bg-zinc-900">
              <TripCover 
                trip={selectedTrip} 
                width={1200} 
                className="w-full h-full" 
              />
            </div>
            <div className="p-10">
              <PhotoGallery 
                photos={selectedTrip.photos || []} 
                onPhotoClick={(idx: number) => setLightbox({ open: true, index: idx, photos: selectedTrip.photos })}
                onContextMenu={(e: any, id: number, publicId: string) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, type: 'photo', id, extra: { publicId } }); }}
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
              onContextMenu={(e: any, id: number, name: string) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, type: 'trip', id, extra: { currentName: name } }); }}
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

      {/* CONTEXT MENU & LIGHTBOX PORTALS */}
      {contextMenu && (
        <div className="fixed z-[9999]" style={{ top: contextMenu.y, left: contextMenu.x }} onClick={e => e.stopPropagation()}>
          <PhotoContextMenu 
            tripId={contextMenu.type === 'trip' ? contextMenu.id : selectedTrip?.id}
            photoId={contextMenu.type === 'photo' ? contextMenu.id : undefined}
            onDeleteTrip={(id) => handleAction('delete', 'trip', id)}
            onDeletePhoto={(id) => handleAction('delete', 'photo', id, contextMenu.extra)}
            onEditName={(id) => handleAction('edit', 'trip', id, contextMenu.extra)}
            onSetCover={(id) => handleAction('cover', 'photo', id, { tripId: selectedTrip?.id })}
          />
        </div>
      )}
      {lightbox.open && 
      <Lightbox 
        photos={lightbox.photos} 
        activeIndex={lightbox.index} 
        onClose={() => setLightbox(p => ({ ...p, open: false }))} 
        onPrev={() => setLightbox(p => ({ ...p, index: Math.max(0, p.index - 1) }))}
        onNext={() => setLightbox(p => ({ ...p, index: Math.min(p.photos.length - 1, p.index + 1) }))}
      />}
    </div>
  );
}

