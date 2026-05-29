// // 📁 File: /netlify/functions/process-uploads.ts
// import { Handler } from '@netlify/functions';
// import { v2 as cloudinary } from 'cloudinary';
// import exifr from 'exifr';
// import { eq } from 'drizzle-orm';

// // @ts-ignore
// import { db } from '../../src/db'; 
// // @ts-ignore
// import { photos, trips } from '../../src/db/schema';

// cloudinary.config({
//   cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
//   api_key: process.env.CLOUDINARY_API_KEY,
//   api_secret: process.env.CLOUDINARY_API_SECRET,
// });

// function getDistanceKM(lat1: number, lon1: number, lat2: number, lon2: number): number {
//   const R = 6371; 
//   const dLat = (lat2 - lat1) * Math.PI / 180;
//   const dLon = (lon2 - lon1) * Math.PI / 180;
//   const a = 
//     Math.sin(dLat / 2) * Math.sin(dLat / 2) +
//     Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
//   const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
//   return R * c;
// }

// // Helper to look up Country and City via reverse geocoding
// async function getLocationName(lat: number, lng: number): Promise<string> {
//   try {
//     const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10&addressdetails=1`;
//     const res = await fetch(url, { headers: { 'User-Agent': 'WanderlensJournal/1.0' } });
//     if (!res.ok) return 'Spatial Sequence';
    
//     const data: any = await res.json();
//     if (!data || !data.address) return 'Spatial Sequence';

//     const city = data.address.city || data.address.town || data.address.village || data.address.suburb;
//     const country = data.address.country;

//     if (city && country) return `${city}, ${country}`;
//     if (country) return country;
//     return 'Spatial Sequence';
//   } catch (err) {
//     console.error("Geocoding Error:", err);
//     return 'Spatial Sequence';
//   }
// }

// export const handler: Handler = async (event) => {
//   if (event.httpMethod !== 'POST') {
//     return { statusCode: 405, body: 'Method Not Allowed' };
//   }

//   try {
//     const payload = JSON.parse(event.body || '{}');
//     const incomingPhotos = payload.photos || [];

//     if (!incomingPhotos || incomingPhotos.length === 0) {
//       return { statusCode: 400, body: 'No assets delivered in JSON payload matrix' };
//     }

//     const uploadedRecords: any[] = [];

//     for (const item of incomingPhotos) {
//       const name = item.name || 'unnamed_artifact.jpg';
//       const dataString = item.base64Data || '';
//       const mimeType = item.type || 'image/jpeg';
//       const fileSize = item.size || 0;

//       if (!dataString) continue;

//       const imageBuffer = Buffer.from(dataString, 'base64');
      
//       let detectedLat: number | null = null;
//       let detectedLng: number | null = null;
//       let captureTimestamp = new Date();
//       let computedAltitude: number | null = null;

//       try {
//         const metadata = await exifr.parse(imageBuffer, ['GPSLatitude', 'GPSLongitude', 'DateTimeOriginal', 'GPSAltitude']);
//         if (metadata) {
//           if (typeof metadata.GPSLatitude === 'number') detectedLat = metadata.GPSLatitude;
//           if (typeof metadata.GPSLongitude === 'number') detectedLng = metadata.GPSLongitude;
//           if (metadata.DateTimeOriginal) captureTimestamp = new Date(metadata.DateTimeOriginal);
//           if (typeof metadata.GPSAltitude === 'number') computedAltitude = metadata.GPSAltitude;
//         }
//       } catch (exifErr) {
//         console.warn(`Skipped EXIF parsing for: ${name}`);
//       }

//       const cloudinaryResult = await new Promise<any>((resolve, reject) => {
//         cloudinary.uploader.upload_stream(
//           { folder: 'wanderlens', resource_type: 'image' },
//           (error, result) => error ? reject(error) : resolve(result)
//         ).end(imageBuffer);
//       });

//       uploadedRecords.push({
//         name,
//         url: cloudinaryResult.secure_url,
//         publicId: cloudinaryResult.public_id,
//         mimeType,
//         fileSize: fileSize || imageBuffer.length,
//         lat: detectedLat,
//         lng: detectedLng,
//         takenAt: captureTimestamp,
//         alt: computedAltitude
//       });
//     }

//     uploadedRecords.sort((a, b) => a.takenAt.getTime() - b.takenAt.getTime());

//     let currentTripId: number | null = null;
//     let anchorPhoto: any = null;

//     for (const photo of uploadedRecords) {
//       let createNewTrip = false;

//       if (!anchorPhoto) {
//         createNewTrip = true;
//       } else {
//         const daysApart = (photo.takenAt.getTime() - anchorPhoto.takenAt.getTime()) / (1000 * 60 * 60 * 24);
//         if (daysApart > 5) createNewTrip = true;

//         if (photo.lat !== null && photo.lng !== null && anchorPhoto.lat !== null && anchorPhoto.lng !== null) {
//           const distance = getDistanceKM(photo.lat, photo.lng, anchorPhoto.lat, anchorPhoto.lng);
//           if (distance > 100) createNewTrip = true;
//         }
//       }

//       if (createNewTrip) {
//         anchorPhoto = photo;
        
//         // 🌟 Determine location name via coordinates or fallback to domain text
//         let locationLabel = 'Historical Domain';
//         if (photo.lat !== null && photo.lng !== null) {
//           locationLabel = await getLocationName(photo.lat, photo.lng);
//         }

//         const tripPayload = {
//           name: locationLabel, // 🌟 Sets title directly to "City, Country"
//           startDate: photo.takenAt,
//           endDate: photo.takenAt,
//           locationName: locationLabel,
//           centerLat: photo.lat !== null ? photo.lat.toString() : null,
//           centerLng: photo.lng !== null ? photo.lng.toString() : null,
//           photoCount: 1
//         };

//         const [newTrip] = await db.insert(trips).values(tripPayload).returning({ id: trips.id });
//         currentTripId = newTrip.id;
//       } else {
//         await db.update(trips)
//           .set({ endDate: photo.takenAt })
//           .where(eq(trips.id, currentTripId as number));
//       }

//       const photoPayload = {
//         tripId: currentTripId,
//         filename: photo.name,
//         originalName: photo.name,
//         filePath: photo.url,
//         cloudinaryUrl: photo.url,
//         cloudinaryPublicId: photo.publicId,
//         mimeType: photo.mimeType,
//         fileSize: photo.fileSize,
//         lat: photo.lat !== null ? photo.lat.toString() : null,
//         lng: photo.lng !== null ? photo.lng.toString() : null,
//         altitude: photo.alt !== null ? photo.alt.toString() : null,
//         takenAt: photo.takenAt,
//       };

//       await db.insert(photos).values(photoPayload);
//     }

//     return {
//       statusCode: 200,
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify({ success: true, processed: uploadedRecords.length }),
//     };

//   } catch (err) {
//     console.error("Critical Function Error Context:", err);
//     return { statusCode: 500, body: `Server Core Failure: ${(err as Error).message}` };
//   }
// };




import { Handler } from '@netlify/functions';
import { v2 as cloudinary } from 'cloudinary';
import exifr from 'exifr';
import { eq, asc } from 'drizzle-orm';
import { db } from '../../src/db'; 
import { photos, trips } from '../../src/db/schema';

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
      const metadata = await exifr.parse(buffer, ['GPSLatitude', 'GPSLongitude', 'DateTimeOriginal']).catch(() => ({}));
      
      const cloudinaryResult = await new Promise<any>((resolve, reject) => {
        cloudinary.uploader.upload_stream({ folder: 'wanderlens' }, (err, res) => err ? reject(err) : resolve(res)).end(buffer);
      });

      const lat = toDecimal(metadata.GPSLatitude);
      const lng = toDecimal(metadata.GPSLongitude);
      const takenAt = metadata.DateTimeOriginal ? new Date(metadata.DateTimeOriginal) : new Date();

      // 1. Find existing trip using the logic from tripGrouping.ts
      const existingTrips = await db.select().from(trips).orderBy(asc(trips.startDate));
      let targetTripId: number | null = null;

      for (const trip of existingTrips) {
        if (!trip.centerLat || !trip.centerLng || lat === null || lng === null) continue;
        const distOk = haversineKm(lat, lng, Number(trip.centerLat), Number(trip.centerLng)) <= 100;
        const timeOk = (Math.abs(takenAt.getTime() - new Date(trip.startDate).getTime()) / (86400000)) <= 5;

        if (distOk && timeOk) {
          targetTripId = trip.id;
          await db.update(trips).set({ 
            endDate: takenAt > trip.endDate ? takenAt : trip.endDate,
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
        filename: item.name,
        originalName: item.name,
        filePath: cloudinaryResult.secure_url,
        cloudinaryUrl: cloudinaryResult.secure_url,
        cloudinaryPublicId: cloudinaryResult.public_id,
        mimeType: item.type || 'image/jpeg',
        fileSize: item.size || 0,
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