import { defineConfig } from 'drizzle-kit';
import 'dotenv/config'; // Make sure dotenv is installed

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});