// // 📁 src/components/Lightbox.tsx
// export default function Lightbox({ photos, activeIndex, onClose, onPrev, onNext }: any) {
//     return (
//       <div className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center">
//         <button onClick={onClose} className="absolute top-8 right-8 text-white text-2xl">✕</button>
//         <button onClick={onPrev} className="absolute left-8 text-white text-4xl">←</button>
//         <img src={photos[activeIndex].filePath} className="max-h-[90vh] max-w-[90vw] object-contain" />
//         <button onClick={onNext} className="absolute right-8 text-white text-4xl">→</button>
//       </div>
//     );
//   }




// 📁 File: /src/components/Lightbox.tsx
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

export default function Lightbox({ photos, activeIndex, onClose, onPrev, onNext }: any) {
  const photo = photos[activeIndex];
  return (
    <div className="fixed inset-0 z-[9999] bg-black flex items-center justify-center">
      <button onClick={onClose} className="absolute top-8 right-8 text-white/70 hover:text-white z-50"><X size={32} /></button>
      <button onClick={onPrev} className="absolute left-8 text-white/70 hover:text-white z-50"><ChevronLeft size={48} /></button>
      <button onClick={onNext} className="absolute right-8 text-white/70 hover:text-white z-50"><ChevronRight size={48} /></button>
      
      <img 
        src={photo.cloudinaryUrl || photo.filePath} 
        className="max-w-[100vw] max-h-[100vh] object-contain" 
        alt="Full screen view"
      />
    </div>
  );
}