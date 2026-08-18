export class InvalidRetentionConfigError extends Error {
  constructor(public readonly issues: string[]) {
    // The retention worker refuses to start with invalid configuration.
    super("invalid retention configuration");
    this.name = "InvalidRetentionConfigError";
  }
}
