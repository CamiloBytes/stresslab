import { readFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { z } from 'zod';
import { HttpError } from '../../middleware/http-error.js';
import { normalizeZapReport } from './normalizer.js';
import { observeResponse } from './response-contract.js';
import { evaluate, labels, type Contract } from '../contracts.js';

const base = process.env.ZAP_URL || 'http://zap:8080';
async function call(path: string, args: Record<string,string> = {}) {
  const key = process.env.ZAP_API_KEY || (await readFile('/zap-auth/key','utf8')).trim();
  const url = new URL(`/JSON/${path}/`,base);
  url.search = new URLSearchParams(args).toString();
  const result = await fetch(url,{headers:{'X-ZAP-API-Key':key},signal:AbortSignal.timeout(15000),redirect:'error'});
  if (!result.ok) throw new HttpError(502, 'ZAP no pudo procesar la revisión');
  return result.json();
}
export async function zapStatus() {
  try { const {version} = z.object({version:z.string()}).parse(await call('core/view/version')); return {available:true,version}; }
  catch { return {available:false,version:null}; }
}
export function allowedTarget(raw: string, scope: string[]) {
  const url = new URL(raw);
  const targets = (process.env.PASSIVE_TARGETS || '').split(',').map(s=>s.trim()).filter(Boolean);
  const matches = (s:string) => {try {return new URL(s).href === url.href;} catch {return false;} };
  if(url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || !targets.some(matches) || !scope.some(matches))
    throw new HttpError(403,'Autoriza esta URL HTTPS exacta en PASSIVE_TARGETS y en el alcance del proyecto');
  return url.href;
}
const alertsSchema = z.object({alerts:z.array(z.object({pluginId:z.string(),alert:z.string(),risk:z.string(),url:z.string(),method:z.string().optional(),param:z.string().optional(),solution:z.string().optional(),reference:z.string().optional()}))});
export async function inspectResponse(url:string,contract?:Contract|null) {
  if (!(await zapStatus()).available) throw new HttpError(503,'Servicio ZAP no disponible');
  await call('core/action/newSession',{overwrite:'true'});
  const reply = await call('core/action/accessUrl',{url,followRedirects:'false'});
  const messages = z.array(z.object({responseHeader:z.string(),responseBody:z.string().optional()})).safeParse(reply.accessUrl);
  const msg = messages.success && messages.data.find(m=>(observeResponse(m.responseHeader)?.status??0)>=200);
  const observed = msg && observeResponse(msg.responseHeader);
  if (!observed) throw new HttpError(502,'No se observó una respuesta HTTP del objetivo');
  const until = Date.now()+45000;
  do {
    await delay(700);
    if ((await call('pscan/view/recordsToScan')).recordsToScan === '0') {
      const {alerts} = alertsSchema.parse(await call('core/view/alerts',{baseurl:url,start:'0',count:'500'}));
      const findings = normalizeZapReport({alerts:alerts.filter(a=>a.url===url).map(a=>({pluginid:a.pluginId,alert:a.alert,risk:a.risk,solution:a.solution,reference:a.reference,instances:[{uri:url,method:a.method || 'GET',param:a.param}]}))});
      const names=contract?labels(contract):[];
      const rules=contract?evaluate(contract,observed.status,observed.mediaType??'',msg.responseBody).map((outcome,i)=>({label:names[i],outcome})):undefined;
      return {findings, observed,rules};
    }
  } while(Date.now()<until);
  throw new HttpError(504,'La revisión pasiva excedió el tiempo límite');
}
