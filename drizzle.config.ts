import { defineConfig } from "drizzle-kit";
import "dotenv/config";

export default defineConfig({
  schema: "src/database/schema.ts",
  out: "src/database/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.CONNECTION_STRING!,
  },
});