import { createHash } from 'node:crypto';
import { z } from 'zod';
import { db } from '../config/db.js';

const path = z.string().regex(/^[\w-]+(?:\.[\w-]+)*$/).max(160);
const rule = z.discriminatedUnion('op',[
  z.object({path,op:z.literal('exists')}),z.object({path,op:z.literal('absent')}),
  z.object({path,op:z.literal('equals'),value:z.union([z.string().max(256),z.number(),z.boolean(),z.null()])}),
  z.object({path,op:z.literal('type'),value:z.enum(['number','string','boolean','array','object','null'])}),
]);
export const definitionSchema = z.object({
  url:z.url().regex(/^https?:\/\//).max(2000).transform(s=>new URL(s).href),method:z.enum(['GET','POST','PUT','PATCH','DELETE','HEAD']),
  status:z.number().int().min(100).max(599),mediaType:z.string().regex(/^[\w.+-]+\/[\w.+-]+$/).optional(),
  rules:z.array(rule).max(32),sampleEvery:z.number().int().min(1).max(1000).default(1),minPass:z.number().min(0).max(100).default(100),
});
export type Definition = z.infer<typeof definitionSchema>;
export type Contract = Definition & {version:number};
export async function recordOutcome(version:number,field:'stressResult'|'securityResult',result:'pass'|'fail'|'skip'){
  await db('api_contracts').where({version}).update({[field]:result});
}
export async function coverage(projectId:string){
  const latest=db('api_contracts').where({projectId}).groupBy('routeKey').max('version');
  const rows=await db('api_contracts').whereIn('version',latest).select('version','definition','stressResult','securityResult').orderBy('version','desc');
  return rows.map(row=>{const {method,url}=JSON.parse(row.definition);return {version:row.version,method,url,stress:row.stressResult,security:row.securityResult};});
}
function key(method:string,url:string){return createHash('sha256').update(method+' '+new URL(url).href).digest('hex');}
export async function saveContract(projectId:string,definition:Definition){
  await db('api_contracts').insert({projectId,routeKey:key(definition.method,definition.url),definition:JSON.stringify(definition)});
}
export async function latestContract(projectId:string|null,method:string,url:string):Promise<Contract|null>{
  if(!projectId)return null;
  const row=await db('api_contracts').where({projectId,routeKey:key(method,url)}).orderBy('version','desc').first();
  return row ? {...JSON.parse(row.definition),version:row.version}:null;
}
// Self-contained: embedded unchanged in the generated k6 script.
export function evaluate(c:Definition,status:number,media:string,body:unknown):('pass'|'fail'|'skip')[]{
  const verdict=(v:boolean)=>v?'pass':'fail';
  const results:('pass'|'fail'|'skip')[]=[status ? verdict(status===c.status):'skip'];
  const mime=media.split(';')[0].trim().toLowerCase();
  if(c.mediaType)results.push(status ? verdict(mime===c.mediaType):'skip');
  if(!c.rules.length)return results;
  let parsed:unknown;let valid=false;
  if(status && (mime==='application/json'||mime.endsWith('+json')) && typeof body==='string' && body.length<=1048576){
    try{parsed=JSON.parse(body);valid=true;}catch{/* unreadable response */}
  }
  for(const r of c.rules){
    if(!valid){results.push('skip');continue;}
    let item=parsed,exists=true;
    for(const part of r.path.split('.')){
      if(item===null || typeof item!=='object'||!Object.prototype.hasOwnProperty.call(item,part)){exists=false;break;}
      item=(item as Record<string,unknown>)[part];
    }
    const kind=item===null?'null':Array.isArray(item)?'array':typeof item;
    results.push(verdict(r.op==='exists'?exists:r.op==='absent'?!exists:exists&&(r.op==='equals'?item===r.value:kind===r.value)));
  }
  return results;
}
export function labels(c:Definition){return ['HTTP '+c.status,...(c.mediaType?[c.mediaType]:[]),...c.rules.map(r=>`${r.path}: ${ {exists:'presente',absent:'ausente',equals:'valor esperado',type:'tipo esperado'}[r.op]}`)];}
