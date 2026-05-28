// 📁 File: /netlify/functions/manage-trip.ts
import { Handler } from '@netlify/functions';
import { eq } from 'drizzle-orm';
// @ts-ignore
import { db } from '../../src/db'; 
// @ts-ignore
import { trips, photos } from '../../src/db/schema';

export const handler: Handler = async (event) => {
  const { action, tripId, newName } = JSON.parse(event.body || '{}');

  // Ensure tripId is a valid number
  const targetId = Number(tripId);
  if (isNaN(targetId)) return { statusCode: 400, body: 'Invalid tripId provided' };

  try {
    if (action === 'EDIT') {
      await db.update(trips).set({ name: newName }).where(eq(trips.id, Number(tripId)));
    } else if (action === 'DELETE') {
      // Clean up linked photo relationships first to avoid key constraints
      await db.delete(photos).where(eq(photos.tripId, Number(tripId)));
      await db.delete(trips).where(eq(trips.id, Number(tripId)));
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