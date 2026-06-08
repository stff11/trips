import { Handler } from '@netlify/functions';
import { db } from '../../src/db';
import { photos, trips } from '../../src/db/schema';
import { count, eq } from 'drizzle-orm';

export const handler: Handler = async (event) => {
  const { sourceTripId, targetTripId } = JSON.parse(event.body || '{}');

  if (!sourceTripId || !targetTripId) return { statusCode: 400, body: 'Missing IDs' };

  try {
    await db.transaction(async (tx) => {
      // 1. Move all photos from the source trip to the target trip
      await tx.update(photos)
        .set({ tripId: Number(targetTripId) })
        .where(eq(photos.tripId, Number(sourceTripId)));

      // 2. Recalculate target trip photo count
      // Count how many photos are now in the target trip
      const countResult = await tx.select({ count: count() })
        .from(photos)
        .where(eq(photos.tripId, targetTripId));

      await tx.update(trips)
        .set({ photoCount: countResult[0].count })
        .where(eq(trips.id, targetTripId));

      // 3. Delete the source trip
      // Thanks to 'onDelete: cascade', any remaining metadata is handled
      await tx.delete(trips)
        .where(eq(trips.id, Number(sourceTripId)));
    });

    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: (err as Error).message }) };
  }
};