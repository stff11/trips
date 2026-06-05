// File: /src/components/Lightbox.tsx
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { getOptimizedCloudinaryUrl } from '../utils/photoUtils'; 

export default function Lightbox({ photos, activeIndex, onClose, onPrev, onNext }: any) {
  const photo = photos[activeIndex];

  // Helper function to render media based on mimeType
  const renderMedia = (item: any) => {
    if (item.mimeType?.startsWith('video/')) {
      return (
        <video 
          src={item.cloudinaryUrl} 
          className="max-w-[100vw] max-h-[100vh] object-contain" 
          controls 
          autoPlay
        />
      );
    }
    return (
      <img 
      src={getOptimizedCloudinaryUrl(item.cloudinaryUrl, 'auto')} 
        className="max-w-[100vw] max-h-[100vh] object-contain" 
        alt="Full screen view"
      />
    );
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black flex items-center justify-center">
      <button onClick={onClose} className="absolute top-8 right-8 text-white/70 hover:text-white z-50"><X size={32} /></button>
      <button onClick={onPrev} className="absolute left-8 text-white/70 hover:text-white z-50"><ChevronLeft size={48} /></button>
      <button onClick={onNext} className="absolute right-8 text-white/70 hover:text-white z-50"><ChevronRight size={48} /></button>
      
      {/* Dynamic Render */}
      {renderMedia(photo)}
    </div>
  );
}