import { describe, expect, it, vi } from "vitest";
import type { IngestRequest } from "../dto/ingest-request.js";
import { AllEntriesRejectedError } from "../errors/all-entries-rejected-error.js";
import { LogService } from "../services/implementations/log-service.js";
import type { ILogRepository } from "../repositories/interfaces/log-repository.js";

describe("LogService", () => {
  it("validates and persists only valid entries", async () => {
    const saveLogs = vi.fn().mockResolvedValue(undefined);
    const repository: ILogRepository = {
      ensureSchemaReady: vi.fn(),
      saveLogs,
    };

    const service = new LogService(repository);
    const request: IngestRequest = {
      entries: [
        {
          timestamp: new Date(Date.now() - 60_000).toISOString(),
          level: "info",
          service: "checkout",
          message: "created",
        },
        {
          timestamp: new Date(Date.now() + 10 * 60_000).toISOString(),
          level: "warn",
          service: "billing",
          message: "",
        },
      ],
    };

    const response = await service.ingestLogs(request);

    expect(saveLogs).toHaveBeenCalledWith([
      {
        timestamp: request.entries[0]?.timestamp,
        level: "info",
        service: "checkout",
        message: "created",
      },
    ]);
    expect(response.accepted).toBe(1);
    expect(response.rejected).toBe(1);
    expect(response.rejectedEntries[0]?.reason).toContain("message");
  });

  it("throws when every entry is rejected", async () => {
    const saveLogs = vi.fn();
    const repository: ILogRepository = {
      ensureSchemaReady: vi.fn(),
      saveLogs,
    };

    const service = new LogService(repository);

    await expect(
      service.ingestLogs({
        entries: [
          {
            timestamp: new Date(Date.now() + 10 * 60_000).toISOString(),
            level: "warn",
            service: "billing",
            message: "",
          },
        ],
      })
    ).rejects.toBeInstanceOf(AllEntriesRejectedError);

    expect(saveLogs).not.toHaveBeenCalled();
  });
});
