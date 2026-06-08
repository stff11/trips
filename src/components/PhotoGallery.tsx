import { Maximize2 } from 'lucide-react';
import { getOptimizedCloudinaryUrl } from '../utils/photoUtils'; 

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
            src={getOptimizedCloudinaryUrl(photo.cloudinaryUrl, 'auto')} 
            className="w-full h-full object-cover group-hover:scale-105 transition-transform" 
            alt="Trip photo"
          />
          
          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <Maximize2 className="text-white drop-shadow-md" size={24} />
          </div>
        </div>
      ))}
    </div>
  );
}