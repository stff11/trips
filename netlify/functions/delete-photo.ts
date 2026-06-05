// File: /netlify/functions/delete-photo.ts
import { Handler } from '@netlify/functions';
import { v2 as cloudinary } from 'cloudinary'; // Import cloudinary
import { db } from '../../src/db';
import { photos, trips } from '../../src/db/schema';
import { eq, sql } from 'drizzle-orm';

// Ensure your cloudinary is configured here as well
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
    // 1. Fetch the photo record first so we have the Public ID
    const [photoToDelete] = await db.select().from(photos).where(eq(photos.id, Number(photoId)));
    if (!photoToDelete) throw new Error("Photo not found");

    // 2. Perform the database operations inside a transaction
    await db.transaction(async (tx) => {
      const [trip] = await tx.select().from(trips).where(eq(trips.id, Number(tripId)));
      if (!trip) throw new Error("Trip not found");

      const remainingPhotos = await tx.select().from(photos)
        .where(sql`${photos.tripId} = ${tripId} AND ${photos.id} != ${photoId}`);

      const newCount = Math.max(0, (trip.photoCount || 1) - 1);
      const updates: any = { photoCount: newCount };

      // If deleting the cover photo, set the first one as cover
      if (trip.coverPhotoId === Number(photoId)) {
        updates.coverPhotoId = remainingPhotos.length > 0 ? remainingPhotos[0].id : null;
      }

      if (remainingPhotos.length > 0) {
        const dates = remainingPhotos
          .filter((p): p is typeof p & { takenAt: Date } => p.takenAt !== null)
          .map(p => new Date(p.takenAt).getTime());
        updates.startDate = new Date(Math.min(...dates));
        updates.endDate = new Date(Math.max(...dates));
      }

      await tx.update(trips).set(updates).where(eq(trips.id, Number(tripId)));
      await tx.delete(photos).where(eq(photos.id, Number(photoId)));
      
      // If deleting the last photo, delete the album too
      if (newCount === 0) {
        await tx.delete(trips).where(eq(trips.id, Number(tripId)));
      }
    });

    // 3. FINALLY: Delete from Cloudinary
    // We do this AFTER the DB transaction succeeds. If it fails, 
    // the photo stays in DB and in Cloudinary (Consistency).
    if (photoToDelete.cloudinaryPublicId) {
      await cloudinary.uploader.destroy(photoToDelete.cloudinaryPublicId);
    }

    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  } catch (err: any) {
    console.error("Critical delete failure:", err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};