export class EmptyBulkInsertError extends Error {
  constructor() {
    super("cannot build a bulk insert query without log entries");
    this.name = "EmptyBulkInsertError";
  }
}
