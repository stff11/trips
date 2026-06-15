import { Handler } from "@netlify/functions";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../../src/db/schema";
import { photos, trips } from "../../src/db/schema";
import { asc, count, eq } from "drizzle-orm";

// neon-http does not support transactions (stateless HTTP transport).
// Steps run sequentially; the operation is idempotent enough that a partial
// failure can be recovered by re-running the merge.
const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

export const handler: Handler = async (event) => {
  const { sourceTripId, targetTripId } = JSON.parse(event.body || '{}');

  if (!sourceTripId || !targetTripId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing IDs' }) };
  }

  const sourceId = Number(sourceTripId);
  const targetId = Number(targetTripId);

  if (isNaN(sourceId) || isNaN(targetId)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid IDs' }) };
  }

  try {
    // 1. Move all photos from source → target
    await db.update(photos).set({ tripId: targetId }).where(eq(photos.tripId, sourceId));

    // 2. Load all photos now in target to recalculate metadata
    const allPhotos = await db
      .select()
      .from(photos)
      .where(eq(photos.tripId, targetId))
      .orderBy(asc(photos.takenAt));

    const [countResult] = await db
      .select({ count: count() })
      .from(photos)
      .where(eq(photos.tripId, targetId));

    const [targetTrip] = await db.select().from(trips).where(eq(trips.id, targetId));

    // 3. Recalculate date range, centre, cover
    const datesMs = allPhotos
      .filter((p) => p.takenAt !== null)
      .map((p) => new Date(p.takenAt!).getTime());

    const lats = allPhotos.filter((p) => p.lat !== null).map((p) => Number(p.lat));
    const lngs = allPhotos.filter((p) => p.lng !== null).map((p) => Number(p.lng));

    const updates: Record<string, unknown> = {
      photoCount: countResult.count,
      updatedAt: new Date(),
    };

    if (datesMs.length > 0) {
      updates.startDate = new Date(Math.min(...datesMs));
      updates.endDate = new Date(Math.max(...datesMs));
    }

    if (lats.length > 0 && lngs.length > 0) {
      updates.centerLat = lats.reduce((a, b) => a + b, 0) / lats.length;
      updates.centerLng = lngs.reduce((a, b) => a + b, 0) / lngs.length;
    }

    if (!targetTrip.coverPhotoId && allPhotos.length > 0) {
      updates.coverPhotoId = allPhotos[0].id;
    }

    await db.update(trips).set(updates as any).where(eq(trips.id, targetId));

    // 4. Delete the now-empty source trip
    await db.delete(trips).where(eq(trips.id, sourceId));

    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  } catch (err) {
    console.error('Merge error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: (err as Error).message }) };
  }
};
