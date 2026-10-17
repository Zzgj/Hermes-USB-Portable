import {useState} from 'react';
import {Panel} from './Panel';
import {nativeEntryCopy as copy} from '../data/mockData';
import type {NativeAction,NativeStatus} from '../domain/native-entry';
interface NativeEntryPanelProps{
 readonly status:NativeStatus;
 readonly pending:boolean;
 readonly failed:boolean;
 readonly canInspect:boolean;
 readonly onRefresh:()=>void;
 readonly onAction:(action:NativeAction)=>void;
}
export function NativeEntryPanel({status,pending,failed,canInspect,onRefresh,onAction}:NativeEntryPanelProps){
 const [confirmed,setConfirmed]=useState(false);
 const blocked=!canInspect||pending;
 const act=(action:NativeAction)=>{
  if(blocked||(action!=='stop'&&failed))return;
  if((action==='cli'||action==='dashboard')&&status.state!=='idle')return;
  if(action==='open'&&(status.kind!=='dashboard'||status.state!=='running'))return;
  if(action!=='open'&&!confirmed)return;setConfirmed(false);onAction(action);
 };
 const stateText=!canInspect?copy.unauthenticated:pending?copy.pending:failed?copy.failed:copy.states[status.state];
 return <Panel title={copy.title} className="mb-5">
  <p>{copy.help}</p>
  <p role="status" className="my-3">{stateText}</p>
  {canInspect&&!pending&&!failed&&status.kind?<p>{copy.kinds[status.kind]}</p>:null}
  <label className="my-3 block"><input type="checkbox" checked={confirmed} disabled={blocked} onChange={event=>setConfirmed(event.target.checked)}/>{copy.confirm}</label>
  <div className="flex flex-wrap gap-2">
   <button className="button" disabled={blocked} onClick={()=>{setConfirmed(false);onRefresh();}}>{copy.refresh}</button>
   <button className="button" disabled={blocked||failed||!confirmed||status.state!=='idle'} onClick={()=>act('cli')}>{copy.cli}</button>
   <button className="button" disabled={blocked||failed||!confirmed||status.state!=='idle'} onClick={()=>act('dashboard')}>{copy.dashboard}</button>
   <button className="button" disabled={blocked||failed||status.kind!=='dashboard'||status.state!=='running'} onClick={()=>act('open')}>{copy.open}</button>
   <button className="button" disabled={blocked||!confirmed||status.state==='idle'} onClick={()=>act('stop')}>{copy.stop}</button>
  </div>
 </Panel>;
}
