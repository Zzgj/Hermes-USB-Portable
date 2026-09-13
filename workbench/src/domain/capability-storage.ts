/** Page-local persistence for capability card drafts and evidence.
 * Storage is scoped to the workbench origin and never travels across machines.
 * Only card definitions are persisted — no execution inputs, approvals, tokens or session content.
 * Evidence records are persisted only for read-back display; they always carry trusted:false on re-import.
 * A storage version key guards against schema drift; older payloads are rejected, not migrated. */
import {importCapabilityDrafts,exportCapabilityDrafts,decodeCapability,decodeVerification,importVerificationDrafts,type Capability,type ImportedEvidence} from './capability';

const STORAGE_KEY='hermes-p2-capability-drafts-v1';
const EVIDENCE_KEY='hermes-p2-capability-evidence-v1';
const MAX_CARDS=100;
const MAX_EVIDENCE=500;

interface StorageBackend{
 getItem(key:string):string|null;
 setItem(key:string,value:string):void;
 removeItem(key:string):void;
}
function getBackend():StorageBackend|null{
 try{
  const g=globalThis as {localStorage?:StorageBackend};
  return g.localStorage??null;
 }catch{return null;}
}

/** Persisted cards are always projected to draft state before writing. */
export function saveDrafts(cards:readonly Capability[]):void{
 const backend=getBackend();if(!backend)return;
 const projected=exportCapabilityDrafts(cards);
 if(new TextEncoder().encode(projected).byteLength>65536)throw new Error('PERSIST_TOO_LARGE');
 backend.setItem(STORAGE_KEY,projected);
}

/** Load returns an empty array if storage is unavailable or the payload fails validation. */
export function loadDrafts():readonly Capability[]{
 const backend=getBackend();if(!backend)return [];
 const raw=backend.getItem(STORAGE_KEY);if(!raw)return [];
 try{return importCapabilityDrafts(raw);}catch{return [];}
}

/** Remove all persisted drafts. */
export function clearDrafts():void{
 const backend=getBackend();if(!backend)return;
 backend.removeItem(STORAGE_KEY);
}

/** Persist evidence records; always re-projected to trusted:false on save. */
export function saveEvidence(records:readonly ImportedEvidence[]):void{
 const backend=getBackend();if(!backend)return;
 if(records.length>MAX_EVIDENCE)throw new Error('PERSIST_TOO_LARGE');
 const projected=JSON.stringify(records.map(record=>({...record,trusted:false as const})));
 if(new TextEncoder().encode(projected).byteLength>131072)throw new Error('PERSIST_TOO_LARGE');
 backend.setItem(EVIDENCE_KEY,projected);
}

/** Load returns an empty array if storage is unavailable or the payload fails validation. */
export function loadEvidence():readonly ImportedEvidence[]{
 const backend=getBackend();if(!backend)return [];
 const raw=backend.getItem(EVIDENCE_KEY);if(!raw)return [];
 try{return importVerificationDrafts(raw);}catch{return [];}
}

/** Remove all persisted evidence. */
export function clearEvidence():void{
 const backend=getBackend();if(!backend)return;
 backend.removeItem(EVIDENCE_KEY);
}
