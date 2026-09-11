import {useRef,useEffect,useState,type ChangeEvent,type FormEvent} from 'react';
import {Panel} from '../components/Panel';
import {bindCapabilityInputs,importCapabilityDrafts,exportCapabilityDrafts,type Capability} from '../domain/capability';
import {capabilityCopy as copy} from '../data/mockData';
interface CapabilitiesPageProps {readonly experimental?:boolean;}
export function CapabilitiesPage(_:CapabilitiesPageProps){
 const [cards,setCards]=useState<readonly Capability[]>([]),[selected,setSelected]=useState(''),[error,setError]=useState(false),[loading,setLoading]=useState(false);
 const [values,setValues]=useState<Record<string,string>>({}),[review,setReview]=useState<Readonly<Record<string,string>>|null>(null);
 const generation=useRef(0);useEffect(()=>()=>{generation.current++;},[]);
 const card=cards.find(item=>item.id===selected);
 const choose=(id:string)=>{setSelected(id);setValues({});setReview(null);setError(false);};
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
   <p>{copy.importHelp}</p><label className="block mt-3">{copy.importLabel}<input type="file" accept="application/json,.json" disabled={loading} onChange={load} className="block my-3"/></label>
   <button type="button" className="button" disabled={loading||!cards.length} onClick={save}>{copy.exportLabel}</button><p className="mt-3">{copy.exportHelp}</p>
   {loading&&<p role="status">{copy.loading}</p>}{error&&<p role="alert">{copy.error}</p>}
  </Panel>
  {!cards.length&&<Panel><p>{copy.empty}</p></Panel>}
  <div className="grid lg:grid-cols-2 gap-5">
   {cards.length>0&&<Panel title={copy.drafts}><ul className="space-y-3">{cards.map(item=><li key={item.id}><button className="button w-full text-left" aria-pressed={selected===item.id} onClick={()=>choose(item.id)} disabled={loading}>{item.name}</button></li>)}</ul></Panel>}
   {card&&<Panel title={card.name}><span className="badge">{copy.draft}</span><p className="my-3 whitespace-pre-wrap break-words">{card.goal}</p>
    <dl className="break-all"><dt>{copy.method}</dt><dd>{card.method.kind}{' · '}{card.method.name}</dd><dt>{copy.fingerprint}</dt><dd>{card.method.fingerprint}</dd></dl>
    <form onSubmit={prepare} className="mt-5 space-y-3">{card.inputs.map(input=><label key={input.id} className="block">{input.label}{input.required?copy.required:copy.optional}<input className="workflow-input" required={input.required} value={values[input.id]??''} maxLength={4000} onChange={event=>{setValues(old=>({...old,[input.id]:event.target.value}));setReview(null);}}/></label>)}<button className="button" disabled={loading}>{copy.review}</button></form>
    {review&&<section className="mt-4"><h3>{copy.reviewTitle}</h3><pre className="whitespace-pre-wrap break-all my-3">{JSON.stringify(review,null,2)}</pre><p>{copy.executionPending}</p><button className="button mt-3" disabled>{copy.execute}</button></section>}
   </Panel>}
  </div>
 </>;
}
