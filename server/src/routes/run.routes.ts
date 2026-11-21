import { Router } from "express";
import { analyzeRun } from '../services/ai/run-analysis.js';
import { runRepository } from '../models/run.repository.js';
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
runRouter.post('/:id/analyze',async(req,res)=>{res.json(await analyzeRun(String(req.params.id)));});
runRouter.get('/:id/baseline',async(req,res)=>{const run=await runRepository.get(String(req.params.id));if(!run){res.sendStatus(404);return;}res.json(await runRepository.baseline(run));});

runRouter.get("/", listRuns);
runRouter.get("/active", getActiveRun);
runRouter.post("/", startRun);
runRouter.post("/stop", stopRun);
runRouter.get("/stream", streamEvents);
runRouter.get("/:id/report", downloadRunReport);
runRouter.get("/:id", getRun);
