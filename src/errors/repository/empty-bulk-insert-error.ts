export class EmptyBulkInsertError extends Error {
  constructor() {
    // Bulk insert builders should never be called with zero rows.
    super("cannot build a bulk insert query without log entries");
    this.name = "EmptyBulkInsertError";
  }
}
