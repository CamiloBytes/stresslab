import { Router } from "express";
import { scan, status } from '../controllers/passive.controller.js';
import {
  analyzeAssessmentHandler,
  compareAssessments,
  downloadSecurityReport,
  getAssessment,
  importAssessment,
  manualFinding,
  listAssessments,
  reviewFinding,
} from "../controllers/security.controller.js";

export const securityRouter = Router();
securityRouter.post('/assessments/scan', scan);
securityRouter.get('/zap/status', status);
securityRouter.post('/assessments/manual', manualFinding);

securityRouter.get("/assessments", listAssessments);
securityRouter.post("/assessments", importAssessment);
securityRouter.get("/assessments/compare", compareAssessments);
securityRouter.get("/assessments/:id", getAssessment);
securityRouter.post("/assessments/:id/analyze", analyzeAssessmentHandler);
securityRouter.get("/assessments/:id/report", downloadSecurityReport);
securityRouter.patch("/findings/:id", reviewFinding);
