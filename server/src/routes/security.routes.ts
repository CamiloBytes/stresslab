import { Router } from "express";
import { definitionSchema, latestContract, saveContract, coverage } from '../services/contracts.js';
import { projectRepository } from '../models/project.repository.js';
import { HttpError } from '../middleware/http-error.js';
import { z } from 'zod';
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
securityRouter.get('/contracts/:projectId/coverage',async(req,res)=>{res.json(await coverage(String(req.params.projectId)));});
securityRouter.get('/contracts/:projectId',async(req,res)=>{
  const query=z.object({method:z.string().max(10),url:z.url().max(2000)}).parse(req.query);
  res.json(await latestContract(String(req.params.projectId),query.method,query.url));
});
securityRouter.post('/contracts/:projectId',async(req,res)=>{
  const definition=definitionSchema.parse(req.body);
  const projectId=String(req.params.projectId);
  if(!await projectRepository.get(projectId))throw new HttpError(404,'Proyecto no encontrado');
  await saveContract(projectId,definition);
  res.status(201).json(await latestContract(projectId,definition.method,definition.url));
});
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
