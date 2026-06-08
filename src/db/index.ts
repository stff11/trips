import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from 'ws'; // You may need to install 'ws'
import * as schema from './schema';

// Required for serverless environments
neonConfig.webSocketConstructor = ws;

// The Pool is what provides the .query() method that Drizzle needs.
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Pass the pool to drizzle
export const db = drizzle(pool, { schema });