// 📁 File: /src/App.tsx
import { useState, useEffect, useMemo } from 'react';
import CinematicMap from './components/CinematicMap';
import TripCards from './components/TripCards';
import PhotoGallery from './components/PhotoGallery';
import Lightbox from './components/Lightbox';
import { PhotoContextMenu } from './components/PhotoContextMenu';
import { Compass, Map as MapIcon, ChevronLeft, Plus } from 'lucide-react';
import './index.css';

export default function App() {
  const [trips, setTrips] = useState<any[]>([]);
  const [selectedTripId, setSelectedTripId] = useState<number | null>(null);
  const [view, setView] = useState<'map' | 'journeys'>('map');
  const [isDragging, setIsDragging] = useState(false);
  const [contextMenu, setContextMenu] = useState<any>(null);
  const [lightbox, setLightbox] = useState<{ open: boolean; index: number; photos: any[] }>({ 
    open: false, index: 0, photos: [] 
  });

  // Derived state: This ensures selectedTrip is always in sync with the latest trips data
  // without needing manual state updates inside reloadData.
  const selectedTrip = useMemo(() => 
    trips.find(t => t.id === selectedTripId) || null, 
  [trips, selectedTripId]);

  const handleMapTripSelect = (trip: any) => {
    setSelectedTripId(trip.id); // Set the trip
    setView('journeys');    // Force the view switch so you leave the map
  };

  const reloadData = async () => {
    try {
      const res = await fetch('/api/fetch-trips');
      if (res.ok) {
        const data = await res.json();
        setTrips(data);
        // No manual setSelectedTrip update needed! 
        // useMemo will automatically update selectedTrip when trips change.
        // if (selectedTrip) {
        //   setSelectedTrip(data.find((t: any) => t.id === selectedTrip.id) || null);
        // }
      }
    } catch (err) { console.error("Data fetch error:", err); }
  };
  // const selectedTrip = trips.find(t => t.id === selectedTripId) || null;

  useEffect(() => { void reloadData(); }, []);

  // --- Upload Logic ---
  const uploadFiles = async (files: FileList) => {
    try {
      const convertedFiles = await Promise.all(
        Array.from(files).map((file) => new Promise<any>((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve({ name: file.name, base64Data: (e.target?.result as string).split(',')[1] });
          reader.readAsDataURL(file);
        }))
      );

      await fetch('/api/process-uploads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photos: convertedFiles, tripId: selectedTrip?.id || null })
      });
      await reloadData();
    } catch (err) { console.error("Upload error:", err); }
  };

  // --- Unified Management Logic ---
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
        body: JSON.stringify({ 
          action: 'SET_COVER', 
          tripId: extra?.tripId, 
          photoId: id 
        }) 
      });
    }
    await reloadData();
  };

  return (
    <div 
      className="flex w-screen h-screen bg-[#0a0c14] text-zinc-100 overflow-hidden font-sans"
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => { e.preventDefault(); setIsDragging(false); uploadFiles(e.dataTransfer.files); }}
      onClick={() => setContextMenu(null)}
    >
      {/* DRAG OVERLAY */}
      {isDragging && <div className="absolute inset-0 z-50 bg-amber-500/10 border-4 border-dashed border-amber-500 flex items-center justify-center pointer-events-none font-bold text-amber-500 tracking-widest text-xl">DROP TO UPLOAD</div>}

      {/* 1. LEFT SIDEBAR */}
      <nav className="w-64 border-r border-zinc-800/50 p-8 flex flex-col gap-12 z-20 bg-[#0a0c14]">
        <div className="flex items-center gap-3"><div className="p-2 bg-amber-400 rounded-full"><Compass className="text-zinc-950" size={20}/></div><h1 className="font-bold tracking-tight text-lg">Photo Diary</h1></div>
        <div className="flex flex-col gap-2">
          <button onClick={() => setView('map')} className={`flex items-center gap-4 px-4 py-3 rounded-xl ${view === 'map' ? 'bg-zinc-800' : 'text-zinc-500'}`}><MapIcon size={18} /> Map</button>
          <button onClick={() => setView('journeys')} className={`flex items-center gap-4 px-4 py-3 rounded-xl ${view === 'journeys' ? 'bg-zinc-800' : 'text-zinc-500'}`}><Compass size={18} /> Journeys</button>
        </div>
        {/* Upload Button at bottom of Sidebar */}
        <label className="cursor-pointer bg-amber-400 hover:bg-zinc-700 text-white p-4 rounded-2xl flex items-center justify-center gap-2 font-bold text-xs transition-all">
          <Plus size={16} /> UPLOAD PHOTOS
          <input type="file" multiple className="hidden" onChange={(e) => e.target.files && uploadFiles(e.target.files)} />
        </label>
      </nav>

      {/* 2. MAIN CONTENT AREA */}
      <main className="flex-1 overflow-y-auto relative">
        {view === 'map' ? (
          <CinematicMap 
            activeCoordinates={[49.8225, 19.0441]} 
            markers={trips} 
            onSelectTrip={handleMapTripSelect}
          />
        ) : selectedTrip ? (
          <div className="animate-in fade-in duration-500">
            <button onClick={() => setSelectedTripId(null)} className="absolute top-8 left-8 z-20 p-2 bg-zinc-900 rounded-full"><ChevronLeft /></button>
            <div className="h-[40vh] w-full relative bg-zinc-900 flex items-end p-12">
               <h2 className="text-6xl font-serif font-bold">{selectedTrip.name}</h2>
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
          <div className="p-12">
            <h2 className="text-3xl font-bold mb-4">Journeys</h2>
            <TripCards 
              trips={trips} 
              selectedTrip={selectedTrip}
              onSelectTrip={(trip) => setSelectedTripId(trip.id)}
              onContextMenu={(e: any, id: number, name: string) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, type: 'trip', id, extra: { currentName: name } }); }}
            />
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