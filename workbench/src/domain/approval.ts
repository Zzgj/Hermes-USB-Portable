export interface ApprovalRequest {
 readonly id:string;
 readonly command:string;
 readonly reason:string;
 readonly choices:readonly ('once'|'deny')[];
}
export function decodeApproval(value:unknown):ApprovalRequest {
 if(!value||typeof value!=='object')throw new Error('Invalid approval');
 const data=value as Record<string,unknown>;
 if(typeof data.request_id!=='string'||!data.request_id.trim()||data.request_id.length>256||
 typeof data.command!=='string'||!data.command.trim()||data.command.length>16000||!Array.isArray(data.choices))throw new Error('Invalid approval');
 const choices=(['once','deny'] as const).filter(choice=>data.choices instanceof Array&&data.choices.includes(choice));
 if(!choices.length)throw new Error('Unsupported approval choices');
 return {id:data.request_id,command:data.command,reason:typeof data.reason==='string'?data.reason.slice(0,4000):'',choices};
}
export function approvalParams(sessionId:string,request:ApprovalRequest,choice:'once'|'deny') {
 if(!sessionId||!request.choices.includes(choice))throw new Error('Unsupported approval response');
 return {session_id:sessionId,request_id:request.id,choice,all:false};
}
export function approvalResolved(value:unknown):boolean {
 return !!value&&typeof value==='object'&&(value as Record<string,unknown>).resolved===true;
}
