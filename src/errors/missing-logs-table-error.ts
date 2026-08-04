export class MissingLogsTableError extends Error {
  constructor() {
    super("required table 'public.logs' is not available");
    this.name = "MissingLogsTableError";
  }
}
