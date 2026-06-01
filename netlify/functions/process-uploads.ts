// // 📁 File: /netlify/functions/process-uploads.ts
import { Handler } from '@netlify/functions';
import { v2 as cloudinary } from 'cloudinary';
import exifr from 'exifr';
import { eq, asc } from 'drizzle-orm';
import { db } from '../../src/db'; 
import { photos, trips } from '../../src/db/schema';
import crypto from 'crypto';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Robust coordinate conversion
function toDecimal(val: any): number | null {
  if (typeof val === 'number') return val;
  if (Array.isArray(val) && val.length >= 3) return val[0] + val[1] / 60 + val[2] / 3600;
  return null;
}

// Logic from your proven tripGrouping.ts
// 1. Updated Geocoding with GB localization
async function getLocationName(lat: number, lng: number): Promise<string> {
  try {
    // Added 'accept-language=en-GB'
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=10&accept-language=en-GB`;
    const res = await fetch(url, { headers: { 'User-Agent': 'WanderlensJournal/1.0' } });
    if (!res.ok) return 'Spatial Sequence';
    
    const data: any = await res.json();
    const addr = data?.address;
    if (!addr) return 'Spatial Sequence';

    const place = addr.city ?? addr.town ?? addr.village ?? addr.county ?? addr.state;
    const country = addr.country;
    
    return place && country ? `${place}, ${country}` : (country ?? 'Spatial Sequence');
  } catch { return 'Spatial Sequence'; }
}

// 2. Helper to format Title: "City, Country (Month YYYY)"
function formatTripTitle(locationName: string, date: Date): string {
  const monthYear = date.toLocaleString('en-GB', { month: 'long', year: 'numeric' });
  return `${locationName} (${monthYear})`;
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  try {
    const { photos: incomingPhotos } = JSON.parse(event.body || '{}');
    
    for (const item of incomingPhotos) {
      const buffer = Buffer.from(item.base64Data, 'base64');
      // Generate the fingerprint
      const fileHash = crypto.createHash('md5').update(buffer).digest('hex');

      // Check if it already exists
      const existing = await db.select().from(photos).where(eq(photos.fileHash, fileHash));
      if (existing.length > 0) {
        console.log(`Skipping duplicate: ${item.name}`);
        continue; // Skip this photo as duplicate
      }

      const metadata = await exifr.parse(buffer, ['GPSLatitude', 'GPSLongitude', 'DateTimeOriginal']).catch(() => ({}));
      
      const cloudinaryResult = await new Promise<any>((resolve, reject) => {
        cloudinary.uploader.upload_stream({ folder: 'wanderlens' }, (err, res) => err ? reject(err) : resolve(res)).end(buffer);
      });

      const lat = toDecimal(metadata.GPSLatitude);
      const lng = toDecimal(metadata.GPSLongitude);
      const takenAt = metadata.DateTimeOriginal ? new Date(metadata.DateTimeOriginal) : new Date();

const existingTrips = await db.select().from(trips).orderBy(asc(trips.startDate));
let targetTripId: number | null = null;

for (const trip of existingTrips) {
  if (!trip.centerLat || !trip.centerLng || lat === null || lng === null) continue;
  
  const distOk = haversineKm(lat, lng, Number(trip.centerLat), Number(trip.centerLng)) <= 100;
  
  // Logic Fix: Check if the photo falls within a 5-day proximity of the ENTIRE duration, 
  // not just the startDate.
  const tripStart = new Date(trip.startDate);
  const tripEnd = new Date(trip.endDate);
  const isWithinTimeWindow = (takenAt.getTime() >= tripStart.getTime() - 5 * 86400000) && 
                             (takenAt.getTime() <= tripEnd.getTime() + 5 * 86400000);

  if (distOk && isWithinTimeWindow) {
    targetTripId = trip.id;
    
    // Update boundaries
    const newStartDate = takenAt < tripStart ? takenAt : tripStart;
    const newEndDate = takenAt > tripEnd ? takenAt : tripEnd;
    
    await db.update(trips).set({ 
      startDate: newStartDate,
      endDate: newEndDate,
      photoCount: trip.photoCount + 1 
    }).where(eq(trips.id, trip.id));
    
    break;
  }
}

      // 2. Create new trip if no match
      if (!targetTripId) {
        const locationName = lat && lng ? await getLocationName(lat, lng) : 'Historical Domain';
        const tripName = formatTripTitle(locationName, takenAt);
        
        const [newTrip] = await db.insert(trips).values({
          name: tripName,
          startDate: takenAt,
          endDate: takenAt,
          locationName,
          centerLat: lat?.toString(),
          centerLng: lng?.toString(),
          photoCount: 1
        } as any).returning({ id: trips.id });
        targetTripId = newTrip.id;
      }

      // 3. Insert Photo
      const [newPhoto] = await db.insert(photos).values({
        tripId: targetTripId,
        fileHash: fileHash,
        filename: item.name,
        originalName: item.name,
        filePath: cloudinaryResult.secure_url,
        cloudinaryUrl: cloudinaryResult.secure_url,
        cloudinaryPublicId: cloudinaryResult.public_id,
        mimeType: item.type || 'image/jpeg',
        lat: lat?.toString(),
        lng: lng?.toString(),
        takenAt: takenAt
      } as any).returning({ id: photos.id });

      // 4. Set cover if this is the first photo
      const [trip] = await db.select().from(trips).where(eq(trips.id, targetTripId));
      if (!trip.coverPhotoId) {
        await db.update(trips).set({ coverPhotoId: newPhoto.id }).where(eq(trips.id, targetTripId));
      }
    }

    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  } catch (err) {
    console.error("CRITICAL DATABASE FAILURE:", err);
    return { statusCode: 500, body: JSON.stringify({ error: (err as Error).message }) };
  }
};