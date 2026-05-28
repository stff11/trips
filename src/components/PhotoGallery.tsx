// // 📁 File: /src/components/PhotoGallery.tsx
// import { useState } from 'react';
// import { Camera, X, Calendar, Maximize2 } from 'lucide-react';

// export default function PhotoGallery({ photos }: { photos: any[] }) {
//   const [activeLightboxMedia, setActiveLightboxMedia] = useState<any | null>(null);

//   if (!photos || photos.length === 0) {
//     return (
//       <div className="flex flex-col items-center justify-center h-48 border border-dashed border-zinc-800 rounded-2xl text-zinc-500">
//         <p className="text-xs font-medium">No media assets mapped to this cluster sequence.</p>
//       </div>
//     );
//   }

//   return (
//     <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 p-1">
//       {photos.map((photo) => (
//         <div 
//           key={photo.id} 
//           onClick={() => setActiveLightboxMedia(photo)}
//           className="group relative aspect-square bg-zinc-900 rounded-xl overflow-hidden border border-zinc-800/50 shadow-md hover:scale-[1.02] hover:border-amber-400/30 transition-all duration-300 cursor-zoom-in"
//         >
//           <img 
//             src={photo.cloudinaryUrl || photo.filePath} 
//             alt={photo.originalName} 
//             className="w-full h-full object-cover grayscale-[10%] group-hover:grayscale-0 transition-all duration-500"
//             loading="lazy"
//           />
          
//           <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 p-3 flex flex-col justify-end pointer-events-none">
//             <p className="text-[10px] font-bold text-zinc-100 truncate uppercase tracking-wider flex items-center justify-between">
//               {photo.originalName}
//               <Maximize2 size={10} className="text-amber-400" />
//             </p>
//           </div>
//         </div>
//       ))}

//       {/* 🌟 THE FULL SIZE LIGHTBOX OVERLAY MODAL WINDOW */}
//       {activeLightboxMedia && (
//         <div 
//           className="fixed inset-0 bg-zinc-950/95 backdrop-blur-xl z-50 flex items-center justify-center p-4 md:p-12 animate-fade-in"
//           onClick={() => setActiveLightboxMedia(null)}
//         >
//           {/* Close Action Trigger */}
//           <button 
//             className="absolute top-6 right-6 p-3 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-all shadow-2xl"
//             onClick={() => setActiveLightboxMedia(null)}
//           >
//             <X size={18} />
//           </button>

//           <div 
//             className="max-w-5xl max-h-[85vh] flex flex-col md:flex-row bg-zinc-900/40 border border-zinc-800/80 rounded-3xl overflow-hidden shadow-2xl"
//             onClick={(e) => e.stopPropagation()} // Stop click propagation from closing the lightbox window
//           >
//             {/* Primary High-Fidelity Asset View */}
//             <div className="flex-1 bg-black/40 flex items-center justify-center overflow-hidden max-h-[60vh] md:max-h-full">
//               <img 
//                 src={activeLightboxMedia.cloudinaryUrl || activeLightboxMedia.filePath} 
//                 alt={activeLightboxMedia.originalName}
//                 className="w-full h-full object-contain max-h-[60vh] md:max-h-[80vh]" 
//               />
//             </div>

//             {/* Side Asset Data Dashboard Panel */}
//             <div className="w-full md:w-80 p-6 border-t md:border-t-0 md:border-l border-zinc-800/80 bg-zinc-950/60 backdrop-blur-md flex flex-col justify-between gap-6">
//               <div>
//                 <span className="text-[9px] uppercase tracking-widest font-black text-amber-400">Media Spec Matrix</span>
//                 <h3 className="text-sm font-bold text-zinc-100 tracking-wide mt-1 truncate uppercase" title={activeLightboxMedia.originalName}>
//                   {activeLightboxMedia.originalName}
//                 </h3>
                
//                 <div className="mt-4 space-y-3.5">
//                   {activeLightboxMedia.takenAt && (
//                     <div className="flex items-center gap-2.5 text-xs text-zinc-300">
//                       <Calendar size={14} className="text-zinc-500" />
//                       <div>
//                         <p className="text-[10px] uppercase font-bold tracking-wider text-zinc-500">Capture Timeline</p>
//                         <p className="mt-0.5">{new Date(activeLightboxMedia.takenAt).toLocaleString()}</p>
//                       </div>
//                     </div>
//                   )}

//                   {activeLightboxMedia.altitude && (
//                     <div className="flex items-center gap-2.5 text-xs text-zinc-300">
//                       <Camera size={14} className="text-zinc-500" />
//                       <div>
//                         <p className="text-[10px] uppercase font-bold tracking-wider text-zinc-500">Spatial Telemetry</p>
//                         <p className="mt-0.5 font-mono text-amber-400">ALT: {Math.round(activeLightboxMedia.altitude)} meters</p>
//                       </div>
//                     </div>
//                   )}
//                 </div>
//               </div>

//               <div className="text-[9px] font-mono text-zinc-600 border-t border-zinc-900 pt-4 uppercase tracking-widest">
//                 ID Reference: #{activeLightboxMedia.id}
//               </div>
//             </div>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }


// 📁 File: /src/components/PhotoGallery.tsx
import { Maximize2 } from 'lucide-react';

export default function PhotoGallery({ photos, onPhotoClick, onContextMenu }: any) {
  if (!photos || photos.length === 0) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {photos.map((photo: any, index: number) => (
        <div 
          key={photo.id} 
          onClick={() => onPhotoClick(index)}
          onContextMenu={(e) => onContextMenu(e, photo.id, photo.cloudinaryPublicId)}
          className="group relative aspect-square bg-zinc-900 rounded-xl overflow-hidden cursor-pointer"
        >
          <img 
            src={photo.cloudinaryUrl || photo.filePath} 
            className="w-full h-full object-cover group-hover:scale-105 transition-transform" 
          />
          {/* Overlay to trigger the context menu visual */}
          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <Maximize2 className="text-white drop-shadow-md" size={24} />
          </div>
        </div>
      ))}
    </div>
  );
}