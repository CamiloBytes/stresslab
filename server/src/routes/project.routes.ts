import { Router } from "express";
import {
  createProject,
  deleteProject,
  getProject,
  listProjects,
  updateProject,
} from "../controllers/project.controller.js";

export const projectRouter = Router();

projectRouter.get("/", listProjects);
projectRouter.post("/", createProject);
projectRouter.get("/:id", getProject);
projectRouter.put("/:id", updateProject);
projectRouter.delete("/:id", deleteProject);
