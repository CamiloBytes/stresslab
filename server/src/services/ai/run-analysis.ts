import { z } from 'zod';
import { db } from '../../config/db.js';
import { HttpError } from '../../middleware/http-error.js';
import { runRepository } from '../../models/run.repository.js';
import type { Run } from '../../models/types.js';
import { resolveProvider,extractJson,providerNotFoundMessage } from './provider.js';

const analysis=z.object({observations:z.string().min(1).max(1800),hypotheses:z.string().min(1).max(1000),nextStep:z.string().min(1).max(1000)});
const pending=new Map<string,Promise<NonNullable<Run['aiAnalysis']>>>();
async function generate(id:string){
  const run=await runRepository.get(id);
  if(!run)throw new HttpError(404,'Corrida no encontrada');
  if(run.aiAnalysis)return run.aiAnalysis;
  if(run.status==='running'||!run.summary?.requests)throw new HttpError(409,'Se requiere una corrida finalizada con métricas');
  const provider=resolveProvider();if(!provider)throw new HttpError(503,providerNotFoundMessage());
  const {contract,loadProfile,comparisonKey:_key,...metrics}=run.summary;
  const baseline=(await runRepository.baseline(run))?.summary;
  const payload={metrics,loadProfile,baseline:baseline?{p95Ms:baseline.p95Ms,rps:baseline.rps,errorRate:baseline.errorRate,counts:baseline.contract?.counts.map(({pass,fail,skip})=>({pass,fail,skip}))}:null,contract:contract&&{version:contract.version,sampleEvery:contract.sampleEvery,minPass:contract.minPass,counts:contract.counts.map(({pass,fail,skip},index)=>({index,pass,fail,skip}))}};
  let result;
  try {result=analysis.parse(extractJson(await provider.complete('Explica métricas k6 en español. No inventes causas ni cambies veredictos. Separa hechos de hipótesis. Devuelve solo JSON con tres cadenas breves: observations, hypotheses y nextStep.',JSON.stringify(payload))));}
  catch{throw new HttpError(502,'El proveedor no devolvió un análisis válido. Puedes reintentar.');}
  const saved={...result,model:`${provider.label} · ${provider.model}`,generatedAt:new Date().toISOString()};
  await db('runs').where({id}).update({aiAnalysis:JSON.stringify(saved)});
  return saved;
}
export function analyzeRun(id:string){
  const existing=pending.get(id);if(existing)return existing;
  const promise=generate(id).finally(()=>pending.delete(id));pending.set(id,promise);return promise;
}
