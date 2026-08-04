import { describe, expect, it } from "vitest";
import { app } from "../app.js";
import { LOGS_ROUTE } from "../constants/routes.js";

interface ExpressRouteLayer {
  route?: {
    path: string;
    methods: Record<string, boolean>;
  };
}

describe("POST /logs", () => {
  it("is registered on the Express app", () => {
    const router = (app as unknown as { router: { stack: ExpressRouteLayer[] } }).router;

    const logsRoute = router.stack.find((layer) => layer.route?.path === LOGS_ROUTE);

    expect(logsRoute?.route?.methods.post).toBe(true);
  });
});
