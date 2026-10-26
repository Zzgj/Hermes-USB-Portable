export type NativeKind='cli'|'dashboard';
export type NativeState='idle'|'starting'|'running'|'stopping'|'unknown';
export type NativeAction='cli'|'dashboard'|'stop'|'open';
export interface NativeStatus{readonly kind:NativeKind|null;readonly state:NativeState;}
// Keep this allowlist aligned with the native HTTP projection. Never display a
// received header or an Error.message directly, even when it resembles a code.
export const nativeOperationReasons=['WINDOWS_REQUIRED','NATIVE_BASELINE_UNSUPPORTED','SOURCE_REVIEW_REQUIRED','SOURCE_ENV_REQUIRES_REVIEW','NATIVE_ASSET_INVALID','INVALID_HERMES_LAYOUT','INSTANCE_LOCKED','INTERRUPTED_INSTALL_REQUIRES_RECOVERY','ENTRY_ADAPTER_UNAVAILABLE','DASHBOARD_NOT_READY','ENTRY_NOT_READY','ENTRY_BUSY','ENTRY_NOT_RUNNING','ENTRY_START_UNCONFIRMED','ENTRY_STOP_UNCONFIRMED','ENTRY_RELEASE_UNCONFIRMED'] as const;
export type NativeFailure=typeof nativeOperationReasons[number]|'FORBIDDEN'|'UNAVAILABLE'|'CONFLICT'|'CANCELLED'|'TRANSPORT';
const failureCodes:readonly string[]=[...nativeOperationReasons,'FORBIDDEN','UNAVAILABLE','CONFLICT','CANCELLED','TRANSPORT'];
export class NativeEntryRequestError extends Error{
 readonly reason:NativeFailure;
 constructor(reason:NativeFailure){super('NATIVE_REQUEST_FAILED');this.reason=failureCodes.includes(reason)?reason:'TRANSPORT';}
}
export function nativeFailureReason(error:unknown):NativeFailure{
 return error instanceof NativeEntryRequestError&&failureCodes.includes(error.reason)?error.reason:'TRANSPORT';
}
const object=(value:unknown):value is Record<string,unknown>=>typeof value==='object'&&value!==null&&!Array.isArray(value);
export function decodeNativeStatus(value:unknown):NativeStatus{
 if(!object(value)||Object.keys(value).sort().join(',')!=='kind,state'||
  ![null,'cli','dashboard'].includes(value.kind as NativeKind|null)||
  !['idle','starting','running','stopping','unknown'].includes(value.state as string)||
  (value.state==='idle'&&value.kind!==null)||
  (['starting','running','stopping'].includes(value.state as string)&&value.kind===null))throw new Error('INVALID_NATIVE_STATUS');
 return {kind:value.kind as NativeKind|null,state:value.state as NativeState};
}
async function readBounded(response:Response,signal:AbortSignal):Promise<unknown>{
 signal.throwIfAborted();if(!response.body)throw new Error('INVALID_NATIVE_RESPONSE');
 const reader=response.body.getReader(),chunks:Uint8Array[]=[];let bytes=0,onAbort=()=>{};
 const aborted=new Promise<never>((_,reject)=>{onAbort=()=>reject(new Error('NATIVE_REQUEST_CANCELLED'));signal.addEventListener('abort',onAbort,{once:true});});
 try{
  while(true){const {done,value}=await Promise.race([reader.read(),aborted]);signal.throwIfAborted();if(done)break;
   bytes+=value.byteLength;if(bytes>4096)throw new Error('NATIVE_RESPONSE_TOO_LARGE');chunks.push(value);
  }
  const data=new Uint8Array(bytes);let offset=0;for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.length;}
  return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(data));
 }finally{signal.removeEventListener('abort',onAbort);void reader.cancel().catch(()=>{});reader.releaseLock();}
}
const paths:Record<NativeAction,string>={cli:'/api/native-entry/cli/start',dashboard:'/api/native-entry/dashboard/start',stop:'/api/native-entry/stop',open:'/api/native-entry/dashboard/open'};
// Same-origin fixed endpoints only. Abort is NOT cancellation of a server action.
export async function requestNativeEntry(identity:string,action:NativeAction|'status',signal:AbortSignal):Promise<NativeStatus|null>{
 if(!identity.trim()||!(action==='status'||Object.hasOwn(paths,action)))throw new Error('INVALID_NATIVE_REQUEST');
 const response=await fetch(action==='status'?'/api/native-entry/status':paths[action],{
  method:action==='status'?'GET':'POST',headers:{Authorization:'Bearer '+identity},
  credentials:'omit',cache:'no-store',redirect:'error',signal,
 });
 if(!response.ok){
  void response.body?.cancel().catch(()=>{});
  const header=response.headers.get('X-Native-Entry-Reason');
  const reason:NativeFailure=response.status===403?'FORBIDDEN':response.status===404?'UNAVAILABLE':response.status===409?
   ((nativeOperationReasons as readonly (string|null)[]).includes(header)?header as NativeFailure:'CONFLICT'):'TRANSPORT';
  throw new NativeEntryRequestError(reason);
 }
 const value=await readBounded(response,signal);
 if(action==='status')return decodeNativeStatus(value);
 if(response.status!==202||!object(value)||Object.keys(value).join(',')!=='accepted'||value.accepted!==true)throw new Error('INVALID_NATIVE_ACK');
 return null;
}
