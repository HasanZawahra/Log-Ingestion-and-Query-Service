export class MissingDatabaseUrlError extends Error {
  constructor() {
    super("DATABASE_URL must be set");
    this.name = "MissingDatabaseUrlError";
  }
}
