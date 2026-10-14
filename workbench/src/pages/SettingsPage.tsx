
import {Panel} from '../components/Panel';
import {updateCopy} from '../data/mockData';
import {useEntryCapabilities} from '../hooks/useEntryCapabilities';
import {EntryCapabilitiesPanel} from '../components/EntryCapabilitiesPanel';
interface SettingsPageProps {readonly demo?:boolean;readonly managementToken?:string;}

/** Update channels remain placeholder; entry detection is connected to the management service. */
export function SettingsPage({managementToken}:SettingsPageProps){
 const entryToken=managementToken??'';
 const{rows,loading,failed,inspect}=useEntryCapabilities(entryToken);
 return <>
  <div className="page-heading"><div><h1>{updateCopy.centerTitle}</h1><p>{updateCopy.noAutoApply}</p></div></div>
  {[{title:updateCopy.kernelTitle,help:updateCopy.kernelHelp},{title:updateCopy.shellTitle,help:updateCopy.shellHelp}].map(channel=>
   <Panel key={channel.title} title={channel.title} className="mb-5">
    <p>{channel.help}</p>
    <p role="status" className="my-3">{updateCopy.unavailable}</p>
    <button className="button" disabled>{updateCopy.checkButton}</button>
   </Panel>)}
  <EntryCapabilitiesPanel rows={rows} loading={loading} failed={failed} canInspect={Boolean(entryToken.trim())} onInspect={()=>void inspect()}/>
 </>;
}
