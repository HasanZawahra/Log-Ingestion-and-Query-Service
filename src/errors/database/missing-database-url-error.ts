export class MissingDatabaseUrlError extends Error {
  constructor() {
    // The application cannot connect to PostgreSQL without a database URL.
    super("DATABASE_URL must be set");
    this.name = "MissingDatabaseUrlError";
  }
}
