/** Card metadata references Hermes methods; it is not executable workflow code. */
export interface Capability {
 readonly id:string;
 readonly name:string;
 readonly goal:string;
 readonly method:{readonly kind:'skill'|'bundle';readonly name:string;readonly fingerprint:string};
 readonly inputs:readonly {readonly id:string;readonly label:string;readonly required:boolean}[];
 readonly state:'draft'|'published';
}
export interface VerificationEvidence {
 readonly capabilityId:string;
 readonly methodFingerprint:string;
 readonly environmentFingerprint:string;
 readonly sessionId:string;
 readonly verifiedAt:string;
 readonly outcome:'passed'|'failed';
 readonly checks:readonly {readonly id:string;readonly passed:boolean}[];
}
const object=(v:unknown):v is Record<string,unknown>=>typeof v==='object'&&v!==null&&!Array.isArray(v);
const text=(v:unknown,max:number):v is string=>typeof v==='string'&&v.trim().length>0&&v.length<=max;
const fingerprint=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
export function decodeCapability(value:unknown):Capability {
 if(!object(value)||!text(value.id,128)||!text(value.name,256)||!text(value.goal,4000)||!object(value.method)||!['skill','bundle'].includes(String(value.method.kind))||!text(value.method.name,256)||!fingerprint(value.method.fingerprint)||!['draft','published'].includes(String(value.state))||!Array.isArray(value.inputs)||value.inputs.length>30)throw new Error('Invalid capability');
 const seen=new Set<string>();
 const inputs=value.inputs.map(input=>{
  if(!object(input)||typeof input.id!=='string'||!/^([a-z][a-z0-9_]{0,63})$/.test(input.id)||seen.has(input.id)||!text(input.label,256)||typeof input.required!=='boolean')throw new Error('Invalid capability input');
  seen.add(input.id);return {id:input.id,label:input.label,required:input.required};
 });
 return {id:value.id,name:value.name,goal:value.goal,method:{kind:value.method.kind as 'skill'|'bundle',name:value.method.name,fingerprint:value.method.fingerprint},state:value.state as 'draft'|'published',inputs};
}
export function decodeVerification(value:unknown):VerificationEvidence {
 if(!object(value)||!text(value.capabilityId,128)||!fingerprint(value.methodFingerprint)||!fingerprint(value.environmentFingerprint)||!text(value.sessionId,256)||typeof value.verifiedAt!=='string'||!Number.isFinite(Date.parse(value.verifiedAt))||!['passed','failed'].includes(String(value.outcome))||!Array.isArray(value.checks)||!value.checks.length||value.checks.length>100)throw new Error('Invalid verification');
 const seen=new Set<string>();
 const checks=value.checks.map(check=>{
  if(!object(check)||!text(check.id,256)||seen.has(check.id)||typeof check.passed!=='boolean')throw new Error('Invalid verification check');
  seen.add(check.id);return {id:check.id,passed:check.passed};
 });
 return {capabilityId:value.capabilityId,methodFingerprint:value.methodFingerprint,environmentFingerprint:value.environmentFingerprint,sessionId:value.sessionId,verifiedAt:value.verifiedAt,outcome:value.outcome as 'passed'|'failed',checks};
}
/** Metadata alone grants neither trust nor permission; callers must source evidence from validated records. */
export function capabilityStatus(card:Capability,evidence:readonly VerificationEvidence[],environmentFingerprint:string):'draft'|'unverified'|'verified'|'reverify'{
 if(card.state==='draft')return 'draft';
 const records=evidence.filter(row=>row.capabilityId===card.id);
 if(!records.length)return 'unverified';
 const matching=records.filter(row=>row.methodFingerprint===card.method.fingerprint&&row.environmentFingerprint===environmentFingerprint);
 if(!matching.length)return 'reverify';
 const latestTime=Math.max(...matching.map(row=>Date.parse(row.verifiedAt)));
 const latest=matching.filter(row=>Date.parse(row.verifiedAt)===latestTime);
 return latest.every(row=>row.outcome==='passed'&&row.checks.length>0&&row.checks.every(check=>check.passed))?'verified':'reverify';
}
export function bindCapabilityInputs(card:Capability,values:Readonly<Record<string,string>>):Readonly<Record<string,string>>{
 const bound:Record<string,string>={};
 for(const input of card.inputs){
  const value=Object.hasOwn(values,input.id)?values[input.id]:'';
  if(typeof value!=='string'||value.length>4000||(input.required&&!value.trim()))throw new Error('Invalid capability parameters');
  bound[input.id]=value;
 }
 // Unknown fields are deliberately not carried across machines or into a prompt.
 return bound;
}
/** External files cannot publish cards or import trusted verification records. */
export function importCapabilityDrafts(raw:string):readonly Capability[]{
 if(raw.length>65536||new TextEncoder().encode(raw).byteLength>65536)throw new Error('Capability import too large');
 const value:unknown=JSON.parse(raw);
 if(!Array.isArray(value)||!value.length||value.length>100)throw new Error('Invalid capability import');
 const seen=new Set<string>();
 return value.map(item=>{
  const card=decodeCapability(item);if(seen.has(card.id))throw new Error('Duplicate capability');
  seen.add(card.id);return {...card,state:'draft'};
 });
}
/** Export definitions only, never execution inputs, approvals or verification evidence. */
export function exportCapabilityDrafts(cards:readonly Capability[]):string {
 // Project onto the allowed schema before serialization so attached runtime data is never exported.
 const projected=cards.map(card=>({...decodeCapability(card),state:'draft' as const}));
 const raw=JSON.stringify(projected);
 importCapabilityDrafts(raw); // The exported file must satisfy the same byte/count/identity limits.
 return raw;
}
/** The manager inventories only its explicitly selected home. Never accepts a browser path. */
export async function fetchCapabilityDrafts(token:string,signal?:AbortSignal):Promise<string>{
 if(!token||token.length>4096)throw new Error('CATALOG_FAILED');
 const response=await fetch('/api/capabilities/catalog',{headers:{Authorization:`Bearer ${token}`},credentials:'omit',redirect:'error',cache:'no-store',signal});
 if(!response.ok||!response.body)throw new Error('CATALOG_FAILED');
 const reader=response.body.getReader(),decoder=new TextDecoder('utf-8',{fatal:true});let bytes=0,raw='';
 try{while(true){const part=await reader.read();if(part.done)break;bytes+=part.value.byteLength;if(bytes>70000)throw new Error('CATALOG_FAILED');raw+=decoder.decode(part.value,{stream:true});}raw+=decoder.decode();}
 finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
 const value:unknown=JSON.parse(raw);
 if(!object(value)||value.availability!=='unknown'||!Array.isArray(value.cards))throw new Error('CATALOG_FAILED');
 return exportCapabilityDrafts(importCapabilityDrafts(JSON.stringify(value.cards)));
}
/** Read the live instance catalog via the control server; returns parsed cards with fingerprints for re-verification. */
export async function readInstanceCatalogCards(connection:{readonly port:number;readonly token:string},signal:AbortSignal,send:typeof fetch=fetch):Promise<readonly Capability[]>{
 if(!Number.isInteger(connection.port)||connection.port<1||connection.port>65535||!connection.token.trim()||connection.token.length>4096)throw new Error('CATALOG_FAILED');
 const url=`http://127.0.0.1:${connection.port}/api/capabilities/catalog`;
 try{
  const response=await send(url,{headers:{Authorization:`Bearer ${connection.token}`},credentials:'omit',redirect:'error',cache:'no-store',signal});
  if(!response.ok||!response.body)throw new Error('CATALOG_FAILED');
  const reader=response.body.getReader(),decoder=new TextDecoder('utf-8',{fatal:true});let bytes=0,raw='';
  try{while(true){const part=await reader.read();if(part.done)break;bytes+=part.value.byteLength;if(bytes>70000)throw new Error('CATALOG_FAILED');raw+=decoder.decode(part.value,{stream:true});}raw+=decoder.decode();}
  finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
  const value:unknown=JSON.parse(raw);
  if(!object(value)||value.availability!=='unknown'||!Array.isArray(value.cards))throw new Error('CATALOG_FAILED');
  return importCapabilityDrafts(JSON.stringify(value.cards));
 }catch{throw new Error('CATALOG_FAILED');}
}
/** External evidence files are never auto-trusted; imported records carry trusted:false until re-verified locally. */
export interface ImportedEvidence extends VerificationEvidence{readonly trusted:false;}
export function importVerificationDrafts(raw:string):readonly ImportedEvidence[]{
 if(raw.length>131072||new TextEncoder().encode(raw).byteLength>131072)throw new Error('Evidence import too large');
 const value:unknown=JSON.parse(raw);
 if(!Array.isArray(value)||value.length>500)throw new Error('Invalid evidence import');
 return value.map(item=>{const record=decodeVerification(item);return {...record,trusted:false as const};});
}
/** Read the live instance evidence via the control server; records from the instance are trusted:false until locally re-verified. */
export async function readInstanceEvidence(connection:{readonly port:number;readonly token:string},signal:AbortSignal,send:typeof fetch=fetch):Promise<readonly ImportedEvidence[]>{
 if(!Number.isInteger(connection.port)||connection.port<1||connection.port>65535||!connection.token.trim()||connection.token.length>4096)throw new Error('EVIDENCE_FAILED');
 const url=`http://127.0.0.1:${connection.port}/api/capabilities/evidence`;
 try{
  const response=await send(url,{headers:{Authorization:`Bearer ${connection.token}`},credentials:'omit',redirect:'error',cache:'no-store',signal});
  if(!response.ok||!response.body)throw new Error('EVIDENCE_FAILED');
  const reader=response.body.getReader(),decoder=new TextDecoder('utf-8',{fatal:true});let bytes=0,raw='';
  try{while(true){const part=await reader.read();if(part.done)break;bytes+=part.value.byteLength;if(bytes>140000)throw new Error('EVIDENCE_FAILED');raw+=decoder.decode(part.value,{stream:true});}raw+=decoder.decode();}
  finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
  return importVerificationDrafts(raw);
 }catch{throw new Error('EVIDENCE_FAILED');}
}
/** Derive the environment fingerprint from the instance catalog: a stable hash over Skill names and their fingerprints. */
export async function environmentFingerprint(catalog:readonly Capability[]):Promise<string>{
 if(!catalog.length)throw new Error('Empty catalog');
 const parts=catalog.map(card=>`${card.method.name}:${card.method.fingerprint}`).sort().join('\n');
 const encoder=new TextEncoder();
 const data=encoder.encode(`hermes-env-v1\n${parts}`);
 const buf=await crypto.subtle.digest('SHA-256',data);
 return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
}
