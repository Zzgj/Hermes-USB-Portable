import {Link,useNavigate} from 'react-router-dom';
import {useState} from 'react';
import {Panel} from '../components/Panel';
import type {useLiveChat} from '../hooks/useLiveChat';
import {summarizeTask,exportTaskObservations} from '../domain/task-summary';
import {taskCopy as copy,liveCopy,taskCapabilityCopy} from '../data/mockData';
interface LiveTasksPageProps {readonly chat:ReturnType<typeof useLiveChat>;}
export function LiveTasksPage({chat}:LiveTasksPageProps){
 const navigate=useNavigate();
 const [exportFailed,setExportFailed]=useState(false);
 const turns=[...chat.history.flatMap(record=>record.role==='assistant'?[record.turn]:[]),...(chat.turn?[chat.turn]:[])];
 const snapshot=()=>turns.map((turn,index)=>summarizeTask(turn,{connected:chat.phase==='ready',approval:index===turns.length-1&&chat.approval,stopping:index===turns.length-1&&chat.stopping}));
 const exportReport=()=>{
  try{
   const raw=exportTaskObservations(snapshot()),url=URL.createObjectURL(new Blob([raw],{type:'application/json;charset=utf-8'}));
   try{const link=document.createElement('a');link.href=url;link.download='hermes-task-observations.json';document.body.append(link);try{link.click();}finally{link.remove();}}
   finally{setTimeout(()=>URL.revokeObjectURL(url),1000);}setExportFailed(false);
  }catch{setExportFailed(true);}
 };
 return <>
  <div className="page-heading"><div><h1>{copy.title}</h1><p>{copy.help}</p></div><Link className="button" to="/chat/live">{copy.chat}</Link></div>
  <Panel className="mb-5"><p role="status">{liveCopy.phases[chat.phase]}</p><p className="mt-3">{copy.lifetime}</p><p className="mt-3">{copy.verification}</p></Panel>
  <Panel className="mb-5"><p>{taskCapabilityCopy.exportHelp}</p><button className="button mt-3" disabled={!turns.length||turns.length>100} onClick={exportReport}>{taskCapabilityCopy.export}</button>{exportFailed&&<p role="alert">{taskCapabilityCopy.exportError}</p>}</Panel>
  {!turns.length&&<Panel><p>{copy.empty}</p></Panel>}
  <div className="space-y-4">{turns.map((turn,index)=>{
   const current=index===turns.length-1;
   const task=summarizeTask(turn,{connected:chat.phase==='ready',approval:current&&chat.approval,stopping:current&&chat.stopping});
   return <Panel key={`${turn.sessionId}-${index}`} title={`${copy.round} ${index+1}`}>
    <p role="status">{copy.states[task.status]}</p><p className="break-all my-3">{copy.session}{' · '}{task.sessionId}</p>
    {task.capability&&<dl className="break-all my-3"><dt>{taskCapabilityCopy.card}</dt><dd>{task.capability.cardId}</dd><dt>{taskCapabilityCopy.fingerprint}</dt><dd>{task.capability.methodFingerprint}</dd><dt>{taskCapabilityCopy.verification}</dt><dd>{taskCapabilityCopy.unverified}</dd></dl>}
    {task.tools.length===0?<p>{copy.noTools}</p>:<ul className="space-y-2">{task.tools.map(tool=><li key={tool.id} className="break-all">{tool.name}{' · '}{liveCopy.toolStates[tool.status]}</li>)}</ul>}
    {task.toolsTruncated&&<p>{liveCopy.toolsTruncated}</p>}
    <button className="button mt-3" disabled={turn.status==='streaming'||chat.phase!=='ready'||chat.busy} onClick={()=>{if(chat.selectLearningSource(turn))navigate('/chat/live');}}>{taskCapabilityCopy.learn}</button>
    {current&&turn.status==='streaming'&&chat.phase==='ready'&&<div className="flex gap-3 mt-4"><Link className="button" to="/chat/live">{copy.chat}</Link><button className="button" disabled={chat.stopping} onClick={chat.stop}>{chat.stopping?liveCopy.stopping:liveCopy.stop}</button></div>}
   </Panel>;
  })}</div>
  <Link className="button mt-5" to="/tasks/demo">{copy.demo}</Link>
 </>;
}
