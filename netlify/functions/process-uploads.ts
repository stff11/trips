import { Handler, HandlerEvent, HandlerResponse } from '@netlify/functions';
import Busboy from 'busboy';
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

// Helper: Sleep to respect API rate limits
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Robust coordinate conversion
function toDecimal(val: any): number | null {
  if (typeof val === 'number') return val;
  if (Array.isArray(val) && val.length >= 3) return Number(val[0]) + Number(val[1]) / 60 + Number(val[2]) / 3600;
  if (typeof val === 'string') return parseFloat(val);
  return null;
}

async function getLocationName(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=en-GB`, 
      { headers: { 'User-Agent': 'WanderlensJournal/1.0' } });
    const data = await res.json();
    const addr = data?.address;
    if (!addr) return 'Unrecognised Location';
    const place = addr.city ?? addr.town ?? addr.village ?? addr.state;
    return place ? `${place}, ${addr.country ?? ''}` : (addr.country ?? 'Historical Domain');
  } catch { return 'Unrecognised Location'; }
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Helper to wrap any async work with a timeout
const withTimeout = <T>(promise: Promise<T>, label: string): Promise<T> => {
  const TIME = 9000; // 9 seconds < Netlify's 10s limit
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`Timeout: ${label} took longer than 9 seconds`)), TIME)
  );
  return Promise.race([promise, timeout]);
};

export const handler: Handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  const body = event.isBase64Encoded 
    ? Buffer.from(event.body as string, 'base64') 
    : Buffer.from(event.body as string, 'binary');

  const busboy = Busboy({ headers: event.headers });

  return new Promise((resolve) => {
    let fileBuffer: Buffer | null = null;
    let fileName: string = '';
    let mimeType: string = '';

    busboy.on('file', (_fieldname, file, info) => {
      fileName = info.filename;
      mimeType = info.mimeType;
      const chunks: Buffer[] = [];
      file.on('data', (chunk) => chunks.push(chunk));
      file.on('end', () => { fileBuffer = Buffer.concat(chunks); });
    });

    busboy.on('finish', async () => {
      if (!fileBuffer) return resolve({ statusCode: 400, body: 'No file provided' });

      try {
        await withTimeout(
          (async () => {
        const fileHash = crypto.createHash('md5').update(fileBuffer).digest('hex');
        const existing = await db.select().from(photos).where(eq(photos.fileHash, fileHash));
        if (existing.length > 0) return resolve({ statusCode: 200, body: 'Duplicate' });

        const metadata = await exifr.parse(fileBuffer, { tiff: true, xmp: true, iptc: true, reviveValues: true }).catch(() => ({}));
        const lat = toDecimal(metadata?.GPSLatitude) ?? (typeof metadata?.latitude === 'number' ? metadata.latitude : null);
        const lng = toDecimal(metadata?.GPSLongitude) ?? (typeof metadata?.longitude === 'number' ? metadata.longitude : null);
        const takenAt = metadata?.DateTimeOriginal ? new Date(metadata.DateTimeOriginal) : new Date();

        const cloudinaryResult = await new Promise<any>((res, rej) => {
          cloudinary.uploader.upload_stream({ folder: 'wanderlens', transformation: [] }, (err, result) => err ? rej(err) : res(result)).end(fileBuffer);
        });

        const existingTrips = await db.select().from(trips).orderBy(asc(trips.startDate));
        let targetTripId: number | null = null;

        for (const trip of existingTrips) {
          if (!trip.centerLat || !trip.centerLng || lat === null || lng === null) continue;
          
          // Geography Check (100km radius)
          const distOk = haversineKm(lat, lng, Number(trip.centerLat), Number(trip.centerLng)) <= 100;
          
          // Time check (5 Day Gap Window)
          const tripStart = new Date(trip.startDate);
          const tripEnd = new Date(trip.endDate);
          
          // (5 days in milliseconds = 5 * 24 * 60 * 60 * 1000 = 432,000,000ms)
          const FIVE_DAYS_MS = 432000000;
          
          const isWithinTimeWindow = (takenAt.getTime() >= tripStart.getTime() - FIVE_DAYS_MS) && 
                                     (takenAt.getTime() <= tripEnd.getTime() + FIVE_DAYS_MS);
        
          if (distOk && isWithinTimeWindow) {
            targetTripId = trip.id;
            
            // Update the trip boundaries if this photo expands them
            const newStartDate = takenAt < tripStart ? takenAt : tripStart;
            const newEndDate = takenAt > tripEnd ? takenAt : tripEnd;
            
            await db.update(trips).set({ 
              startDate: newStartDate,
              endDate: newEndDate,
              photoCount: (trip.photoCount || 0) + 1 
            }).where(eq(trips.id, trip.id));
            
            break;
          }
        }

        if (!targetTripId) {
          await sleep(1100);
          const locationName = lat && lng ? await getLocationName(lat, lng) : 'Unknown Location';
          const [newTrip] = await db.insert(trips).values({
            name: `${locationName} (${takenAt.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })})`,
            startDate: takenAt, endDate: takenAt, locationName,
            centerLat: lat?.toString(), centerLng: lng?.toString(), photoCount: 1
          } as any).returning({ id: trips.id });
          targetTripId = newTrip.id;
        }

        const [newPhoto] = await db.insert(photos).values({
          tripId: targetTripId, fileHash, filename: fileName, originalName: fileName,
          cloudinaryUrl: cloudinaryResult.secure_url, cloudinaryPublicId: cloudinaryResult.public_id,
          mimeType, lat: lat?.toString(), lng: lng?.toString(), takenAt
        } as any).returning({ id: photos.id });
        if (newPhoto) {
          const [trip] = await db.select().from(trips).where(eq(trips.id, targetTripId!));
          if (trip && !trip.coverPhotoId) {
              await db.update(trips).set({ coverPhotoId: newPhoto.id }).where(eq(trips.id, targetTripId!));
          }
        }
      })(), 
      "File Processing"
      );

        resolve({ statusCode: 200, body: JSON.stringify({ success: true }) });
      } catch (err) {
        console.error("CRITICAL ERROR:", err);
        // If it's a timeout, return a specific status code
        const statusCode = (err as Error).message.includes('Timeout') ? 504 : 500;
        resolve({ statusCode, body: JSON.stringify({ error: (err as Error).message }) });
      }
    });

    busboy.write(body);
    busboy.end();
  });
};