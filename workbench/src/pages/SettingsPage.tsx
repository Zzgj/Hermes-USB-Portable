
import {Panel} from '../components/Panel';
import {updateCopy} from '../data/mockData';
import {useEntryDetect} from '../hooks/useEntryDetect';
import {entryLabel,type EntryStatus} from '../domain/entry-detect';
interface SettingsPageProps {readonly demo?:boolean;readonly managementToken?:string;}
function entryLine(e:EntryStatus){return entryLabel(e.kind)+': '+(e.available?updateCopy.entryAvailableShort:updateCopy.entryNotAvailable)+' — '+e.note;}
/** Update channels remain placeholder; entry detection is connected to the management service. */
export function SettingsPage({managementToken}:SettingsPageProps){
 const entryToken=managementToken??'';
 const{entries,loading,error,detect}=useEntryDetect(entryToken);
 let entryStatus:string;
 if(loading)entryStatus=updateCopy.entryChecking;
 else if(error)entryStatus=updateCopy.entryRetry;
 else if(entries&&entries.length>0)entryStatus=updateCopy.entryAvailable;
 else if(error===null&&!entries)entryStatus=updateCopy.entryUnavailable;
 else if(error===null&&entries&&entries.length===0)entryStatus=updateCopy.entryEmpty;
 else entryStatus=updateCopy.entryRetry;
 return <>
  <div className="page-heading"><div><h1>{updateCopy.centerTitle}</h1><p>{updateCopy.noAutoApply}</p></div></div>
  {[{title:updateCopy.kernelTitle,help:updateCopy.kernelHelp},{title:updateCopy.shellTitle,help:updateCopy.shellHelp}].map(channel=>
   <Panel key={channel.title} title={channel.title} className="mb-5">
    <p>{channel.help}</p>
    <p role="status" className="my-3">{updateCopy.unavailable}</p>
    <button className="button" disabled>{updateCopy.checkButton}</button>
   </Panel>)}
  <Panel title={updateCopy.entryTitle} className="mb-5">
   <p>{updateCopy.entryHelp}</p>
   <p role={error?'alert':'status'} className="my-3">{entryStatus}</p>
   {!loading&&!error&&entryToken&&entries&&<ul>{entries.map(e=><li key={e.kind}>{entryLine(e)}</li>)}</ul>}
   <button className="button" disabled={loading||!entryToken} onClick={()=>detect(entryToken)}>{loading?updateCopy.entryChecking:updateCopy.entryCheckButton}</button>
  </Panel>
 </>;
}
