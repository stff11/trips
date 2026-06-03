// File: /src/utils/photoUtils.ts
export const getOptimizedCloudinaryUrl = (url: string, width: number = 600) => {
    if (!url || typeof url !== 'string' || !url.includes('/upload/')) return url;
    const [baseUrl, path] = url.split('/upload/');
    return `${baseUrl}/upload/w_${width},c_fill,f_auto,q_auto/${path}`;
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