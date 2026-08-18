import { defineConfig } from "drizzle-kit";
import "dotenv/config";

// Drizzle reads the application schema and writes migrations into the repo.
export default defineConfig({
  // Point Drizzle at the source-of-truth schema file.
  schema: "src/database/schema.ts",
  // Keep generated migrations in the repository-managed migrations folder.
  out: "src/database/migrations",
  // The project targets PostgreSQL only.
  dialect: "postgresql",
  dbCredentials: {
    // Drizzle picks up the same connection string as the application runtime.
    url: process.env.DATABASE_URL!,
  },
});
