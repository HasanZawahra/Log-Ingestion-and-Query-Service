import { describe, expect, it } from "vitest";
import { getPort } from "../../server.js";

describe("getPort", () => {
  it("defaults to 8080 when PORT is not set", () => {
    const originalPort = process.env.PORT;
    delete process.env.PORT;

    expect(getPort()).toBe(8080);

    if (originalPort) {
      process.env.PORT = originalPort;
    }
  });
});
