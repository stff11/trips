// 📁 File: /src/App.tsx
import { useState, useEffect } from 'react';
import CinematicMap from './components/CinematicMap';
import TripCards from './components/TripCards';
import PhotoGallery from './components/PhotoGallery';
import Lightbox from './components/Lightbox';
import FloatingTimeline from './components/FloatingTimeline';
import { Upload, Compass, Layers, CalendarRange, Sparkles, AlertCircle, Map as MapIcon } from 'lucide-react';
import './index.css';

// 🌟 Alias overrides to dynamically bypass restrictive property filters on sub-components
const DynamicTripCards = TripCards as any;
const DynamicPhotoGallery = PhotoGallery as any;

export default function App() {
  // --- Core Application States ---
  const [trips, setTrips] = useState<any[]>([]);
  const [selectedTrip, setSelectedTrip] = useState<any>(null);
  // Bielsko-Biała coordinates: 49.8225° N, 19.0441° E
  const [mapCenter, setMapCenter] = useState<[number, number]>([49.8225, 19.0441]);
  const [timelineYear, setTimelineYear] = useState<number>(2026);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const [lightbox, setLightbox] = useState<{ open: boolean; index: number; photos: any[] }>({ 
    open: false, 
    index: 0, 
    photos: [] 
  });

  // 🌟 State tracking contextual mouse interactions
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    targetId: number;
    type: 'trip' | 'photo';
    extraData?: any;
  } | null>(null);

  // --- Fetch API Synchronization Pipeline ---
  const reloadData = async () => {
    try {
      const res = await fetch('/api/fetch-trips');
      if (res.ok) {
        const data = await res.json();
        setTrips(data);
        
        // Auto-center the map to frame your most recent geographic pin location on load
        const validCoords = data.filter((t: any) => t.centerLat && t.centerLng);
        if (validCoords.length > 0 && !selectedTrip) {
          setMapCenter([parseFloat(validCoords[0].centerLat), parseFloat(validCoords[0].centerLng)]);
        }

        // Keep active gallery drawers synchronized on new background additions
        if (selectedTrip) {
          const updatedMatch = data.find((t: any) => t.id === selectedTrip.id);
          if (updatedMatch) setSelectedTrip(updatedMatch);
        }
      }
    } catch (err) {
      console.error("Error loading historical datasets:", err);
    }
  };

  useEffect(() => {
    void reloadData();
  }, []);

  // --- Right-Click Menu Trigger Event Hooks ---
  const handleRightClick = (e: React.MouseEvent, type: 'trip' | 'photo', targetId: number, extraData?: any) => {
    e.preventDefault(); // This kills the browser menu
    e.stopPropagation(); // This prevents the event from bubbling up to parent containers

    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      targetId,
      type,
      extraData
    });
  };

  // --- Management Mutation Calls ---
  const executeDelete = async () => {
    console.log("Attempting delete for:", contextMenu); // Check this log in console
    if (!contextMenu) return;
    const confirmBlock = window.confirm(`Are you sure you want to completely purge this ${contextMenu.type}?`);
    if (!confirmBlock) { setContextMenu(null); return; }

    try {
      if (contextMenu.type === 'photo') {
        await fetch('/api/delete-photo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            photoId: contextMenu.targetId, 
            cloudinaryPublicId: contextMenu.extraData?.publicId 
          })
        });
      } else {
        await fetch('/api/manage-trip', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'DELETE', tripId: contextMenu.targetId })
        });
        setSelectedTrip(null);
      }
      setContextMenu(null);
      await reloadData();
    } catch (err) {
      console.error("Purge Error Context:", err);
      alert("Purge sequence encountered a backend error.");
    }
  };

  const executeEditName = async () => {
    if (!contextMenu || contextMenu.type !== 'trip') return;
    const newTitle = window.prompt("Enter new custom location tag title:", contextMenu.extraData?.currentName);
    if (!newTitle) { setContextMenu(null); return; }

    try {
      await fetch('/api/manage-trip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'EDIT', tripId: contextMenu.targetId, newName: newTitle })
      });
      setContextMenu(null);
      await reloadData();
    } catch (err) {
      console.error("Modification Error Context:", err);
      alert("Modification update failed.");
    }
  };

  // Clear menus on standard background focus clicks
  useEffect(() => {
    const clearMenu = () => setContextMenu(null);
    window.addEventListener('click', clearMenu);
    return () => window.removeEventListener('click', clearMenu);
  }, []);

  const uploadFiles = async (files: FileList) => {
    setIsUploading(true);
    
    try {
      const convertedFiles: Array<{ name: string; type: string; size: number; base64Data: string }> = [];

      for (const file of Array.from(files)) {
        const base64String = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          
          reader.onload = () => {
            const resultString = reader.result as string;
            if (!resultString) {
              reject(new Error("Empty string returned from FileReader"));
              return;
            }
            const commaIndex = resultString.indexOf(',');
            const cleanBase64 = commaIndex !== -1 ? resultString.substring(commaIndex + 1) : resultString;
            resolve(cleanBase64);
          };
          
          reader.onerror = (error) => reject(error);
          reader.readAsDataURL(file);
        });

        convertedFiles.push({
          name: String(file.name),
          type: String(file.type),
          size: Number(file.size),
          base64Data: base64String
        });
      }

      console.log("Payload Array snapshot before network delivery:", convertedFiles);

      if (convertedFiles.length === 0) {
        throw new Error("No files were successfully processed into base64 data strings.");
      }

      const res = await fetch('/api/process-uploads', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photos: convertedFiles }) 
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || `Server responded with status code: ${res.status}`);
      }
      
      await reloadData();
    } catch (err) {
      console.error("Upload Execution Failure:", err);
      alert(`Upload Failed: ${(err as Error).message}`);
    } finally {
      setIsUploading(false);
    }
  };

  // --- Drop & Interaction Handlers ---
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) void uploadFiles(e.target.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.length) {
      void uploadFiles(e.dataTransfer.files);
    }
  };

  return (
    <div 
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="relative w-screen h-screen bg-zinc-950 text-zinc-100 font-sans overflow-hidden antialiased select-none"
    >
      {/* GEOSPATIAL MAP CANVAS BACKGROUND */}
      <CinematicMap activeCoordinates={mapCenter} markers={trips} />

      {/* Cinematic Vignette Overlays */}
      {/* <div className="absolute inset-0 pointer-events-none bg-gradient-to-r from-zinc-950/90 via-transparent to-zinc-950/40 z-0" />
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-zinc-950/50 via-transparent to-zinc-950/90 z-0" /> */}

      {/* Full Window Drop Zone Screen Curtain */}
      {isDragging && (
        <div className="absolute inset-0 bg-amber-400/10 backdrop-blur-md border-4 border-dashed border-amber-400 m-4 rounded-3xl z-50 flex items-center justify-center pointer-events-none transition-all duration-300 animate-pulse">
          <div className="bg-zinc-950/90 border border-zinc-800 px-8 py-6 rounded-2xl shadow-2xl flex flex-col items-center gap-3">
            <Upload className="text-amber-400" size={32} />
            <p className="text-sm font-bold tracking-wider text-zinc-100">DROP IMAGES TO RUN SPATIAL INGESTION</p>
          </div>
        </div>
      )}

      {/* GLASSMORPHIC HUD DASHBOARD OVERLAY */}
      <div className="absolute inset-0 p-6 md:p-8 flex flex-col justify-between pointer-events-none z-10">
        
        {/* --- TOP COMMAND BAR NAVIGATION --- */}
        <header className="flex justify-between items-center w-full pointer-events-auto">
          <div className="flex items-center gap-3.5 bg-zinc-950/70 backdrop-blur-xl border border-zinc-800/80 px-6 py-3 rounded-2xl shadow-2xl">
            <div className="relative flex items-center justify-center">
              <Compass className="text-amber-400 relative z-10 animate-[spin_20s_linear_infinite]" size={26} />
              <div className="absolute inset-0 bg-amber-400/20 blur-md rounded-full" />
            </div>
            <div>
              <h1 className="text-sm font-black tracking-[0.2em] text-zinc-100 uppercase">WANDERLENS</h1>
              <p className="text-[9px] tracking-widest text-zinc-400 font-bold uppercase flex items-center gap-1 mt-0.5">
                <Layers size={10} className="text-amber-400" /> Spatial Memory Core v1.0
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {selectedTrip && (
              <button 
                onClick={() => setSelectedTrip(null)}
                className="flex items-center gap-2 px-4 py-3 rounded-xl font-bold text-xs bg-zinc-900/80 border border-zinc-800 text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 transition-all pointer-events-auto shadow-md"
              >
                <MapIcon size={13} /> OVERVIEW MAP
              </button>
            )}

            <label className={`flex items-center gap-2.5 px-6 py-3.5 rounded-xl font-bold tracking-wide text-xs cursor-pointer transition-all duration-300 shadow-xl border pointer-events-auto ${
              isUploading 
                ? 'bg-zinc-900 border-zinc-800 text-zinc-500 cursor-wait' 
                : 'bg-amber-400 hover:bg-amber-300 border-amber-500/20 text-zinc-950 hover:scale-[1.02] active:scale-[0.98]'
            }`}>
              <Upload size={14} className={isUploading ? 'animate-bounce' : ''} />
              {isUploading ? 'UPLOADING...' : 'UPLOAD PHOTOS'}
              <input type="file" multiple accept=".heic,.jpg,.jpeg,.png" className="hidden" onChange={handleFileUpload} disabled={isUploading} />
            </label>
          </div>
        </header>

        {/* --- MAIN HUD WORKSPACE LAYOUT --- */}
        <main className="flex flex-col lg:flex-row justify-between items-stretch w-full h-[calc(100vh-12rem)] mb-12 gap-6 items-end">
          
          {/* LEFT SIDEBAR PANEL: Spatial Archives Directory */}
          <section className="w-full lg:w-96 flex flex-col pointer-events-auto max-h-full">
            <div className="mb-2 px-2 flex items-center justify-between text-zinc-400 uppercase tracking-widest font-bold text-[10px]">
              <span className="flex items-center gap-1.5"><CalendarRange size={11} /> Journal Collections</span>
              <span className="text-zinc-600 font-medium">{trips.length} Sequence Groups</span>
            </div>
            
            {trips.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center p-8 bg-zinc-950/40 backdrop-blur-xl border border-zinc-900 rounded-2xl h-48">
                <AlertCircle size={24} className="text-zinc-600 mb-2" />
                <p className="text-xs text-zinc-400 font-medium">No spatial trails processed.</p>
                <p className="text-[10px] text-zinc-500 mt-1">Drop raw capture files onto the canvas to construct your first timeline container.</p>
              </div>
            ) : (
              <DynamicTripCards 
                trips={trips} 
                selectedTrip={selectedTrip}
                onSelectTrip={(trip: any) => {
                  setSelectedTrip(trip);
                  if (trip.centerLat && trip.centerLng) {
                    setMapCenter([parseFloat(trip.centerLat), parseFloat(trip.centerLng)]);
                  }
                }} 
                onContextMenu={(e: any, id: number, currentName: string) => handleRightClick(e, 'trip', id, { currentName })}
              />
            )}
          </section>

          {/* RIGHT SIDEBAR PANEL: Expanded Cinematic Photo Asset Tray */}
          <section className="flex-1 w-full max-w-5xl h-full flex flex-col pointer-events-auto justify-end">
            {selectedTrip ? (
              <div className="bg-zinc-950/60 backdrop-blur-2xl border border-zinc-800/80 rounded-3xl p-5 md:p-6 shadow-2xl flex flex-col max-h-full overflow-hidden animate-fade-in">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 border-b border-zinc-800/60 pb-3">
                  <div>
                    <h2 className="text-sm font-bold tracking-wide text-zinc-100 uppercase">{selectedTrip.name}</h2>
                    <p className="text-[10px] text-zinc-400 mt-0.5 tracking-wider">{selectedTrip.locationName || 'Historical Sequence'}</p>
                  </div>
                  <div className="text-[10px] uppercase font-mono tracking-wider bg-zinc-900/80 px-3 py-1.5 rounded-md border border-zinc-800 text-zinc-400 flex items-center gap-1.5 self-start sm:self-auto">
                    <Sparkles size={11} className="text-amber-400" /> {selectedTrip.photos?.length || 0} Photos
                  </div>
                </div>
                
                <div className="flex-1 overflow-y-auto no-scrollbar rounded-xl">
                <DynamicPhotoGallery 
                  photos={selectedTrip.photos || []} 
                  onPhotoClick={(idx: number) => setLightbox({ open: true, index: idx, photos: selectedTrip.photos })}
                  onContextMenu={(e: any, id: number, publicId: string) => handleRightClick(e, 'photo', id, { publicId })}
                />
                </div>
              </div>
            ) : (
              <div className="hidden lg:flex items-center gap-3 p-6 bg-zinc-950/40 backdrop-blur-xl border border-zinc-800/40 rounded-2xl max-w-md border-dashed self-end mb-4">
                <Compass className="text-amber-400/40 animate-pulse" size={18} />
                <p className="text-[11px] text-zinc-500 font-medium tracking-wide">Select a historical timeline grouping cluster to access its spatial archive gallery.</p>
              </div>
            )}
          </section>
        </main>
      </div>

      {/* BASE CHRONOLOGY TIME CONTROLLER DOCK */}
      <FloatingTimeline activeYear={timelineYear} onYearChange={(y) => setTimelineYear(y)} />

      {/* 🌟 FLOATING CUSTOM MANAGEMENT OVERLAY CONTEXT MENU */}
      {contextMenu && (
        <div 
          className="fixed z-[9999] bg-zinc-950 border border-zinc-800 text-zinc-300 text-xs rounded-lg shadow-2xl py-1 w-36 font-mono border-dashed pointer-events-auto"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          {contextMenu.type === 'trip' && (
            <button onClick={executeEditName} className="w-full text-left px-3 py-2 hover:bg-zinc-900 hover:text-amber-400 block transition-colors">
              ✏️ EDIT TITLE
            </button>
          )}
          <button onClick={executeDelete} className="w-full text-left px-3 py-2 hover:bg-red-950/40 hover:text-red-400 border-t border-zinc-900 block transition-colors">
            🗑️ DELETE ASSET
          </button>
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






// // 📁 File: /src/App.tsx
// import { useState, useEffect } from 'react';
// import CinematicMap from './components/CinematicMap';
// import TripCards from './components/TripCards';
// import PhotoGallery from './components/PhotoGallery';
// import Lightbox from './components/Lightbox';
// import { Upload } from 'lucide-react';

// const DynamicTripCards = TripCards as any;
// const DynamicPhotoGallery = PhotoGallery as any;

// export default function App() {
//   const [trips, setTrips] = useState<any[]>([]);
//   const [selectedTrip, setSelectedTrip] = useState<any>(null);
//   const [viewMode, setViewMode] = useState<'map' | 'gallery'>('map');
//   const [lightbox, setLightbox] = useState<{ open: boolean; index: number }>({ open: false, index: 0 });
//   const [contextMenu, setContextMenu] = useState<any>(null);
//   const [isDragging, setIsDragging] = useState(false);
//   const [status, setStatus] = useState<string | null>(null);

//   const showStatus = (msg: string) => {
//     setStatus(msg);
//     setTimeout(() => setStatus(null), 3000);
//   };

//   const reloadData = async () => {
//     try {
//       const res = await fetch('/api/fetch-trips');
//       if (res.ok) setTrips(await res.json());
//     } catch (err) { console.error("Data fetch error:", err); }
//   };

//   useEffect(() => { void reloadData(); }, []);

//   useEffect(() => {
//     if (selectedTrip) window.scrollTo({ top: 0, behavior: 'smooth' });
//   }, [selectedTrip]);

//   const handleRightClick = (e: React.MouseEvent, type: 'trip' | 'photo', targetId: number, extraData?: any) => {
//     e.preventDefault();
//     setContextMenu({ x: e.clientX, y: e.clientY, targetId, type, extraData });
//   };

//   const uploadFiles = async (files: FileList) => {
//     setIsDragging(false);
//     showStatus("Uploading assets...");
    
//     try {
//       const convertedFiles = await Promise.all(
//         Array.from(files).map((file) => new Promise<any>((resolve) => {
//           const reader = new FileReader();
//           reader.onload = (e) => resolve({
//             name: file.name,
//             base64Data: (e.target?.result as string).split(',')[1]
//           });
//           reader.readAsDataURL(file);
//         }))
//       );

//       const res = await fetch('/api/process-uploads', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({ 
//           photos: convertedFiles,
//           tripId: selectedTrip?.id || null 
//         })
//       });

//       if (res.ok) {
//         showStatus("Upload successful!");
//         await reloadData();
//       } else {
//         throw new Error("Upload failed");
//       }
//     } catch (err) {
//       console.error("Upload error:", err);
//       showStatus("Upload failed!");
//     }
//   };

//   const executeDelete = async () => {
//     if (!contextMenu) return;
//     const isPhoto = contextMenu.type === 'photo';
//     const endpoint = isPhoto ? '/api/delete-photo' : '/api/manage-trip';
//     const body = isPhoto 
//       ? { photoId: contextMenu.targetId, cloudinaryPublicId: contextMenu.extraData?.publicId } 
//       : { action: 'DELETE', tripId: contextMenu.targetId };
    
//     await fetch(endpoint, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body) });
//     setContextMenu(null);
//     if (!isPhoto) setSelectedTrip(null);
//     await reloadData();
//   };

//   return (
//     <div 
//       className="relative w-screen min-h-screen bg-zinc-950 text-zinc-100 overflow-x-hidden"
//       onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
//       onDragLeave={() => setIsDragging(false)}
//       onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files) uploadFiles(e.dataTransfer.files); }}
//       onClick={() => setContextMenu(null)}
//     >
//       {isDragging && <div className="fixed inset-0 z-[9999] bg-amber-500/20 border-4 border-dashed border-amber-500 flex items-center justify-center pointer-events-none text-xl font-bold">DROP TO UPLOAD</div>}
//       {status && <div className="fixed bottom-8 left-8 z-[9999] bg-zinc-900 border border-amber-500 text-amber-500 px-6 py-3 rounded-full text-xs font-bold shadow-xl">{status}</div>}
      
//       <CinematicMap activeCoordinates={[49.8225, 19.0441]} markers={trips} />

//       <header className="absolute top-6 left-6 right-6 z-20 flex justify-between items-center pointer-events-none">
//         <h1 className="text-sm font-black tracking-[0.2em] uppercase bg-zinc-950/70 p-4 rounded-2xl border border-zinc-800 pointer-events-auto">WANDERLENS</h1>
//         <div className="flex gap-4 pointer-events-auto">
//           <button onClick={() => setViewMode(v => v === 'map' ? 'gallery' : 'map')} className="px-6 py-3 rounded-xl text-xs font-bold bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 transition-colors">
//             {viewMode === 'map' ? 'VIEW ALBUMS' : 'VIEW MAP'}
//           </button>
//           <label className="px-6 py-3 rounded-xl text-xs font-bold bg-amber-400 text-zinc-950 cursor-pointer flex items-center gap-2 hover:bg-amber-300 transition-colors">
//             <Upload size={14} /> UPLOAD
//             <input type="file" multiple className="hidden" onChange={(e) => e.target.files && uploadFiles(e.target.files)} />
//           </label>
//         </div>
//       </header>

//       <main className="relative z-10 pt-24 pb-12 px-6">
//         {viewMode === 'gallery' ? (
//           <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
//             <DynamicTripCards trips={trips} onSelectTrip={(t: any) => { setSelectedTrip(t); setViewMode('map'); }} onContextMenu={handleRightClick} />
//           </div>
//         ) : selectedTrip && (
//           <div className="bg-zinc-950/90 border border-zinc-800 rounded-3xl p-8 shadow-2xl">
//             <div className="flex justify-between items-center mb-6">
//               <h2 className="text-2xl font-bold uppercase tracking-widest">{selectedTrip.name}</h2>
//               <button onClick={() => setSelectedTrip(null)} className="p-2 hover:bg-zinc-800 rounded-full">✕</button>
//             </div>
//             <DynamicPhotoGallery photos={selectedTrip.photos || []} onPhotoClick={(idx: number) => setLightbox({ open: true, index: idx })} onContextMenu={handleRightClick} />
//           </div>
//         )}
//       </main>

//       {lightbox.open && selectedTrip && (
//         <Lightbox photos={selectedTrip.photos} activeIndex={lightbox.index} onClose={() => setLightbox(p => ({...p, open: false}))} onPrev={() => setLightbox(p => ({...p, index: Math.max(0, p.index - 1)}))} onNext={() => setLightbox(p => ({...p, index: Math.min(selectedTrip.photos.length - 1, p.index + 1)}))} />
//       )}

//       {contextMenu && (
//         <div className="fixed z-[9999] bg-zinc-950 border border-zinc-800 text-xs rounded-lg py-1 w-32 shadow-2xl" style={{ top: contextMenu.y, left: contextMenu.x }}>
//           <button onClick={executeDelete} className="w-full text-left px-3 py-2 text-red-400 hover:bg-zinc-900">🗑️ DELETE</button>
//         </div>
//       )}
//     </div>
//   );
// }