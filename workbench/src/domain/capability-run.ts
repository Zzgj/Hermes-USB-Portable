import {decodeCapability,bindCapabilityInputs,type Capability} from './capability';
export interface PreparedCapability {readonly cardId:string;readonly prompt:string;readonly fingerprint:string;readonly port:number;readonly token:string;readonly epoch:number;}
export async function prepareCapabilityRun(token:string,card:Capability,values:Readonly<Record<string,string>>,epoch:number,signal:AbortSignal):Promise<PreparedCapability>{
 const safe=decodeCapability(card);if(safe.method.kind!=='skill'||!token.trim()||token.length>4096||!Number.isSafeInteger(epoch)||epoch<0)throw new Error('CAPABILITY_INVALID');
 const body=JSON.stringify({card:safe,values:bindCapabilityInputs(safe,values)});if(new TextEncoder().encode(body).length>16384)throw new Error('CAPABILITY_LIMIT');
 const response=await fetch('/api/capabilities/prepare',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body,signal,credentials:'omit',redirect:'error',cache:'no-store'});
 if(!response.ok||!response.body)throw new Error('CAPABILITY_FAILED');
 const reader=response.body.getReader(),decoder=new TextDecoder('utf-8',{fatal:true});let bytes=0,raw='';
 try{while(true){const item=await reader.read();if(item.done)break;bytes+=item.value.length;if(bytes>70000)throw new Error('CAPABILITY_LIMIT');raw+=decoder.decode(item.value,{stream:true});}raw+=decoder.decode();}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
 const value=JSON.parse(raw),p=value?.prepared,c=value?.connection;
 if(p?.kind!=='capability'||p.cardId!==safe.id||p.method?.kind!=='skill'||p.method.name!==safe.method.name||p.method.fingerprint!==safe.method.fingerprint||p.availability!=='unknown'||typeof p.prompt!=='string'||!p.prompt||p.prompt.length>15000||!Number.isInteger(c?.port)||c.port<1||c.port>65535||typeof c.token!=='string'||!c.token||c.token.length>4096)throw new Error('CAPABILITY_FAILED');
 return {cardId:safe.id,prompt:p.prompt,fingerprint:safe.method.fingerprint,port:c.port,token:c.token,epoch};
}
