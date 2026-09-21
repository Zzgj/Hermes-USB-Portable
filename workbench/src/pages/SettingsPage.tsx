import {Panel} from '../components/Panel';
import {updateCopy} from '../data/mockData';
interface SettingsPageProps {readonly demo?:boolean;}
/** No update/detection backend is connected yet. Never synthesize a successful check. */
export function SettingsPage(_:SettingsPageProps){
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
   <p role="status" className="my-3">{updateCopy.entryUnavailable}</p>
   <button className="button" disabled>{updateCopy.entryCheckButton}</button>
  </Panel>
 </>;
}
