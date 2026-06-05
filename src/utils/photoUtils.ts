// File: /src/utils/photoUtils.ts

// Define a type for the width argument
type CloudinaryWidth = number | 'auto';
export const getOptimizedCloudinaryUrl = (url: string, width: CloudinaryWidth = 'auto') => {
    if (!url || typeof url !== 'string' || !url.includes('/upload/')) return url;
  
    // Split at /upload/
    const [baseUrl, path] = url.split('/upload/');
    
  // 1. Force the format to 'jpg' avoiding issues with HEIC
  // w_auto tells Cloudinary to detect container width
  // c_limit ensures we don't upscale beyond the image's original dimensions
  const w = width === 'auto' ? 'auto' : width;
  const transformations = `w_${w},c_limit,f_auto,q_auto,fl_lossy,f_jpg`;
  
  return `${baseUrl}/upload/${transformations}/${path}`;
};
  
export const getCoverUrl = (trip: any, width: number = 600) => {
    // 1. Fallback if no cover photo logic exists
    const fallback = '/assets/fallback-image.jpeg';
    if (!trip?.coverPhotoId) return fallback;
  
    // 2. If trips.photos is populated, find it
    if (Array.isArray(trip.photos)) {
      const coverPhoto = trip.photos.find((p: any) => p.id === trip.coverPhotoId);
      if (coverPhoto?.cloudinaryUrl) {
        return getOptimizedCloudinaryUrl(coverPhoto.cloudinaryUrl, width);
      }
    }
    return fallback;
 };