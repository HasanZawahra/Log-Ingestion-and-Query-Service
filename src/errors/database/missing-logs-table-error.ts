export class MissingLogsTableError extends Error {
  constructor() {
    // The service only becomes healthy once the logs table exists.
    super("required table 'public.logs' is not available");
    this.name = "MissingLogsTableError";
  }
}
