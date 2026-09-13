import {useEffect,useRef,useState} from 'react';
import {Panel} from '../components/Panel';
import {updateCopy} from '../data/mockData';
import type {UpdateSummary,UpdatePlan,UpdateChannel,CheckOutcome} from '../domain/update-check';
import {shouldRetry,canInstall} from '../domain/update-check';
import type {EntryStatus} from '../domain/entry-detect';
import {entryLabel} from '../domain/entry-detect';
interface SettingsPageProps {readonly demo?:boolean;}
const OUTCOME_TEXT:Record<CheckOutcome,string>={idle:'',checking:updateCopy.checking,'up-to-date':updateCopy.upToDate,available:updateCopy.available,'not-available':updateCopy.notAvailable,incompatible:updateCopy.incompatible,offline:updateCopy.offline,failed:updateCopy.failed};
function ChannelPanel({channel,title,help,currentVersion}:{readonly channel:UpdateChannel;readonly title:string;readonly help:string;readonly currentVersion:string;}){
 const [summary,setSummary]=useState<UpdateSummary|null>(null),[failures,setFailures]=useState(0),[checking,setChecking]=useState(false),[plan,setPlan]=useState<UpdatePlan|null>(null),[planning,setPlanning]=useState(false),[confirmed,setConfirmed]=useState(false),[installing,setInstalling]=useState(false),[error,setError]=useState(false);
 const failureRef=useRef(0),timer=useRef<ReturnType<typeof setTimeout>|null>(null);
 useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current);},[]);
 const check=()=>{
  if(checking)return;setChecking(true);setError(false);
  if(summary&&shouldRetry(summary,Date.now())){failureRef.current+=1;setFailures(failureRef.current);}
  timer.current=setTimeout(()=>{
   setSummary({channel,outcome:'not-available',currentVersion,checkedAt:new Date().toISOString(),retryAfterMs:0});
   setChecking(false);setFailures(0);failureRef.current=0;
  },500);
 };
 const planUpdate=()=>{
  if(planning||!summary||summary.outcome!=='available')return;setPlanning(true);setError(false);
  timer.current=setTimeout(()=>{
   setPlan({channel,targetVersion:summary.latestVersion??currentVersion,backup:true,changelogSummary:updateCopy.mockChangelog,compatibilityGate:'unknown'});
   setPlanning(false);
  },300);
 };
 const install=()=>{
  if(installing||!canInstall(plan)||!confirmed)return;setInstalling(true);
  timer.current=setTimeout(()=>{setInstalling(false);setPlan(null);setConfirmed(false);},500);
 };
 return <Panel title={title} className="mb-5" aria-busy={checking||planning||installing}><p className="my-3">{help}</p>
  <dl className="mb-3"><dt className="inline mr-2">{updateCopy.current}{': '}</dt><dd className="inline font-mono">{currentVersion}</dd></dl>
  <div className="flex flex-wrap gap-3 my-3">
   <button className="button" disabled={checking} onClick={check}>{checking?updateCopy.checking:updateCopy.checkButton}</button>
   {summary?.outcome==='available'&&<button className="button" disabled={planning} onClick={planUpdate}>{planning?updateCopy.checking:updateCopy.planButton}</button>}
  </div>
  {summary&&<p role="status" className="my-2">{OUTCOME_TEXT[summary.outcome]}</p>}
  {summary&&summary.latestVersion&&<dl className="mb-3"><dt className="inline mr-2">{updateCopy.latest}{': '}</dt><dd className="inline font-mono">{summary.latestVersion}</dd></dl>}
  {summary&&(summary.outcome==='offline'||summary.outcome==='failed')&&summary.retryAfterMs>0&&<p className="my-2 text-sm">{updateCopy.retryAfter}{': '}{Math.ceil(summary.retryAfterMs/1000)}{'s '}{updateCopy.offlineBackoff}</p>}
  {plan&&<section className="mt-4 space-y-2">
   <dl><dt className="inline mr-2">{updateCopy.backup}{': '}</dt><dd className="inline">{plan.backup?updateCopy.yes:updateCopy.no}</dd></dl>
   <dl><dt className="inline mr-2">{updateCopy.changelog}{': '}</dt><dd className="inline">{plan.changelogSummary}</dd></dl>
   <dl><dt className="inline mr-2">{updateCopy.compatibility}{': '}</dt><dd className="inline">{plan.compatibilityGate==='passed'?updateCopy.gatePassed:plan.compatibilityGate==='unknown'?updateCopy.gateUnknown:updateCopy.gateBlocked}</dd></dl>
   <label className="block my-3"><input type="checkbox" checked={confirmed} disabled={installing} onChange={event=>setConfirmed(event.target.checked)}/>{updateCopy.installConfirmed}</label>
   <button className="button primary" disabled={!canInstall(plan)||!confirmed||installing} onClick={install}>{installing?updateCopy.checking:updateCopy.installButton}</button>
  </section>}
  {error&&<p role="alert" className="my-2">{updateCopy.failed}</p>}
 </Panel>;
}
function EntryPanel(){
 const [entries,setEntries]=useState<readonly EntryStatus[]|null>(null),[checking,setChecking]=useState(false);
 const timer=useRef<ReturnType<typeof setTimeout>|null>(null);
 useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current);},[]);
 const check=()=>{
  if(checking)return;setChecking(true);
  timer.current=setTimeout(()=>{setEntries([]);setChecking(false);},500);
 };
 return <Panel title={updateCopy.entryTitle} className="mb-5" aria-busy={checking}><p className="my-3">{updateCopy.entryHelp}</p>
  <button className="button my-3" disabled={checking} onClick={check}>{checking?updateCopy.entryChecking:updateCopy.entryCheckButton}</button>
  {entries&&entries.length===0&&<p className="my-3" role="status">{updateCopy.entryEmpty}</p>}
  {entries&&entries.length>0&&<ul className="my-3">{entries.map(entry=><li key={entry.kind} className="my-2 break-all">{entryLabel(entry.kind)}{entry.note&&<span className="ml-2">{entry.note}</span>}</li>)}</ul>}
 </Panel>;
}
export function SettingsPage(_:SettingsPageProps){
 return <>
  <div className="page-heading"><div><h1>{updateCopy.centerTitle}</h1><p>{updateCopy.noAutoApply}</p></div></div>
  <ChannelPanel channel="kernel" title={updateCopy.kernelTitle} help={updateCopy.kernelHelp} currentVersion="0.21.0"/>
  <ChannelPanel channel="shell" title={updateCopy.shellTitle} help={updateCopy.shellHelp} currentVersion="P2-dev"/>
  <EntryPanel/>
 </>;
}
