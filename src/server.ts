import { app } from "./app.js";
import { initializeDatabase } from "./config/database.js";

const port = Number(process.env.PORT!);

async function startServer() {
  await initializeDatabase();

  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
}

startServer().catch((error) => {
  console.error("Failed to start server", error);
  process.exit(1);
});
