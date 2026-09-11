import type {ChatTurn,ToolActivity} from './chat-events';
export interface TaskSummary {
 readonly sessionId:string;
 readonly status:'running'|'waiting-approval'|'stopping'|'unknown'|'complete'|'failed'|'interrupted';
 readonly tools:readonly ToolActivity[];
 readonly toolsTruncated:boolean;
}
/** A presentation of observed events, never an execution engine or business verification. */
export function summarizeTask(turn:ChatTurn,state:{readonly connected:boolean;readonly approval:boolean;readonly stopping:boolean}):TaskSummary {
 const active=turn.status==='streaming';
 const status=!active?turn.status:!state.connected?'unknown':state.stopping?'stopping':state.approval?'waiting-approval':'running';
 return {sessionId:turn.sessionId,status,tools:turn.tools.map(tool=>({...tool,status:tool.status==='running'&&(!active||!state.connected)?'unknown':tool.status})),toolsTruncated:turn.toolsTruncated};
}
