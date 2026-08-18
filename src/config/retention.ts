import {
  DEFAULT_LOG_RETENTION_DAYS,
  DEFAULT_RETENTION_DELETE_BATCH_SIZE,
  DEFAULT_RETENTION_INTERVAL_MINUTES,
  LOG_RETENTION_DAYS_ENV_VAR,
  RETENTION_DELETE_BATCH_SIZE_ENV_VAR,
  RETENTION_INTERVAL_MINUTES_ENV_VAR,
  RETENTION_MIN_DELETE_BATCH_SIZE,
  RETENTION_MIN_DAYS,
  RETENTION_MIN_INTERVAL_MINUTES,
} from "../constants/retention.js";
import { InvalidRetentionConfigError } from "../errors/config/invalid-retention-config-error.js";

export interface RetentionConfig {
  // Number of days logs are retained before deletion.
  logRetentionDays: number;
  // How often the background worker runs.
  retentionIntervalMinutes: number;
  // Maximum rows deleted per retention query.
  retentionDeleteBatchSize: number;
}

export function getRetentionConfig(env: NodeJS.ProcessEnv = process.env): RetentionConfig {
  // Collect all configuration issues so startup can report them together.
  const issues: string[] = [];

  // Each setting falls back to a sane default when unset.
  const logRetentionDays = readPositiveInteger(
    env[LOG_RETENTION_DAYS_ENV_VAR],
    DEFAULT_LOG_RETENTION_DAYS,
    RETENTION_MIN_DAYS,
    LOG_RETENTION_DAYS_ENV_VAR,
    issues
  );
  const retentionIntervalMinutes = readPositiveInteger(
    env[RETENTION_INTERVAL_MINUTES_ENV_VAR],
    DEFAULT_RETENTION_INTERVAL_MINUTES,
    RETENTION_MIN_INTERVAL_MINUTES,
    RETENTION_INTERVAL_MINUTES_ENV_VAR,
    issues
  );
  const retentionDeleteBatchSize = readPositiveInteger(
    env[RETENTION_DELETE_BATCH_SIZE_ENV_VAR],
    DEFAULT_RETENTION_DELETE_BATCH_SIZE,
    RETENTION_MIN_DELETE_BATCH_SIZE,
    RETENTION_DELETE_BATCH_SIZE_ENV_VAR,
    issues
  );

  if (issues.length > 0) {
    // Invalid configuration is fatal because the worker cannot safely run.
    throw new InvalidRetentionConfigError(issues);
  }

  // Return the parsed, validated retention settings.
  return {
    logRetentionDays,
    retentionIntervalMinutes,
    retentionDeleteBatchSize,
  };
}

export function calculateRetentionCutoff(currentTime: Date, retentionDays: number): Date {
  // Subtract the retention window from the current time.
  return new Date(currentTime.getTime() - retentionDays * 24 * 60 * 60 * 1000);
}

function readPositiveInteger(
  rawValue: string | undefined,
  fallback: number,
  minimum: number,
  envName: string,
  issues: string[]
): number {
  if (rawValue === undefined || rawValue === "") {
    // Missing values are allowed and fall back to the default.
    return fallback;
  }

  if (!/^\d+$/.test(rawValue)) {
    // Reject non-integer values early so errors are explicit.
    issues.push(`${envName} must be an integer`);
    return fallback;
  }

  const parsed = Number(rawValue);

  if (!Number.isInteger(parsed) || parsed < minimum) {
    // The setting must be a positive integer above the configured floor.
    issues.push(`${envName} must be an integer greater than or equal to ${minimum}`);
    return fallback;
  }

  return parsed;
}
