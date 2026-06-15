import { Handler } from "@netlify/functions";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../../src/db/schema";
import { photos, trips } from "../../src/db/schema";
import { eq, count } from "drizzle-orm";
import { v2 as cloudinary } from "cloudinary";

// neon-http doesn't support transactions — steps run sequentially.
const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const handler: Handler = async (event) => {
  const { photoId, tripId } = event.body ? JSON.parse(event.body) : {};
  if (!photoId || !tripId) return { statusCode: 400, body: JSON.stringify({ error: 'Missing photoId or tripId' }) };

  const pid = Number(photoId);
  const tid = Number(tripId);

  try {
    // 1. Fetch the photo before deleting so we have the Cloudinary ID
    const [photoToDelete] = await db.select().from(photos).where(eq(photos.id, pid));
    if (!photoToDelete) return { statusCode: 404, body: JSON.stringify({ error: 'Photo not found' }) };

    // 2. Delete the photo row
    await db.delete(photos).where(eq(photos.id, pid));

    // 3. Count remaining photos in the trip
    const [{ value: newCount }] = await db.select({ value: count() }).from(photos).where(eq(photos.tripId, tid));

    if (newCount === 0) {
      // 4a. Trip is now empty — delete it
      await db.delete(trips).where(eq(trips.id, tid));
    } else {
      // 4b. Update trip metadata
      const remaining = await db.select().from(photos).where(eq(photos.tripId, tid));
      const [trip] = await db.select().from(trips).where(eq(trips.id, tid));

      const updates: any = { photoCount: newCount, updatedAt: new Date() };

      // Reassign cover if we just deleted it
      if (trip.coverPhotoId === pid) {
        updates.coverPhotoId = remaining[0].id;
      }

      // Recalculate date range from remaining photos (skip nulls)
      const dates = remaining
        .filter((p) => p.takenAt !== null)
        .map((p) => new Date(p.takenAt!).getTime());

      if (dates.length > 0) {
        updates.startDate = new Date(Math.min(...dates));
        updates.endDate = new Date(Math.max(...dates));
      }

      await db.update(trips).set(updates).where(eq(trips.id, tid));
    }

    // 5. Delete from Cloudinary after DB is clean (best-effort)
    if (photoToDelete.cloudinaryPublicId) {
      try {
        await cloudinary.uploader.destroy(photoToDelete.cloudinaryPublicId);
      } catch (err) {
        console.error('Cloudinary delete failed (DB already clean):', err);
      }
    }

    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  } catch (err: any) {
    console.error('delete-photo error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
