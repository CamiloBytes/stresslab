import type { Request, Response } from 'express';
import { z } from 'zod';
import { projectRepository } from '../models/project.repository.js';
import { HttpError } from '../middleware/http-error.js';
import { allowedTarget, inspectResponse, zapStatus } from '../services/security/passive.js';
import { securityRepository } from '../services/security/repository.js';
import { scopeKeyFor } from '../services/security/normalizer.js';

import { expectationSchema, checkContract } from '../services/security/response-contract.js';
import { latestContract, recordOutcome } from '../services/contracts.js';
const inputSchema = z.object({projectId:z.string().max(60),targetUrl:z.url().max(2000),expected:expectationSchema.optional()}).strict();
let running = false;
export async function status(_req:Request,res:Response) { res.json(await zapStatus()); }
export async function scan(req:Request,res:Response) {
  const {projectId,targetUrl,expected} = inputSchema.parse(req.body);
  const project = await projectRepository.get(projectId);
  if(!project) throw new HttpError(404,'Proyecto no encontrado');
  const url = allowedTarget(targetUrl,project.scope);
  if(running) throw new HttpError(409,'Ya hay una revisión pasiva en curso');
  running=true;
  try {
    const contract = expected ? null : await latestContract(projectId,'GET',url);
    let observedResponse;
    try {observedResponse=await inspectResponse(url,contract);}catch(error){if(contract)await recordOutcome(contract.version,'securityResult','skip');throw error;}
    const { findings, observed,rules } = observedResponse;
    const spec=expected ?? contract;
    const responseContract=spec?{...checkContract({status:spec.status,mediaType:spec.mediaType},observed),...(contract&&rules?{version:contract.version,rules,matches:rules.every(r=>r.outcome==='pass')}: {})}:null;
    const id = crypto.randomUUID();
    const assessment=await securityRepository.createAssessment({id,projectId,targetUrl:url,name:`Revisión pasiva · ${new URL(url).pathname}`,responseContract,
      source:'zap-passive',status:'imported',environment:project.environment,scopeKey:scopeKeyFor(url,project.environment),reportFingerprint:id,createdAt:new Date().toISOString(),findingCount:findings.length,severitySummary:{critical:0,high:0,medium:0,low:0,info:0}},findings);
    if(contract&&rules)await recordOutcome(contract.version,'securityResult',rules.some(r=>r.outcome==='fail')?'fail':rules.some(r=>r.outcome==='skip')?'skip':'pass');
    res.status(201).json(assessment);
  } finally {running=false;}
}
