import type {RpcMessage} from './rpc';
type Event=Extract<RpcMessage,{kind:'event'}>;
export interface ToolActivity {
 readonly id:string;
 readonly name:string;
 readonly status:'running'|'finished'|'unknown';
 readonly duration?:number;
}
export interface ChatTurn {
 readonly sessionId:string;
 readonly seq:number;
 readonly text:string;
 readonly status:'streaming'|'complete'|'failed'|'interrupted';
 readonly truncated:boolean;
 readonly tools:readonly ToolActivity[];
 readonly toolsTruncated:boolean;
}
const maxText=200_000;
export type ChatRecord={readonly role:'user';readonly text:string}|{readonly role:'assistant';readonly turn:ChatTurn};
export function appendChatPrompt(history:readonly ChatRecord[],previous:ChatTurn|null,text:string):readonly ChatRecord[]{
 if(!text.trim()||previous?.status==='streaming')throw new Error('Cannot append an unfinished turn');
 return [...history,...(previous?[{role:'assistant' as const,turn:previous}]:[]),{role:'user',text}];
}
export function beginTurn(sessionId:string,seq=-1):ChatTurn {
 if(!sessionId)throw new Error('Session identity required');
 return {sessionId,seq,text:'',status:'streaming',truncated:false,tools:[],toolsTruncated:false};
}
/** Plain text only. Never render backend HTML/ANSI, execute payloads or mix sessions. */
export function reduceChatEvent(turn:ChatTurn,event:Event):ChatTurn {
 if(event.sessionId!==turn.sessionId||turn.status!=='streaming'||(event.seq!==undefined&&event.seq<=turn.seq))return turn;
 const payload=event.payload;
 if(typeof payload!=='object'||payload===null||Array.isArray(payload))return turn;
 const p=payload as Record<string,unknown>;
 if(event.type==='tool.start'||event.type==='tool.complete'){
  if(typeof p.tool_id!=='string'||!p.tool_id||p.tool_id.length>256||typeof p.name!=='string'||!p.name||p.name.length>256)return turn;
  const index=turn.tools.findIndex(tool=>tool.id===p.tool_id),existing=turn.tools[index];
  if(existing&&(existing.name!==p.name||existing.status==='finished'))return turn;
  if(index<0&&turn.tools.length>=100)return {...turn,seq:event.seq??turn.seq,toolsTruncated:true};
  const tool:ToolActivity={id:p.tool_id,name:p.name,status:event.type==='tool.complete'?'finished':'running',
   ...(event.type==='tool.complete'&&typeof p.duration_s==='number'&&Number.isFinite(p.duration_s)&&p.duration_s>=0?{duration:p.duration_s}:{})};
  const tools=[...turn.tools];if(index<0)tools.push(tool);else tools[index]=tool;
  // Completion is not proof of success; result/args may contain secrets and are not retained here.
  return {...turn,seq:event.seq??turn.seq,tools};
 }
 if(event.type!=='message.delta'&&event.type!=='message.complete')return turn;
 if(typeof p.text!=='string')return turn;
 const seq=event.seq??turn.seq;
 if(event.type==='message.delta'){
  const next=turn.text+p.text;
  return {...turn,seq,text:next.slice(0,maxText),truncated:turn.truncated||next.length>maxText};
 }
 // An unrecognized terminal status cannot be promoted to success.
 const status=p.status==='error'?'failed':p.status==='interrupted'?'interrupted':p.status==='complete'?'complete':null;
 if(!status)return turn;
 return {...turn,seq,status,text:p.text.slice(0,maxText),truncated:p.text.length>maxText,
  tools:turn.tools.map(tool=>tool.status==='running'?{...tool,status:'unknown'}:tool)};
}
