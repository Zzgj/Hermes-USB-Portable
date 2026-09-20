import {useRef,useEffect,useState,type ChangeEvent,type FormEvent} from 'react';
import {Panel} from '../components/Panel';
import {bindCapabilityInputs,importCapabilityDrafts,exportCapabilityDrafts,type Capability} from '../domain/capability';
import {capabilityCopy as copy} from '../data/mockData';
import {capabilityRunCopy as runCopy} from '../data/mockData';
import type {PreparedCapability} from '../domain/capability-run';
import {Link} from 'react-router-dom';
interface CapabilitiesPageProps {readonly ready?:boolean;readonly epoch?:number;readonly prepareRun?:(card:Capability,values:Readonly<Record<string,string>>,signal:AbortSignal)=>Promise<PreparedCapability>;readonly submitRun?:(draft:PreparedCapability)=>boolean;}
export function CapabilitiesPage({ready=false,epoch=0,prepareRun,submitRun}:CapabilitiesPageProps){
 const [cards,setCards]=useState<readonly Capability[]>([]),[selected,setSelected]=useState(''),[error,setError]=useState(false),[loading,setLoading]=useState(false);
 const [values,setValues]=useState<Record<string,string>>({}),[review,setReview]=useState<Readonly<Record<string,string>>|null>(null);
 const generation=useRef(0);useEffect(()=>()=>{generation.current++;},[]);
 const [prepared,setPrepared]=useState<PreparedCapability|null>(null),[confirmed,setConfirmed]=useState(false),[running,setRunning]=useState(false),[sent,setSent]=useState(false);
 const request=useRef<AbortController|null>(null);
 useEffect(()=>{setPrepared(null);setConfirmed(false);setRunning(false);return()=>{request.current?.abort();request.current=null;};},[epoch]);
 const execute=async(commit:boolean)=>{
  if(request.current||loading||!ready||!card||!review||!prepareRun||(commit&&(!prepared||!confirmed||!submitRun)))return;
  const controller=new AbortController();request.current=controller;setRunning(true);setError(false);const timer=setTimeout(()=>controller.abort(),15000);
  try{
   const next=await prepareRun(card,review,controller.signal);if(request.current!==controller)return;
   if(commit){
    if(!prepared||next.epoch!==prepared.epoch||next.port!==prepared.port||next.token!==prepared.token||next.prompt!==prepared.prompt||next.fingerprint!==prepared.fingerprint||!submitRun?.(next))throw new Error('CHANGED');
    setPrepared(null);setReview(null);setConfirmed(false);setSent(true);
   }else{setPrepared(next);setConfirmed(false);}
  }catch{if(request.current===controller){setError(true);setPrepared(null);setConfirmed(false);}}
  finally{clearTimeout(timer);if(request.current===controller){request.current=null;setRunning(false);}}
 };
 const card=cards.find(item=>item.id===selected);
 const choose=(id:string)=>{request.current?.abort();request.current=null;setRunning(false);setSelected(id);setValues({});setReview(null);setPrepared(null);setConfirmed(false);setSent(false);setError(false);};
 const load=async(event:ChangeEvent<HTMLInputElement>)=>{
  const file=event.target.files?.[0];event.target.value='';if(!file)return;
  request.current?.abort();request.current=null;setRunning(false);setReview(null);setPrepared(null);setConfirmed(false);setSent(false);
  const id=++generation.current;setLoading(true);setError(false);
  try{
   if(file.size>65536)throw new Error('Too large');
   const imported=importCapabilityDrafts(await file.text());if(id!==generation.current)return;
   setCards(imported);choose(imported[0].id);
  }catch{if(id===generation.current)setError(true);}
  finally{if(id===generation.current)setLoading(false);}
 };
 const prepare=(event:FormEvent)=>{
  event.preventDefault();if(!card||running)return;setPrepared(null);setConfirmed(false);setSent(false);
  try{setReview(bindCapabilityInputs(card,values));setError(false);}catch{setReview(null);setError(true);}
 };
 const save=()=>{
  let url:string|undefined;
  try{
   const raw=exportCapabilityDrafts(cards);
   url=URL.createObjectURL(new Blob([raw],{type:'application/json;charset=utf-8'}));
   const link=document.createElement('a');link.href=url;link.download='hermes-capability-drafts.json';
   document.body.append(link);try{link.click();}finally{link.remove();}
   setError(false);
  }catch{setError(true);}
  finally{if(url){const downloadUrl=url;setTimeout(()=>URL.revokeObjectURL(downloadUrl),1000);}}
 };
 return <>
  <div className="page-heading"><div><h1>{copy.title}</h1><p>{copy.intro}</p></div></div>
  <Panel title={copy.importTitle} className="mb-5">
   <p>{copy.importHelp}</p><label className="block mt-3">{copy.importLabel}<input type="file" accept="application/json,.json" disabled={loading||running} onChange={load} className="block my-3"/></label>
   <button type="button" className="button" disabled={loading||!cards.length} onClick={save}>{copy.exportLabel}</button><p className="mt-3">{copy.exportHelp}</p>
   {loading&&<p role="status">{copy.loading}</p>}{error&&<p role="alert">{copy.error}</p>}
  </Panel>
  {!cards.length&&<Panel><p>{copy.empty}</p></Panel>}
  <div className="grid lg:grid-cols-2 gap-5">
   {cards.length>0&&<Panel title={copy.drafts}><ul className="space-y-3">{cards.map(item=><li key={item.id}><button className="button w-full text-left" aria-pressed={selected===item.id} onClick={()=>choose(item.id)} disabled={loading}>{item.name}</button></li>)}</ul></Panel>}
   {card&&<Panel title={card.name}><span className="badge">{copy.draft}</span><p className="my-3 whitespace-pre-wrap break-words">{card.goal}</p>
    <dl className="break-all"><dt>{copy.method}</dt><dd>{card.method.kind}{' · '}{card.method.name}</dd><dt>{copy.fingerprint}</dt><dd>{card.method.fingerprint}</dd></dl>
    <form onSubmit={prepare} className="mt-5 space-y-3">{card.inputs.map(input=><label key={input.id} className="block">{input.label}{input.required?copy.required:copy.optional}<input className="workflow-input" disabled={running} required={input.required} value={values[input.id]??''} maxLength={4000} onChange={event=>{setValues(old=>({...old,[input.id]:event.target.value}));setReview(null);setPrepared(null);setConfirmed(false);}}/></label>)}<button className="button" disabled={loading||running}>{copy.review}</button></form>
    {review&&<section className="mt-4"><h3>{copy.reviewTitle}</h3><pre className="whitespace-pre-wrap break-all my-3">{JSON.stringify(review,null,2)}</pre><p>{runCopy.help}</p><button className="button mt-3" disabled={!ready||running||card.method.kind!=='skill'} onClick={()=>void execute(false)}>{runCopy.prepare}</button></section>}
    {prepared&&<section className="mt-4"><pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all">{prepared.prompt}</pre><label className="block my-3"><input type="checkbox" checked={confirmed} disabled={running} onChange={event=>setConfirmed(event.target.checked)}/>{runCopy.confirm}</label><button className="button" disabled={!ready||running||!confirmed} onClick={()=>void execute(true)}>{runCopy.submit}</button></section>}
    {sent&&<p role="status">{runCopy.sent}</p>}<Link className="button mt-3" to="/chat/live">{runCopy.chat}</Link>
   </Panel>}
  </div>
 </>;
}
