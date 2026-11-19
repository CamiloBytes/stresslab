import { Router } from "express";
import {
  analyzeAssessmentHandler,
  compareAssessments,
  downloadSecurityReport,
  getAssessment,
  importAssessment,
  listAssessments,
  reviewFinding,
} from "../controllers/security.controller.js";

export const securityRouter = Router();

securityRouter.get("/assessments", listAssessments);
securityRouter.post("/assessments", importAssessment);
securityRouter.get("/assessments/compare", compareAssessments);
securityRouter.get("/assessments/:id", getAssessment);
securityRouter.post("/assessments/:id/analyze", analyzeAssessmentHandler);
securityRouter.get("/assessments/:id/report", downloadSecurityReport);
securityRouter.patch("/findings/:id", reviewFinding);
