import {useRef,useEffect,useState,type ChangeEvent,type FormEvent} from 'react';
import {Link} from 'react-router-dom';
import {Panel} from '../components/Panel';
import {bindCapabilityInputs,importCapabilityDrafts,exportCapabilityDrafts,type Capability} from '../domain/capability';
import {capabilityCopy as copy,executionCopy as execCopy,evidenceCopy as evCopy} from '../data/mockData';
import type {useLiveChat} from '../hooks/useLiveChat';
interface CapabilitiesPageProps {readonly chat?:ReturnType<typeof useLiveChat>;readonly experimental?:boolean;}
export function CapabilitiesPage({chat}:CapabilitiesPageProps){
 const [cards,setCards]=useState<readonly Capability[]>([]),[selected,setSelected]=useState(''),[error,setError]=useState(false),[loading,setLoading]=useState(false);
 const [values,setValues]=useState<Record<string,string>>({}),[review,setReview]=useState<Readonly<Record<string,string>>|null>(null);
 const [confirmed,setConfirmed]=useState(false);
 const generation=useRef(0);useEffect(()=>()=>{generation.current++;},[]);
 const card=cards.find(item=>item.id===selected);
 const connected=chat?.phase==='ready';
 const exec=chat?.execution;
 const execForCard=exec?.capabilityId===selected;
 const execPhase=execForCard&&chat?chat.executionPhase:'idle';
 const choose=(id:string)=>{setSelected(id);setValues({});setReview(null);setError(false);setConfirmed(false);chat?.clearExecution();};
 const load=async(event:ChangeEvent<HTMLInputElement>)=>{
  const file=event.target.files?.[0];event.target.value='';if(!file)return;
  const id=++generation.current;setLoading(true);setError(false);
  try{
   if(file.size>65536)throw new Error('Too large');
   const imported=importCapabilityDrafts(await file.text());if(id!==generation.current)return;
   setCards(imported);choose(imported[0].id);
  }catch{if(id===generation.current)setError(true);}
  finally{if(id===generation.current)setLoading(false);}
 };
 const prepare=(event:FormEvent)=>{
  event.preventDefault();if(!card)return;
  try{
   const bound=bindCapabilityInputs(card,values);setReview(bound);setError(false);setConfirmed(false);
   if(chat&&connected)chat.prepareExecution(card,bound);
  }catch{setReview(null);setError(true);}
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
 const canExecute=!!(chat&&connected&&review&&execForCard&&exec?.check.status==='match'&&!exec.confirmed&&!chat.busy&&confirmed);
 return <>
  <div className="page-heading"><div><h1>{copy.title}</h1><p>{copy.intro}</p></div></div>
  <Panel title={copy.importTitle} className="mb-5">
   <p>{copy.importHelp}</p><label className="block mt-3">{copy.importLabel}<input type="file" accept="application/json,.json" disabled={loading} onChange={load} className="block my-3"/></label>
   <button type="button" className="button" disabled={loading||!cards.length} onClick={save}>{copy.exportLabel}</button><p className="mt-3">{copy.exportHelp}</p>
   {loading&&<p role="status">{copy.loading}</p>}{error&&<p role="alert">{copy.error}</p>}
  </Panel>
  {!cards.length&&<Panel><p>{copy.empty}</p></Panel>}
  <div className="grid lg:grid-cols-2 gap-5">
   {cards.length>0&&<Panel title={copy.drafts}><ul className="space-y-3">{cards.map(item=><li key={item.id}><button className="button w-full text-left" aria-pressed={selected===item.id} onClick={()=>choose(item.id)} disabled={loading}>{item.name}</button></li>)}</ul></Panel>}
   {card&&<Panel title={card.name}><span className="badge">{copy.draft}</span><p className="my-3 whitespace-pre-wrap break-words">{card.goal}</p>
    <dl className="break-all"><dt>{copy.method}</dt><dd>{card.method.kind}{' · '}{card.method.name}</dd><dt>{copy.fingerprint}</dt><dd>{card.method.fingerprint}</dd></dl>
    <form onSubmit={prepare} className="mt-5 space-y-3">{card.inputs.map(input=><label key={input.id} className="block">{input.label}{input.required?copy.required:copy.optional}<input className="workflow-input" required={input.required} value={values[input.id]??''} maxLength={4000} onChange={event=>{setValues(old=>({...old,[input.id]:event.target.value}));setReview(null);setConfirmed(false);}}/></label>)}<button className="button" disabled={loading}>{copy.review}</button></form>
    {review&&<section className="mt-4"><h3>{copy.reviewTitle}</h3><pre className="whitespace-pre-wrap break-all my-3">{JSON.stringify(review,null,2)}</pre>
     {!connected&&<p className="mt-3">{execCopy.notConnected}</p>}
     {connected&&card.method.kind==='bundle'&&<p className="mt-3">{execCopy.bundleUnsupported}</p>}
     {connected&&card.method.kind==='skill'&&<div className="mt-4"><h3>{execCopy.instanceCatalog}</h3><p className="my-2">{execCopy.catalogHelp}</p>
      <button type="button" className="button" disabled={chat?.catalogLoading||chat?.busy} onClick={()=>chat?.loadInstanceCatalog()}>{chat?.catalogLoading?execCopy.catalogLoading:execCopy.loadCatalog}</button>
      {chat?.catalogLoaded&&chat.instanceCards.length===0&&<p className="mt-2">{execCopy.catalogEmpty}</p>}
      {chat?.catalogLoaded&&chat.instanceCards.length>0&&<p className="mt-2">{execCopy.catalogLoaded}</p>}
     </div>}
     {execForCard&&exec?.check.status==='match'&&!exec?.confirmed&&<section className="mt-4"><h3>{execCopy.reviewScope}</h3><p className="my-2">{execCopy.reviewScopeHelp}</p>
      <dl><dt>{execCopy.applicability}</dt><dd>{execCopy.applicabilityUnknown}</dd></dl>
      <p className="my-2">{execCopy.costWarning}</p><p className="my-2">{execCopy.toolWarning}</p>
      <label className="block my-3"><input type="checkbox" checked={confirmed} disabled={chat?.busy} onChange={event=>setConfirmed(event.target.checked)}/>{execCopy.confirmCheckbox}</label>
      <button type="button" className="button primary" disabled={!canExecute} onClick={()=>chat?.confirmExecution()}>{execCopy.confirmExecute}</button>
     </section>}
     {connected&&chat?.catalogLoaded&&chat.instanceCards.length>0&&<section className="mt-4"><h3>{evCopy.title}</h3><p className="my-2">{evCopy.evidenceHelp}</p>
      <button type="button" className="button" disabled={chat.evidenceLoading||chat.busy} onClick={()=>chat.loadInstanceEvidence()}>{chat.evidenceLoading?evCopy.evidenceLoading:evCopy.loadEvidence}</button>
      {chat.evidenceLoaded&&chat.evidence.length===0&&<p className="mt-2">{evCopy.evidenceEmpty}</p>}
      {chat.evidenceLoaded&&chat.evidence.length>0&&<p className="mt-2">{evCopy.evidenceLoaded}</p>}
      {chat.evidenceLoaded&&chat.evidence.some(item=>!item.trusted)&&<p className="mt-2">{evCopy.importedUntrusted}</p>}
      {card&&chat.evidenceLoaded&&<p className="mt-2">{evCopy.statusUnknown}</p>}
     </section>}
     {execForCard&&exec?.confirmed&&<section className="mt-4"><h3>{execCopy.title}</h3>
      <p role="status">{execCopy.phases[execPhase]}</p>
      {chat?.approval&&<p className="mt-3"><Link className="button" to="/chat/live">{execCopy.approvalPending}</Link></p>}
      {execPhase!=='observing'&&<section className="mt-3"><h4>{evCopy.learnAssociation}</h4><p className="my-2">{evCopy.learnAssociationHelp}</p>
       <button type="button" className="button" disabled={chat?.catalogLoading||chat?.busy} onClick={()=>chat?.loadInstanceCatalog()}>{evCopy.reReadCatalog}</button>
       <p className="mt-3"><Link className="button" to="/chat/live">{execCopy.goToChat}</Link>{' '}<button type="button" className="button ml-3" onClick={()=>{chat?.clearExecution();setConfirmed(false);}}>{execCopy.clearExecution}</button></p>
      </section>}
     </section>}
    </section>}
   </Panel>}
  </div>
 </>;
}
