import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import * as schema from './schema';

// The Pool is what provides the .query() method that Drizzle needs.
const pool = new Pool({ connectionString: process.env.DATABASE_URL! });

// 2. Pass the pool to drizzle
export const db = drizzle(pool, { schema });