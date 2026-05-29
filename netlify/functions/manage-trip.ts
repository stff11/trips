// 📁 File: /netlify/functions/manage-trip.ts
import { Handler } from '@netlify/functions';
import { v2 as cloudinary } from 'cloudinary';
import { db } from '../../src/db';
import { photos, trips } from '../../src/db/schema';
import { eq } from 'drizzle-orm';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const handler: Handler = async (event) => {
  const { action, tripId, newName } = JSON.parse(event.body || '{}');

  // Ensure tripId is a valid number
  const targetId = Number(tripId);
  if (isNaN(targetId)) return { statusCode: 400, body: 'Invalid tripId provided' };

  try {
    if (action === 'EDIT') {
      await db.update(trips).set({ name: newName }).where(eq(trips.id, Number(tripId)));
    } else if (action === 'DELETE') {
      // 1. Fetch all photos for this trip so we have their public IDs
      const tripPhotos = await db.select().from(photos).where(eq(photos.tripId, tripId));

      // 2. Delete each photo from Cloudinary
      for (const photo of tripPhotos) {
        if (photo.cloudinaryPublicId) {
          try {
            await cloudinary.uploader.destroy(photo.cloudinaryPublicId);
            console.log(`Deleted from Cloudinary: ${photo.cloudinaryPublicId}`);
          } catch (err) {
            console.error(`Failed to delete ${photo.cloudinaryPublicId} from Cloudinary`, err);
          }
        }
      }
      // 3. Delete the trip from DB 
      // (The 'onDelete: cascade' will now automatically delete the records in the 'photos' table)
      await db.delete(trips).where(eq(trips.id, tripId));
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true }),
    };
  } catch (err) {
    console.error("DEBUG ERROR:", err); // CHECK NETLIFY LOGS FOR THIS
    return { 
      statusCode: 500, 
      body: JSON.stringify({ error: (err as Error).message }) 
    };
  }
};