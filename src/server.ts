import { app } from "./app.js";
import { initializeDatabase } from "./config/database.js";

export function getPort(): number {
  const portValue = process.env.PORT ?? "8080";
  const parsed = Number(portValue);

  return Number.isNaN(parsed) ? 8080 : parsed;
}

async function startServer() {
  await initializeDatabase();

  const port = getPort();

  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
}

if (process.env.NODE_ENV !== "test") {
  startServer().catch((error) => {
    console.error("Failed to start server", error);
    process.exit(1);
  });
}
