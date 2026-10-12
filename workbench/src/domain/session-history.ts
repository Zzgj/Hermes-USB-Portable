export interface SessionTranscript {
 readonly sessionId:string;
 readonly messages:readonly {readonly role:'user'|'assistant';readonly text:string}[];
 readonly omitted:boolean;
}
const object=(value:unknown):value is Record<string,unknown>=>typeof value==='object'&&value!==null&&!Array.isArray(value);
const identity=(value:unknown):value is string=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9_-]{0,255}$/.test(value);
export function decodeTranscript(value:unknown):SessionTranscript {
 if(!object(value)||!identity(value.session_id)||!Array.isArray(value.messages)||value.messages.length>50)throw new Error('HISTORY_INVALID');
 const messages: {role:'user'|'assistant';text:string}[]=[];let omitted=false,total=0;
 for(const row of value.messages){
  if(!object(row))throw new Error('HISTORY_INVALID');
  if(row.display_kind==='hidden'||(row.role!=='user'&&row.role!=='assistant')){omitted=true;continue;}
  const content=Object.hasOwn(row,'display_content')?row.display_content:row.content;
  if(typeof content!=='string'){omitted=true;continue;}
  const text=content.slice(0,Math.max(0,Math.min(20_000,100_000-total)));
  total+=text.length;omitted=omitted||text.length<content.length;
  if(text)messages.push({role:row.role as 'user'|'assistant',text});
 }
 return {sessionId:value.session_id,messages,omitted};
}
/** Read-only transcript via same-origin management proxy (port=0) or direct loopback (legacy). */
export async function readTranscript(connection:{readonly port:number;readonly token:string},sessionId:string,signal:AbortSignal,send:typeof fetch=fetch):Promise<SessionTranscript>{
 if(!Number.isInteger(connection.port)||connection.port<0||connection.port>65535||!connection.token.trim()||connection.token.length>4096||!identity(sessionId))throw new Error('HISTORY_INVALID');
 // When port=0, use same-origin relative URL (management service proxy avoids CORS).
 // When port>0, use direct loopback (legacy path, may trigger CORS preflight).
 const url=connection.port===0?`/api/sessions/${encodeURIComponent(sessionId)}/messages?limit=50&offset=0&order=latest`:`http://127.0.0.1:${connection.port}/api/sessions/${encodeURIComponent(sessionId)}/messages?limit=50&offset=0&order=latest`;
 // Preserve distinct error categories so the UI can show meaningful messages and allow retry.
 let response:Response;
 try{response=await send(url,{method:'GET',headers:{Authorization:'Bearer '+connection.token},credentials:'omit',cache:'no-store',redirect:'error',signal});}
 catch(error){if(error instanceof DOMException&&error.name==='AbortError')throw new Error('HISTORY_ABORTED');throw new Error('HISTORY_NETWORK');}
 if(!response.ok)throw new Error(response.status===401||response.status===403?'HISTORY_FORBIDDEN':'HISTORY_HTTP_ERROR');
 if(!response.body)throw new Error('HISTORY_EMPTY');
 const reader=response.body.getReader(),chunks:Uint8Array[]=[];let length=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>1_048_576)throw new Error('HISTORY_TOO_LARGE');chunks.push(value);}}
 catch(error){if(error instanceof Error&&error.message==='HISTORY_TOO_LARGE')throw error;throw new Error(error instanceof DOMException&&error.name==='AbortError'?'HISTORY_ABORTED':'HISTORY_NETWORK');}
 finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
 if(length===0)throw new Error('HISTORY_EMPTY');
 const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 let decoded:unknown;
 try{decoded=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw new Error('HISTORY_INVALID');}
 return decodeTranscript(decoded);
}
