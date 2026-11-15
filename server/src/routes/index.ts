import { Router } from "express";
import { healthRouter } from "./health.routes.js";
import { runRouter } from "./run.routes.js";
import { scenarioRouter } from "./scenario.routes.js";

export const apiRouter = Router();

apiRouter.use("/health", healthRouter);
apiRouter.use("/scenarios", scenarioRouter);
apiRouter.use("/runs", runRouter);
