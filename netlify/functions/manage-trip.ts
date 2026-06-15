import { Handler, HandlerEvent } from "@netlify/functions";
import { v2 as cloudinary } from "cloudinary";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../../src/db/schema";
import { photos, trips } from "../../src/db/schema";
import { eq } from "drizzle-orm";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });




cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Cloudinary's bulk delete endpoint accepts up to 100 public IDs per call.
const CLOUDINARY_BATCH_SIZE = 100;

interface RequestBody {
  action: 'EDIT' | 'DELETE' | 'SET_COVER';
  tripId: string | number;
  newName?: string;
  photoId?: number;
}

export const handler: Handler = async (event: HandlerEvent) => {
  const body: RequestBody = JSON.parse(event.body || '{}');
  const { action, tripId, newName, photoId } = body;

  const targetId = Number(tripId);
  if (isNaN(targetId)) return { statusCode: 400, body: 'Invalid tripId provided' };

  try {
    if (action === 'EDIT') {
      if (!newName) return { statusCode: 400, body: 'Missing newName' };
      await db
        .update(trips)
        .set({ name: newName, updatedAt: new Date() })
        .where(eq(trips.id, targetId));

    } else if (action === 'SET_COVER') {
      if (!photoId) return { statusCode: 400, body: 'Missing photoId' };
      await db
        .update(trips)
        .set({ coverPhotoId: photoId, updatedAt: new Date() })
        .where(eq(trips.id, targetId));

    } else if (action === 'DELETE') {
      // 1. Collect Cloudinary public IDs before removing anything from the DB
      const tripPhotos = await db
        .select({ cloudinaryPublicId: photos.cloudinaryPublicId })
        .from(photos)
        .where(eq(photos.tripId, targetId));

      const publicIds = tripPhotos
        .map((p) => p.cloudinaryPublicId)
        .filter(Boolean) as string[];

      // 2. Delete the trip — the `onDelete: 'cascade'` FK removes photo rows automatically
      await db.delete(trips).where(eq(trips.id, targetId));

      // 3. Bulk-delete from Cloudinary in batches of 100 (best-effort, after DB succeeds)
      //    A single `delete_resources` call for 100 IDs takes ~1-2 s vs 100 s serially.
      for (let i = 0; i < publicIds.length; i += CLOUDINARY_BATCH_SIZE) {
        const batch = publicIds.slice(i, i + CLOUDINARY_BATCH_SIZE);
        try {
          await cloudinary.api.delete_resources(batch);
        } catch (err) {
          // Log but don't fail — DB is already clean; orphaned Cloudinary assets can be
          // swept up later with a scheduled cleanup job.
          console.error(`Cloudinary bulk delete failed for batch starting at ${i}:`, err);
        }
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true }),
    };
  } catch (err) {
    console.error('manage-trip error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: (err as Error).message }),
    };
  }
};
