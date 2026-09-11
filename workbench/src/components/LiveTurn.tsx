import type {ChatTurn} from '../domain/chat-events';
import {liveCopy} from '../data/mockData';
interface LiveTurnProps {readonly turn:ChatTurn;readonly disconnected?:boolean;}
export function LiveTurn({turn,disconnected=false}:LiveTurnProps){
 return <div>
  <p className="message">{turn.text}</p>
  <p>{disconnected&&turn.status==='streaming'?liveCopy.uncertain:liveCopy.turnStates[turn.status]}</p>
  {turn.truncated&&<p>{liveCopy.truncated}</p>}
  {turn.tools.length>0&&<details className="my-4" open={turn.status==='streaming'}>
   <summary className="cursor-pointer">{liveCopy.tools}{' · '}{turn.tools.length}</summary>
   <p>{liveCopy.toolHelp}</p>
   <ul className="mt-4 space-y-2">{turn.tools.map(tool=><li key={tool.id} className="break-all">
    <span>{tool.name}</span>{' · '}<span>{liveCopy.toolStates[tool.status==='running'&&disconnected?'unknown':tool.status]}</span>
    {tool.duration!==undefined&&<span>{' · '}{tool.duration.toFixed(1)} {liveCopy.seconds}</span>}
   </li>)}</ul>
   {turn.toolsTruncated&&<p>{liveCopy.toolsTruncated}</p>}
  </details>}
 </div>;
}
