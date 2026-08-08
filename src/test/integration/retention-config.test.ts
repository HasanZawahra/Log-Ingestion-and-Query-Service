import { beforeEach, describe, expect, it, vi } from "vitest";
import { calculateRetentionCutoff, getRetentionConfig } from "../../config/retention.js";
import { InvalidRetentionConfigError } from "../../errors/config/invalid-retention-config-error.js";

describe("retention configuration", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("uses the documented defaults when env vars are omitted", () => {
    const config = getRetentionConfig({});

    expect(config).toEqual({
      logRetentionDays: 30,
      retentionIntervalMinutes: 60,
      retentionDeleteBatchSize: 5000,
    });
  });

  it("rejects invalid retention configuration values", () => {
    expect(() =>
      getRetentionConfig({
        LOG_RETENTION_DAYS: "0",
        RETENTION_INTERVAL_MINUTES: "abc",
        RETENTION_DELETE_BATCH_SIZE: "-1",
      } as NodeJS.ProcessEnv)
    ).toThrow(InvalidRetentionConfigError);
  });

  it("calculates cutoff from the current time and retention period", () => {
    const cutoff = calculateRetentionCutoff(new Date("2026-08-08T00:00:00.000Z"), 30);

    expect(cutoff.toISOString()).toBe("2026-07-09T00:00:00.000Z");
  });
});
