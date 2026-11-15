import { Router } from "express";
import {
  getActiveRun,
  getRun,
  downloadRunReport,
  listRuns,
  startRun,
  stopRun,
  streamEvents,
} from "../controllers/run.controller.js";

export const runRouter = Router();

runRouter.get("/", listRuns);
runRouter.get("/active", getActiveRun);
runRouter.post("/", startRun);
runRouter.post("/stop", stopRun);
runRouter.get("/stream", streamEvents);
runRouter.get("/:id/report", downloadRunReport);
runRouter.get("/:id", getRun);
