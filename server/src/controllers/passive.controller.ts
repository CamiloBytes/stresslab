import type { Request, Response } from 'express';
import { z } from 'zod';
import { projectRepository } from '../models/project.repository.js';
import { HttpError } from '../middleware/http-error.js';
import { allowedTarget, inspectResponse, zapStatus } from '../services/security/passive.js';
import { securityRepository } from '../services/security/repository.js';
import { scopeKeyFor } from '../services/security/normalizer.js';

const inputSchema = z.object({projectId:z.string().max(60),targetUrl:z.url().max(2000)}).strict();
let running = false;
export async function status(_req:Request,res:Response) { res.json(await zapStatus()); }
export async function scan(req:Request,res:Response) {
  const {projectId,targetUrl} = inputSchema.parse(req.body);
  const project = await projectRepository.get(projectId);
  if(!project) throw new HttpError(404,'Proyecto no encontrado');
  const url = allowedTarget(targetUrl,project.scope);
  if(running) throw new HttpError(409,'Ya hay una revisión pasiva en curso');
  running=true;
  try {
    const findings = await inspectResponse(url);
    const id = crypto.randomUUID();
    res.status(201).json(await securityRepository.createAssessment({id,projectId,targetUrl:url,name:`Revisión pasiva · ${new URL(url).pathname}`,
      source:'zap-passive',status:'imported',environment:project.environment,scopeKey:scopeKeyFor(url,project.environment),reportFingerprint:id,createdAt:new Date().toISOString(),findingCount:findings.length,severitySummary:{critical:0,high:0,medium:0,low:0,info:0}},findings));
  } finally {running=false;}
}
