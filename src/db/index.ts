import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL!;

// For migrations and one-off scripts — max 1 connection
export const migrationClient = postgres(connectionString, { max: 1 });

// For query use — singleton pattern (pooled)
const queryClient = postgres(connectionString);
export const db = drizzle(queryClient, { schema });
