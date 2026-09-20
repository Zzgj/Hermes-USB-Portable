import type {ChatTurn,ToolActivity,CapabilityInvocation} from './chat-events';
export interface TaskSummary {
 readonly capability?:CapabilityInvocation;
 readonly sessionId:string;
 readonly status:'running'|'waiting-approval'|'stopping'|'unknown'|'complete'|'failed'|'interrupted';
 readonly tools:readonly ToolActivity[];
 readonly toolsTruncated:boolean;
}
/** A presentation of observed events, never an execution engine or business verification. */
export function summarizeTask(turn:ChatTurn,state:{readonly connected:boolean;readonly approval:boolean;readonly stopping:boolean}):TaskSummary {
 const active=turn.status==='streaming';
 const status=!active?turn.status:!state.connected?'unknown':state.stopping?'stopping':state.approval?'waiting-approval':'running';
 return {sessionId:turn.sessionId,status,...(turn.capability?{capability:{cardId:turn.capability.cardId,methodFingerprint:turn.capability.methodFingerprint}}:{}),tools:turn.tools.map(tool=>({...tool,status:tool.status==='running'&&(!active||!state.connected)?'unknown':tool.status})),toolsTruncated:turn.toolsTruncated};
}
/** Portable diagnostic observations, never a trusted verification/import format. */
export function exportTaskObservations(tasks:readonly TaskSummary[]):string {
 if(!tasks.length||tasks.length>100)throw new Error('TASK_REPORT_LIMIT');
 const result={schema_version:1,kind:'workbench-task-observations',trusted_verification:false,tasks:tasks.map(task=>({
  sessionId:task.sessionId,status:task.status,businessVerification:'unverified',
  ...(task.capability?{capability:{cardId:task.capability.cardId,methodFingerprint:task.capability.methodFingerprint}}:{}),
  tools:task.tools.map(tool=>({id:tool.id,name:tool.name,status:tool.status})),toolsTruncated:task.toolsTruncated,
 }))};
 const raw=JSON.stringify(result,null,2);if(new TextEncoder().encode(raw).length>262144)throw new Error('TASK_REPORT_LIMIT');return raw;
}
