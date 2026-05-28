// 📁 File: /netlify/functions/fetch-trips.ts
import { Handler } from '@netlify/functions';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { desc } from 'drizzle-orm';
import * as schema from '../../src/db/schema';

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

// 🌟 Make headers explicit and uniform to satisfy the Netlify type engine
const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS'
};

export const handler: Handler = async (event) => {
  // Handle CORS preflight options request if it happens
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: '',
    };
  }

  try {
    // 1. Fetch all trips sorted by start date
    const allTrips = await db.select().from(schema.trips).orderBy(desc(schema.trips.startDate));
    
    // 2. Fetch all photos
    const allPhotos = await db.select().from(schema.photos);

    // 3. Map photos arrays back into their respective trip parent objects manually
    const structuredData = allTrips.map((trip) => ({
      ...trip,
      photos: allPhotos.filter((photo) => photo.tripId === trip.id)
    }));

    return {
      statusCode: 200,
      headers: corsHeaders, // Use identical header variable footprint
      body: JSON.stringify(structuredData)
    };
  } catch (error) {
    console.error("Fetch trips query failure:", error);
    return { 
      statusCode: 500, 
      headers: corsHeaders, // Use identical header variable footprint
      body: JSON.stringify({ error: (error as Error).message }) 
    };
  }
};