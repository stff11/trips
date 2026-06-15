export interface Trip {
  id: number;
  name: string;
  locationName?: string;
  startDate?: string;
  endDate?: string;
  photoCount?: number;
  coverPhotoId?: number;
  centerLat?: number | undefined;
  centerLng?: number | undefined;
}

export interface Photo {
  id: number;
  tripId: number;
  filename: string;
  originalName: string;
  mimeType: string;
  fileHash?: string;
  cloudinaryPublicId: string;
  cloudinaryUrl: string;
  lat?: number | null;
  lng?: number | null;
  takenAt?: string | null;
  createdAt: string;
}

export interface TripWithPhotos extends Trip {
  photos: Photo[];
}
