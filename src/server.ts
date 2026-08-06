import { app } from "./app.js";
import { DEFAULT_PORT } from "./constants/app.js";
import { initializeDatabase } from "./config/database.js";

export function getPort(): number {
  const portValue = process.env.PORT!;
  const parsed = Number(portValue);

  return Number.isNaN(parsed) ? DEFAULT_PORT : parsed;
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
