import { Router } from "express";
import {
  createScenario,
  deleteScenario,
  getScenario,
  listScenarios,
  updateScenario,
} from "../controllers/scenario.controller.js";

export const scenarioRouter = Router();

scenarioRouter.get("/", listScenarios);
scenarioRouter.get("/:id", getScenario);
scenarioRouter.post("/", createScenario);
scenarioRouter.put("/:id", updateScenario);
scenarioRouter.delete("/:id", deleteScenario);
