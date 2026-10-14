export type EntryKind='workbench'|'cli'|'tui'|'dashboard'|'desktop';
export type AssetState='present'|'missing'|'invalid'|'unknown';
export interface EntryCapabilityRow{readonly kind:EntryKind;readonly assetState:AssetState;}
const kinds:readonly EntryKind[]=['workbench','cli','tui','dashboard','desktop'];
const states:readonly string[]=['present','missing','invalid','unknown'];
const object=(v:unknown):v is Record<string,unknown>=>typeof v==='object'&&v!==null&&!Array.isArray(v);
// Strict version gate; only inert, known v1 capabilities may enter this panel.
export function decodeEntryCapabilities(value:unknown):readonly EntryCapabilityRow[]{
 if(!object(value)||value.schemaVersion!==1||!Array.isArray(value.entries)||value.entries.length!==5)throw new Error('INVALID_ENTRY_CAPABILITIES');
 const entries=value.entries;
 return kinds.map(kind=>{
  const matches=entries.filter(row=>object(row)&&row.kind===kind);
  if(matches.length!==1)throw new Error('INVALID_ENTRY_CAPABILITIES');
  const row=matches[0];
  if(!states.includes(row.assetState)||row.dependencies!=='unverified'||row.runtime!=='unknown'||!object(row.launch)||row.launch.allowed!==false||row.launch.reason!=='LIFECYCLE_NOT_INTEGRATED')throw new Error('INVALID_ENTRY_CAPABILITIES');
  return {kind,assetState:row.assetState as AssetState};
 });
}
export async function readEntryCapabilities(response:Response,signal:AbortSignal):Promise<readonly EntryCapabilityRow[]>{
 signal.throwIfAborted();
 if(!response.body)throw new Error('INVALID_ENTRY_CAPABILITIES');
 const reader=response.body.getReader();let bytes=0;
 const chunks:Uint8Array[]=[];
 let onAbort:()=>void=()=>{};
 const aborted=new Promise<never>((_,reject)=>{onAbort=()=>reject(new Error('ENTRY_READ_CANCELLED'));signal.addEventListener('abort',onAbort,{once:true});});
 try{
  while(true){
   const {value,done}=await Promise.race([reader.read(),aborted]);
   signal.throwIfAborted();if(done)break;
   bytes+=value.byteLength;if(bytes>16384)throw new Error('ENTRY_RESPONSE_TOO_LARGE');chunks.push(value);
  }
  const result=new Uint8Array(bytes);let offset=0;
  for(const chunk of chunks){result.set(chunk,offset);offset+=chunk.length;}
  return decodeEntryCapabilities(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(result)));
 }finally{signal.removeEventListener('abort',onAbort);void reader.cancel().catch(()=>{});reader.releaseLock();}
}
