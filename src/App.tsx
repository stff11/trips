// 📁 File: /src/App.tsx
import { useState, useEffect } from 'react';
import CinematicMap from './components/CinematicMap';
import TripCards from './components/TripCards';
import PhotoGallery from './components/PhotoGallery';
import Lightbox from './components/Lightbox';
import { PhotoContextMenu } from './components/PhotoContextMenu';
import { Upload, Compass } from 'lucide-react';
import './index.css';

export default function App() {
  const [trips, setTrips] = useState<any[]>([]);
  const [selectedTrip, setSelectedTrip] = useState<any>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [contextMenu, setContextMenu] = useState<any>(null);
  const [lightbox, setLightbox] = useState<{ open: boolean; index: number; photos: any[] }>({ 
    open: false, index: 0, photos: [] 
  });

  const reloadData = async () => {
    try {
      const res = await fetch('/api/fetch-trips');
      if (res.ok) {
        const data = await res.json();
        setTrips(data);
        if (selectedTrip) {
          setSelectedTrip(data.find((t: any) => t.id === selectedTrip.id) || null);
        }
      }
    } catch (err) { console.error("Data fetch error:", err); }
  };

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
      if (type === 'trip') setSelectedTrip(null);
    } else if (action === 'edit') {
      const newName = window.prompt("Enter new title:", extra?.currentName);
      if (newName) {
        await fetch('/api/manage-trip', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'EDIT', tripId: id, newName }) });
      }
    }
    await reloadData();
  };

  return (
    <div 
      className="relative w-screen h-screen bg-zinc-950 text-zinc-100"
      onClick={() => setContextMenu(null)}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files) uploadFiles(e.dataTransfer.files); }}
    >
      {isDragging && <div className="absolute inset-0 z-[100] bg-amber-500/10 border-4 border-dashed border-amber-500 flex items-center justify-center pointer-events-none font-bold text-amber-500 tracking-widest text-xl">DROP TO UPLOAD</div>}
      
      <CinematicMap activeCoordinates={[49.8225, 19.0441]} markers={trips} />

      <div className="absolute inset-0 p-8 flex flex-col pointer-events-none z-10">
        <header className="flex items-center w-full pointer-events-auto justify-between mb-4">
          <div className="bg-zinc-950/70 p-4 rounded-2xl border border-zinc-800 flex items-center gap-3">
            <Compass className="text-amber-400" />
            <h1 className="font-black tracking-widest text-xs uppercase">WANDERLENS</h1>
          </div>
          <label className="cursor-pointer bg-amber-400 text-zinc-950 px-6 py-3 rounded-xl font-bold text-xs flex items-center gap-2 hover:bg-amber-300">
            <Upload size={14} /> UPLOAD
            <input type="file" multiple className="hidden" onChange={(e) => e.target.files && uploadFiles(e.target.files)} />
          </label>
        </header>

        <main className="flex gap-6 h-[70vh] pointer-events-auto">
          <section className="w-96">
            <TripCards 
              trips={trips} 
              selectedTrip={selectedTrip}
              onSelectTrip={(t: any) => setSelectedTrip(t)} 
              onContextMenu={(e: any, id: number, name: string) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, type: 'trip', id, extra: { currentName: name } }); }}
            />
          </section>

          {selectedTrip && (
            <section className="flex-1 h-full bg-zinc-950/80 backdrop-blur-2xl border border-zinc-800 rounded-3xl p-6">
              <PhotoGallery 
                photos={selectedTrip.photos || []} 
                onPhotoClick={(idx: number) => setLightbox({ open: true, index: idx, photos: selectedTrip.photos })}
                onContextMenu={(e: any, id: number, publicId: string) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, type: 'photo', id, extra: { publicId } }); }}
              />
            </section>
          )}
        </main>
      </div>

      {contextMenu && (
        <div className="fixed z-[9999]" style={{ top: contextMenu.y, left: contextMenu.x }} onClick={e => e.stopPropagation()}>
          <PhotoContextMenu 
            tripId={contextMenu.type === 'trip' ? contextMenu.id : selectedTrip?.id}
            photoId={contextMenu.type === 'photo' ? contextMenu.id : undefined}
            onDeleteTrip={(id) => handleAction('delete', 'trip', id)}
            onDeletePhoto={(id) => handleAction('delete', 'photo', id, contextMenu.extra)}
            onEditName={(id) => handleAction('edit', 'trip', id, contextMenu.extra)}
            onSetCover={(id) => handleAction('cover', 'photo', id)}
          />
        </div>
      )}

      {lightbox.open && (
        <Lightbox 
        photos={lightbox.photos} 
        activeIndex={lightbox.index} 
        onClose={() => setLightbox(p => ({ ...p, open: false }))}
        onPrev={() => setLightbox(p => ({ ...p, index: Math.max(0, p.index - 1) }))}
        onNext={() => setLightbox(p => ({ ...p, index: Math.min(p.photos.length - 1, p.index + 1) }))}
        />
      )}
    </div>
  );
}