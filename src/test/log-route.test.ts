import { describe, expect, it } from "vitest";
import { app } from "../app.js";
import { LOGS_ROUTE } from "../constants/routes.js";

interface ExpressRouteLayer {
  route?: {
    path: string;
    methods: Record<string, boolean>;
  };
}

describe("/logs routes", () => {
  it("registers GET /logs on the Express app", () => {
    const router = (app as unknown as { router: { stack: ExpressRouteLayer[] } }).router;

    const getLogsRoute = router.stack.find((layer) => layer.route?.path === LOGS_ROUTE && layer.route?.methods.get);
    const postLogsRoute = router.stack.find((layer) => layer.route?.path === LOGS_ROUTE && layer.route?.methods.post);

    expect(getLogsRoute?.route?.methods.get).toBe(true);
    expect(postLogsRoute?.route?.methods.post).toBe(true);
  });
});
