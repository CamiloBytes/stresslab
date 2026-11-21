// Run from the production image with stdin (see README). Uses a private temporary DB.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir=await mkdtemp(join(tmpdir(),'stresslab-check-'));
Object.assign(process.env,{DB_CLIENT:'better-sqlite3',DB_FILE:join(dir,'test.db'),RUNS_DIR:dir,AI_PROVIDER:'openai',OPENAI_API_KEY:'fixture',ZAP_URL:'http://fixture.invalid',ZAP_API_KEY:'fixture'});
const {db,initDatabase}=await import('./server/dist/config/db.js');
const {projectRepository}=await import('./server/dist/models/project.repository.js');
const {scenarioRepository}=await import('./server/dist/models/scenario.repository.js');
const {scenarioInputSchema}=await import('./server/dist/models/scenario.schema.js');
const {definitionSchema,saveContract,latestContract,evaluate}=await import('./server/dist/services/contracts.js');
const {runService}=await import('./server/dist/services/run.service.js');
const {runRepository}=await import('./server/dist/models/run.repository.js');
const {inspectResponse}=await import('./server/dist/services/security/passive.js');
const {analyzeRun}=await import('./server/dist/services/ai/run-analysis.js');
const server=createServer((_req,res)=>{res.writeHead(200,{'content-type':'application/json'});res.end('{"privateField":"fixture-secret"}');});
server.listen(0,'127.0.0.1');await once(server,'listening');
const url=`http://127.0.0.1:${server.address().port}/fixture`;let calls=0;
globalThis.fetch=async(input,opt)=>{
  const u=new URL(input);
  if(u.hostname==='api.openai.com'){calls++;const data=JSON.stringify(opt.body);assert.ok(!['fixture-secret','127.0.0.1','privateField'].some(s=>data.includes(s)));return Response.json({choices:[{message:{content:JSON.stringify({observations:'Hubo fallos de contrato.',hypotheses:'Revisar datos de entrada.',nextStep:'Comprobar la forma del JSON.'})}}]});}
  assert.equal(u.hostname,'fixture.invalid');
  const body=u.pathname.includes('accessUrl')?{accessUrl:[{responseHeader:'HTTP/1.1 200 OK\r\nContent-Type: application/json',responseBody:'{"privateField":"fixture-secret"}'}]}:u.pathname.includes('recordsToScan')?{recordsToScan:'0'}:u.pathname.includes('/alerts')?{alerts:[]}:u.pathname.includes('version')?{version:'fixture'}:{};
  return Response.json(body);
};
try{
  await initDatabase();const project=await projectRepository.create(crypto.randomUUID(),{name:'Fixture',environment:'local',scope:[url]});
  const c=definitionSchema.parse({url,method:'GET',status:200,mediaType:'application/json',rules:[{op:'exists',path:'id'},{op:'absent',path:'privateField'}]});await saveContract(project.id,c);
  const contract=await latestContract(project.id,'GET',url);
  assert.deepEqual(evaluate(c,200,'text/html','not JSON'),['pass','fail','skip','skip']);
  const observed=await inspectResponse(url,contract);assert.deepEqual(observed.rules.map(r=>r.outcome),['pass','pass','fail','fail']);
  const scenario=await scenarioRepository.create({id:crypto.randomUUID(),...scenarioInputSchema.parse({name:'Fixture',type:'api',url,projectId:project.id,expectedStatus:201,stages:[{duration:'1s',target:1},{duration:'2s',target:1}],thinkTime:0.25})});
  const started=await runService.start(scenario.id);let run;
  for(let i=0;i<60;i++){await new Promise(r=>setTimeout(r,400));run=await runRepository.get(started.id);if(run.status!=='running')break;}
  assert.ok(run.summary?.requests>0,JSON.stringify(run));assert.equal(run.summary.checksRate,0);
  assert.ok(run.summary.contract.counts.at(-1).fail>0,JSON.stringify(run.summary));assert.equal(run.summary.thresholds.at(-1).passed,false);
  assert.deepEqual(await analyzeRun(run.id),await analyzeRun(run.id));assert.equal(calls,1);
  console.log(`OK: ${run.summary.requests} solicitudes locales; reglas coherentes, 0 % de checks, umbral fallido y análisis IA reutilizado.`);
} finally {server.close();await db.destroy();await rm(dir,{recursive:true,force:true});}
