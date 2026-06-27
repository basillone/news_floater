import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Migrations use the DIRECT (unpooled) connection — DDL and advisory locks
// don't play well with PgBouncer transaction-mode pooling. See
// private-notes/11-technical-deep-dives.md.
config({ path: ".env.local" });

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? "",
  },
  strict: true,
  verbose: true,
});
