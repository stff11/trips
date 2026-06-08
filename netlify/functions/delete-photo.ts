import { Handler } from '@netlify/functions';
import { v2 as cloudinary } from 'cloudinary'; 
import { db } from '../../src/db';
import { photos, trips } from '../../src/db/schema';
import { eq, count } from 'drizzle-orm';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const handler: Handler = async (event) => {
  console.log("RAW EVENT BODY RECEIVED:", event.body);

  const body = event.body ? JSON.parse(event.body) : {};
  console.log("PARSED BODY OBJECT:", body);

  const { photoId, tripId } = body;
  
  if (!photoId || !tripId) return { statusCode: 400, body: 'Missing ID' };

  try {
    const [photoToDelete] = await db.select().from(photos).where(eq(photos.id, Number(photoId)));
    if (!photoToDelete) throw new Error("Photo not found");

    await db.transaction(async (tx) => {
      // 1. Delete the photo
      await tx.delete(photos).where(eq(photos.id, Number(photoId)));
      
      // 2. Get the new accurate count
      const [result] = await tx.select({ value: count() })
        .from(photos)
        .where(eq(photos.tripId, Number(tripId)));

      const newCount = result.value;

      if (newCount === 0) {
        // 3a. If empty, delete the trip
        await tx.delete(trips).where(eq(trips.id, Number(tripId)));
      } else {
        // 3b. Otherwise, update the count and metadata
        const remainingPhotos = await tx.select().from(photos)
          .where(eq(photos.tripId, Number(tripId)));
        
        const updates: any = { photoCount: newCount };

        // Handle cover photo logic if necessary
        const [trip] = await tx.select().from(trips).where(eq(trips.id, Number(tripId)));
        if (trip.coverPhotoId === Number(photoId)) {
          updates.coverPhotoId = remainingPhotos[0].id;
        }

        // Update dates
        const dates = remainingPhotos
          .filter((p) => p.takenAt !== null)
          .map(p => new Date(p.takenAt!).getTime());
        
        if (dates.length > 0) {
          updates.startDate = new Date(Math.min(...dates));
          updates.endDate = new Date(Math.max(...dates));
        }

        await tx.update(trips).set(updates).where(eq(trips.id, Number(tripId)));
      }
    });

    // 4. Delete from Cloudinary only after DB succeeds
    if (photoToDelete.cloudinaryPublicId) {
      await cloudinary.uploader.destroy(photoToDelete.cloudinaryPublicId);
    }

    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  } catch (err: any) {
    console.error("Critical delete failure:", err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};