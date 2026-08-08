export class InvalidRetentionConfigError extends Error {
  constructor(public readonly issues: string[]) {
    super("invalid retention configuration");
    this.name = "InvalidRetentionConfigError";
  }
}
