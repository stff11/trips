export interface Trip {
  id: number;
  name: string;
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
