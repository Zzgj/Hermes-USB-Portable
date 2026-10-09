// Test-only CDP transport. Never include request payloads or peer errors in diagnostics.
import {setTimeout as delay} from 'node:timers/promises';
import {join} from 'node:path';

export function chromeEnvironment(profile,tempRoot){
 // Use an owned short temp root: Linux singleton socket paths have a small limit.
 // Do not pass model credentials or the user's HOME/profile environment to it.
 return {PATH:process.env.PATH??'',LANG:'C.UTF-8',HOME:profile,TMPDIR:tempRoot,TMP:tempRoot,TEMP:tempRoot,
  XDG_CONFIG_HOME:join(profile,'config'),XDG_CACHE_HOME:join(profile,'cache')};
}

export function createCdpClient(input,output,{timeoutMs=10000,onEvent=()=>{}}={}){
 let id=0,buffer='',closed;const pending=new Map();
 function close(code='CDP_CLOSED'){
  if(closed)return;closed=code;buffer='';
  for(const p of pending.values()){clearTimeout(p.timer);p.reject(new Error(code));}pending.clear();
 }
 input.on('error',()=>close());output.on('error',()=>close());output.on('end',()=>close());output.on('close',()=>close());
 output.setEncoding('utf8');
 output.on('data',chunk=>{
  if(closed)return;buffer+=chunk;
  if(buffer.length>2*1024*1024){close('CDP_PROTOCOL');return;}
  let end;
  while((end=buffer.indexOf('\0'))!==-1){
   const raw=buffer.slice(0,end);buffer=buffer.slice(end+1);if(!raw)continue;
   try{
    const msg=JSON.parse(raw);if(!msg||typeof msg!=='object')throw new Error();
    if(msg.id){const p=pending.get(msg.id);if(p){pending.delete(msg.id);clearTimeout(p.timer);msg.error?p.reject(new Error('CDP_REJECTED')):p.resolve(msg.result);}}
    else onEvent(msg);
   }catch{close('CDP_PROTOCOL');return;}
  }
 });
 return {close,send(method,params={},sessionId){
  if(closed)return Promise.reject(new Error(closed));
  return new Promise((resolve,reject)=>{
   const n=++id,timer=setTimeout(()=>{pending.delete(n);reject(new Error('CDP_TIMEOUT'));},timeoutMs);
   pending.set(n,{resolve,reject,timer});
   try{input.write(JSON.stringify({id:n,method,params,...(sessionId?{sessionId}:{})})+'\0',error=>{if(error)close();});}catch{close();}
  });
 }};
}

const routes=new Set(['/','/api/status','/api/start','/api/connection','/api/capabilities/catalog','/api/capabilities/prepare']);
export function projectNetwork(response,origin){
 try{const u=new URL(response.url);return u.origin===origin&&routes.has(u.pathname)&&Number.isInteger(response.status)&&response.status>=100&&response.status<=599?{path:u.pathname,status:response.status}:null;}catch{return null;}
}

export async function waitUntil(predicate,{timeoutMs=5000,intervalMs=25,signal}={}){
 const deadline=Date.now()+timeoutMs;
 do{
  if(signal?.aborted)throw new Error('BROWSER_INTERRUPTED');
  if(await predicate())return;
  await delay(intervalMs);
 }while(Date.now()<deadline);
 throw new Error('UI_WAIT_TIMEOUT');
}

export async function closeOwnedBrowser(child,requestClose,graceMs=1500){
 if(!child)return;
 // Register before requesting shutdown: close may occur before the CDP reply.
 let closed=false;const onClose=()=>{closed=true;};child.once('close',onClose);
 const isClosed=()=>closed||child.exitCode!==null||child.signalCode!==null;
 try{
  if(isClosed())return;
  try{await requestClose();}catch{}
  async function waitClosed(){
   const deadline=Date.now()+graceMs;
   while(!isClosed()&&Date.now()<deadline)await delay(Math.min(10,graceMs));
   return isClosed();
  }
  if(await waitClosed())return;
  // Only the ChildProcess created by this runner; never process-name/global kills.
  child.kill('SIGTERM');if(await waitClosed())return;
  child.kill('SIGKILL');if(await waitClosed())return;
  throw new Error('BROWSER_CLEANUP_FAILED');
 }finally{child.removeListener('close',onClose);}
}
