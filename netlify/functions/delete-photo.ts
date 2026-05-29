// 📁 File: /netlify/functions/delete-photo.ts
import { Handler } from '@netlify/functions';
import { v2 as cloudinary } from 'cloudinary';
import { eq } from 'drizzle-orm';
import { db } from '../../src/db'; 
import { photos } from '../../src/db/schema';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  try {
    const { photoId, cloudinaryPublicId } = JSON.parse(event.body || '{}');
    if (!photoId) return { statusCode: 400, body: 'Missing photoId identifier' };

    // 1. Delete from Cloudinary if public ID exists
    if (cloudinaryPublicId) {
      await cloudinary.uploader.destroy(cloudinaryPublicId);
    }

    // 2. Delete from NeonDB
    await db.delete(photos).where(eq(photos.id, Number(photoId)));

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true }),
    };
  } catch (err) {
    return { statusCode: 500, body: `Deletion Error: ${(err as Error).message}` };
  }
};