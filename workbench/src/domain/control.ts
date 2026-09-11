export type ControlAction='status'|'start'|'stop'|'connection';
export type ControlState='idle'|'starting'|'ready'|'changing'|'stopping'|'stopped'|'exited';
export interface ManagedConnection {readonly port:number;readonly token:string;}
export interface ControlResult {readonly state:ControlState;readonly connection?:ManagedConnection;}
export async function controlRequest(action:ControlAction,token:string,signal:AbortSignal,send:typeof fetch=fetch):Promise<ControlResult>{
 if(!['status','start','stop','connection'].includes(action)||!token.trim())throw new Error('CONTROL_INVALID');
 const response=await send(`/api/${action}`,{method:action==='start'||action==='stop'?'POST':'GET',headers:{Authorization:`Bearer ${token}`},cache:'no-store',credentials:'omit',redirect:'error',signal});
 if(!response.ok)throw new Error('CONTROL_FAILED');
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
