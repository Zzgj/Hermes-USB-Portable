import {useEffect,useRef,useState} from 'react';
import {Panel} from './Panel';
import {controlRequest,type ControlAction,type ControlState,type ManagedConnection} from '../domain/control';
import {serviceCopy} from '../data/mockData';
import {readControlBootstrap} from '../domain/bootstrap';
import {prepareLearning,type LearnDraft} from '../domain/learn';
import {learnCopy} from '../data/mockData';
import {fetchCapabilityDrafts} from '../domain/capability';
import {catalogCopy} from '../data/mockData';
interface ServiceControlsProps {readonly canConnect:boolean;readonly onConnected:(connection:ManagedConnection)=>void;readonly onStopped:()=>void;readonly onLearnPrepared?:(draft:LearnDraft)=>void;}
export function ServiceControls({canConnect,onConnected,onStopped,onLearnPrepared}:ServiceControlsProps){
 const [input,setInput]=useState(''),[state,setState]=useState<ControlState|'unknown'>('unknown'),[busy,setBusy]=useState(false),[failed,setFailed]=useState(false),[confirmed,setConfirmed]=useState(false);
 const credential=useRef(''),pending=useRef<AbortController|null>(null);
 const [learnSource,setLearnSource]=useState(''),[learnScope,setLearnScope]=useState('');
 const exportCatalog=async()=>{
  const token=input.trim()||credential.current;if(pending.current||!token||state!=='ready')return;
  credential.current=token;setInput('');setBusy(true);setFailed(false);
  const controller=new AbortController();pending.current=controller;const timer=setTimeout(()=>controller.abort(),15000);
  try{
   const raw=await fetchCapabilityDrafts(token,controller.signal);if(pending.current!==controller)return;
   const url=URL.createObjectURL(new Blob([raw],{type:'application/json;charset=utf-8'}));
   try{const link=document.createElement('a');link.href=url;link.download='hermes-instance-skill-drafts.json';document.body.append(link);try{link.click();}finally{link.remove();}}
   finally{setTimeout(()=>URL.revokeObjectURL(url),1000);}
  }catch{if(pending.current===controller)setFailed(true);}
  finally{clearTimeout(timer);if(pending.current===controller){pending.current=null;setBusy(false);}}
 };
 const prepare=async()=>{
  const token=input.trim()||credential.current;
  if(pending.current||!token||state!=='ready'||canConnect||!onLearnPrepared)return;
  credential.current=token;setInput('');setBusy(true);setFailed(false);
  const controller=new AbortController();pending.current=controller;const timer=setTimeout(()=>controller.abort(),15000);
  try{const draft=await prepareLearning(token,learnSource,learnScope,controller.signal);if(pending.current===controller)onLearnPrepared(draft);}
  catch{if(pending.current===controller)setFailed(true);}
  finally{clearTimeout(timer);if(pending.current===controller){pending.current=null;setBusy(false);}}
 };
 useEffect(()=>{
  const bootstrap=readControlBootstrap(window.location.hash);
  if(bootstrap){window.history.replaceState(null,'',window.location.pathname+window.location.search+bootstrap.cleanHash);if(window.location.hostname==='127.0.0.1')setInput(bootstrap.token);}
 },[]);
 useEffect(()=>()=>{pending.current?.abort();pending.current=null;credential.current='';},[]);
 const run=async(action:ControlAction)=>{
  if(pending.current||(action==='stop'&&!confirmed))return;
  const token=input.trim()||credential.current;if(!token)return;
  credential.current=token;setInput('');setBusy(true);setFailed(false);
  const controller=new AbortController();pending.current=controller;
  const timer=setTimeout(()=>controller.abort(),75000);
  try{
   const result=await controlRequest(action,token,controller.signal);
   if(pending.current!==controller)return;
   setState(result.state);setConfirmed(false);
   if(result.connection)onConnected(result.connection);
   if(action==='stop'&&result.state==='idle')onStopped();
  }catch{if(pending.current===controller){setState('unknown');setFailed(true);}}
  finally{clearTimeout(timer);if(pending.current===controller){pending.current=null;setBusy(false);}}
 };
 const authenticated=!!(input.trim()||credential.current);
 return <Panel title={serviceCopy.title} className="mb-5">
  <p>{serviceCopy.help}</p><p role="status">{busy?serviceCopy.pending:serviceCopy.states[state]}</p>
  <label>{serviceCopy.token}<input type="password" autoComplete="off" className="workflow-input" disabled={busy} value={input} onChange={event=>{setInput(event.target.value);credential.current='';setState('unknown');}}/></label>
  <div className="flex flex-wrap gap-3 my-4">
   <button className="button" disabled={busy||!authenticated} onClick={()=>void run('status')}>{serviceCopy.check}</button>
   <button className="button primary" disabled={busy||!authenticated||state!=='idle'||!canConnect} onClick={()=>void run('start')}>{serviceCopy.start}</button>
   <button className="button" disabled={busy||!authenticated||state!=='ready'||!canConnect} onClick={()=>void run('connection')}>{serviceCopy.connect}</button>
  </div>
  <label><input type="checkbox" checked={confirmed} disabled={busy} onChange={event=>setConfirmed(event.target.checked)}/>{serviceCopy.confirm}</label>
  <button className="button ml-3" disabled={busy||!authenticated||!confirmed||state==='idle'} onClick={()=>void run('stop')}>{serviceCopy.stop}</button>
  {failed&&<p role="alert">{serviceCopy.error}</p>}
  <details className="mt-5"><summary>{catalogCopy.title}</summary><p className="my-3">{catalogCopy.help}</p><button className="button" disabled={busy||!authenticated||state!=='ready'} onClick={()=>void exportCatalog()}>{catalogCopy.export}</button></details>
  <details className="mt-5"><summary>{learnCopy.prepareTitle}</summary><p className="my-3">{learnCopy.prepareHelp}</p>
   <label className="block">{learnCopy.source}<textarea className="workflow-input" maxLength={4000} disabled={busy} value={learnSource} onChange={event=>setLearnSource(event.target.value)}/></label>
   <label className="block">{learnCopy.scope}<textarea className="workflow-input" maxLength={4000} disabled={busy} value={learnScope} onChange={event=>setLearnScope(event.target.value)}/></label>
   <button className="button mt-3" disabled={busy||!authenticated||state!=='ready'||canConnect||!learnSource.trim()||!learnScope.trim()} onClick={()=>void prepare()}>{learnCopy.prepare}</button>
  </details>
 </Panel>;
}
