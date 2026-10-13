export type ControlAction='status'|'start'|'stop'|'connection';
export type ControlState='idle'|'starting'|'ready'|'changing'|'stopping'|'stopped'|'exited';
export interface ManagedConnection {readonly port:number;readonly token:string;}
export interface ControlResult {readonly state:ControlState;readonly connection?:ManagedConnection;}
const reasons=['INSTANCE_LOCKED','LOCK_CREATE_FAILED','LOCK_INITIALIZATION_FAILED','LOCK_IDENTITY_CHANGED','LOCK_OWNER_CHANGED','INTERRUPTED_INSTALL_REQUIRES_RECOVERY','SOURCE_ENV_REQUIRES_REVIEW','INVALID_HERMES_PATHS','INVALID_HERMES_LAYOUT','HERMES_ENTRY_MISSING','PROCESS_SPAWN_FAILED','PROCESS_STARTUP_TIMEOUT','PROCESS_HEALTH_FAILED','PROCESS_EXITED_BEFORE_READY','PROCESS_STOPPED_BEFORE_READY','PROCESS_CONTROL_FAILED','PROCESS_OUTPUT_LIMIT','PROCESS_INVALID_PORT'] as const;
export type ControlReason=typeof reasons[number]|'UNKNOWN';
export class ControlRequestError extends Error {
 constructor(readonly status:number,readonly reason:ControlReason='UNKNOWN'){super('CONTROL_FAILED');}
}
async function readReason(response:Response):Promise<ControlReason>{
 const reader=response.body?.getReader();if(!reader)return 'UNKNOWN';
 try{
  let bytes=0,text='';const decoder=new TextDecoder('utf-8',{fatal:true});
  while(true){const{done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>8192)return 'UNKNOWN';text+=decoder.decode(value,{stream:true});}
  text+=decoder.decode();const body=JSON.parse(text);
  return response.status===500&&body?.error==='OPERATION_FAILED'&&reasons.includes(body.reason)?body.reason:'UNKNOWN';
 }catch{return 'UNKNOWN';}
 finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
}
export async function controlRequest(action:ControlAction,token:string,signal:AbortSignal,send:typeof fetch=fetch):Promise<ControlResult>{
 if(!['status','start','stop','connection'].includes(action)||!token.trim())throw new Error('CONTROL_INVALID');
 const response=await send(`/api/${action}`,{method:action==='start'||action==='stop'?'POST':'GET',headers:{Authorization:`Bearer ${token}`},cache:'no-store',credentials:'omit',redirect:'error',signal});
 if(!response.ok)throw new ControlRequestError(response.status,await readReason(response));
 const text=await response.text();if(text.length>8192)throw new Error('CONTROL_INVALID');
 const data=JSON.parse(text) as Record<string,unknown>;
 if(!data||!['idle','starting','ready','changing','stopping','stopped','exited'].includes(data.state as string))throw new Error('CONTROL_INVALID');
 if(action==='start'||action==='connection'){
  const value=data.connection as ManagedConnection|undefined;
  if(data.state!=='ready'||!value||!Number.isInteger(value.port)||value.port<1||value.port>65535||typeof value.token!=='string'||value.token.length<16||value.token.length>1024)throw new Error('CONTROL_INVALID');
  return {state:'ready',connection:{port:value.port,token:value.token}};
 }
 return {state:data.state as ControlState};
}
