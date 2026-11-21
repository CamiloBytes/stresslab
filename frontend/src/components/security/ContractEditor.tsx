import { useState } from 'react';
import { api } from '../../lib/api';
import { Button } from '../ui/Button';
import { Panel } from '../ui/Panel';
import { TextAreaField,TextField,SelectField } from '../ui/Field';

type Draft={method:string;url:string;status:number;mediaType?:string;rules:unknown[];sampleEvery:number;minPass:number};
type Schema={required?:string[];properties?:Record<string,{type?:string}>};
type Operation={responses?:Record<string,{content?:Record<string,{schema?:Schema}>;schema?:Schema}>};

export function ContractEditor({projectId,initialUrl}:{projectId:string;initialUrl:string}){
  const [draft,set]=useState<Draft>({method:'GET',url:initialUrl,status:200,mediaType:'application/json',rules:[],sampleEvery:1,minPass:100});
  const [rules,text]=useState('[]');const [message,notify]=useState('');const [busy,wait]=useState(false);
  const [options,preview]=useState<Draft[]>([]);
  const [coverage,setCoverage]=useState<Awaited<ReturnType<typeof api.coverage>>|null>(null);
  const states={pass:'cumple',fail:'con diferencias',skip:'no evaluada',pending:'pendiente'};
  const select=(d:Draft)=>{set(d);text(JSON.stringify(d.rules,null,2));};
  async function action(fn:()=>Promise<string>){wait(true);try{notify(await fn());}catch(e){notify(e instanceof Error?e.message:'Operación fallida');}finally{wait(false);}}
  return <Panel title="Reglas de API del proyecto"><details><summary className="cursor-pointer">Editar contrato o importar OpenAPI</summary><div className="mt-3 grid gap-3">
    <p className="text-xs text-sky/70">Se aplica la última versión al coincidir proyecto, método y URL exacta. Seguridad observa GET; en k6 se usa el método del escenario.</p>
    <label className="text-xs">Previsualizar OpenAPI 3 o Swagger 2 (JSON/YAML, esquemas en línea)<input className="block" type="file" accept=".yaml,.yml,.json" onChange={e=>{const file=e.target.files?.[0];if(!file)return;void action(async()=>{
      preview([]);if(file.size>1048576)throw Error('Máximo 1 MB');const {parse}=await import('yaml');const doc=parse(await file.text(),{maxAliasCount:20});
      if(!doc?.paths || !(doc.openapi||doc.swagger))throw Error('No se reconoció la especificación');const proposals:Draft[]=[];
      for(const [route,entry] of Object.entries(doc.paths)){for(const [method,op] of Object.entries(entry as Record<string,Operation>)){
        if(!['get','post','put','patch','delete','head'].includes(method))continue;
        for(const [code,response] of Object.entries(op?.responses??{})){if(!/^2\d\d$/.test(code))continue;
          const mediaType=Object.keys(response.content??{})[0]??doc.produces?.[0];const schema=(mediaType?response.content?.[mediaType]?.schema:undefined)??response.schema;
          const base=doc.servers?.[0]?.url??(doc.host?`${doc.schemes?.[0]??'https'}://${doc.host}${doc.basePath??''}`:new URL(draft.url).origin);
          const url=new URL(base.replace(/\/$/,'')+route,new URL(draft.url).origin).href;
          proposals.push({...draft,url,method:method.toUpperCase(),status:Number(code),mediaType,rules:(schema?.required??[]).map(path=>{const t=schema?.properties?.[path]?.type;return t?{path,op:'type',value:t==='integer'?'number':t}:{path,op:'exists'};})});
        }
      }}preview(proposals);return `${proposals.length} propuestas. Selecciona una, revisa sus reglas y guarda.`;
    });}}/></label>
    {options.length>0&&<SelectField label="Propuesta" value="" onChange={e=>{if(e.target.value!=='')select(options[Number(e.target.value)]);}} options={[{value:'',label:'Seleccionar para editar'},...options.map((d,i)=>({value:String(i),label:`${d.method} ${d.url} · ${d.status}`}))]}/>}
    <TextField label="URL exacta" value={draft.url} onChange={e=>set({...draft,url:e.target.value})}/><SelectField label="Método" value={draft.method} onChange={e=>set({...draft,method:e.target.value})} options={['GET','POST','PUT','PATCH','DELETE','HEAD'].map(value=>({value,label:value}))}/>
    <Button disabled={busy} onClick={()=>void action(async()=>{const saved=await api.getContract(projectId,draft.url,draft.method);if(!saved)return 'Sin contrato guardado para esta ruta.';select(saved as unknown as Draft);return `Versión ${saved.version} cargada`;})}>Cargar versión actual</Button>
    <div className="grid gap-3 sm:grid-cols-2"><TextField label="Código HTTP" type="number" value={draft.status} onChange={e=>set({...draft,status:Number(e.target.value)})}/><TextField label="Content-Type" value={draft.mediaType??''} onChange={e=>set({...draft,mediaType:e.target.value||undefined})}/>
    <TextField label="Evaluar una de cada N iteraciones por usuario" type="number" value={draft.sampleEvery} onChange={e=>set({...draft,sampleEvery:Number(e.target.value)})}/><TextField label="Respuestas conformes mínimas (%)" type="number" value={draft.minPass} onChange={e=>set({...draft,minPass:Number(e.target.value)})}/></div>
    <TextAreaField label="Reglas JSON" rows={5} value={rules} onChange={e=>text(e.target.value)} hint={'Ej.: [{"path":"id","op":"exists"},{"path":"perfil.token","op":"absent"}]. Usa equals con value o type con value: string, number, boolean, object, array o null.'}/>
    <Button loading={busy} onClick={()=>void action(async()=>{const saved=await api.saveContract(projectId,{...draft,rules:JSON.parse(rules)});setCoverage(null);return `Guardado: contrato v${saved.version}`;})}>Guardar nueva versión</Button>    {message&&<p role="status" className="break-words">{message}</p>}
    <Button variant="ghost" disabled={busy} onClick={()=>void action(async()=>{setCoverage(await api.coverage(projectId));return '';})}>Consultar cobertura del proyecto</Button>
    {coverage && <div className="text-xs"><strong>{coverage.filter(c=>[c.stress,c.security].some(v=>v==='pass'||v==='fail')).length} de {coverage.length} operaciones declaradas evaluadas en su versión actual</strong>{coverage.map(c=><p key={c.version} className="mt-1 break-all">{c.method} {c.url} · v{c.version} · Estrés: {states[c.stress??'pending']} · Seguridad: {states[c.security??'pending']}</p>)}</div>}
  </div></details></Panel>;
}
