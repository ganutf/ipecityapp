import { defineConfig } from "drizzle-kit";
import type { Config } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

// Determine if using Neon cloud or local PostgreSQL
const isNeonDatabase = process.env.DATABASE_URL.includes('neon.tech') ||
                        process.env.DATABASE_URL.includes('aws.neon.tech');

console.log('Database URL type:', isNeonDatabase ? 'Neon Cloud' : 'Local PostgreSQL');

// For local PostgreSQL, we need to prevent drizzle-kit from auto-detecting neon driver
const config: Config = {
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
};

// Only add neon driver for actual Neon databases
if (isNeonDatabase) {
  (config as any).driver = "neon-http";
}

export default defineConfig(config);
