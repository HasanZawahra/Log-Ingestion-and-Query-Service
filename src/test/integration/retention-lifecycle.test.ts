import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockInitializeDatabase,
  mockCloseDatabase,
  mockGetRetentionConfig,
  mockWorkerStart,
  mockWorkerStop,
} = vi.hoisted(() => ({
  mockInitializeDatabase: vi.fn(),
  mockCloseDatabase: vi.fn(),
  mockGetRetentionConfig: vi.fn(),
  mockWorkerStart: vi.fn(),
  mockWorkerStop: vi.fn(),
}));

const signalHandlers: Record<string, () => void> = {};

vi.mock("../../config/database.js", () => ({
  initializeDatabase: mockInitializeDatabase,
  closeDatabase: mockCloseDatabase,
}));

vi.mock("../../config/retention.js", () => ({
  getRetentionConfig: mockGetRetentionConfig,
}));

vi.mock("../../repositories/postgres/retention-repository.js", () => ({
  PostgresRetentionRepository: vi.fn(),
}));

vi.mock("../../services/implementations/retention-service.js", () => ({
  RetentionService: vi.fn(),
}));

vi.mock("../../retention/retention-worker.js", () => ({
  RetentionWorker: class {
    start = mockWorkerStart;
    stop = mockWorkerStop;
  },
}));

describe("retention lifecycle integration", () => {
  beforeEach(() => {
    vi.resetModules();
    mockInitializeDatabase.mockReset();
    mockCloseDatabase.mockReset();
    mockGetRetentionConfig.mockReset();
    mockWorkerStart.mockReset();
    mockWorkerStop.mockReset();

    signalHandlers.SIGINT = undefined as never;
    signalHandlers.SIGTERM = undefined as never;
  });

  it("starts retention after the database is ready and registers shutdown handlers", async () => {
    mockInitializeDatabase.mockResolvedValue(undefined);
    mockGetRetentionConfig.mockReturnValue({
      logRetentionDays: 30,
      retentionIntervalMinutes: 60,
      retentionDeleteBatchSize: 5000,
    });

    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "test";
    vi.resetModules();

    const { app } = await import("../../app.js");
    vi.spyOn(app, "listen").mockImplementation(((...args: unknown[]) => {
      const callback = args[1] as (() => void) | undefined;
      callback?.();
      return {
        close: (cb: (error?: Error) => void) => cb(),
      } as never;
    }) as never);

    const onceSpy = vi.spyOn(process, "once").mockImplementation(((
      event: string,
      listener: () => void
    ) => {
      signalHandlers[event] = listener;
      return process;
    }) as never);

    try {
      const { startServer } = await import("../../server.js");
      await startServer();

      expect(mockInitializeDatabase).toHaveBeenCalledTimes(1);
      expect(mockWorkerStart).toHaveBeenCalledTimes(1);
      expect(mockCloseDatabase).not.toHaveBeenCalled();
      expect(onceSpy).toHaveBeenCalledWith("SIGINT", expect.any(Function));
      expect(onceSpy).toHaveBeenCalledWith("SIGTERM", expect.any(Function));

      signalHandlers.SIGINT?.();
      await new Promise<void>((resolve) => setImmediate(resolve));
      await new Promise<void>((resolve) => setImmediate(resolve));

      expect(mockWorkerStop).toHaveBeenCalledTimes(1);
      expect(mockCloseDatabase).toHaveBeenCalledTimes(1);
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
      onceSpy.mockRestore();
    }
  });
});
