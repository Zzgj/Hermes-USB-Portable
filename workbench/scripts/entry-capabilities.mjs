import {realpath,lstat} from 'node:fs/promises';
import {isAbsolute,join} from 'node:path';

const kinds=['workbench','cli','tui','dashboard','desktop'];
const assetStates=['present','missing','invalid','unknown'];
// Observation only. Asset presence never authorizes a launch or proves dependencies.
// Version 1 deliberately has no command/path/URL fields or enabled actions.
export function projectEntryCapabilities(value){
 if(!value||value.schemaVersion!==1||!Array.isArray(value.entries)||value.entries.length!==kinds.length)throw new Error('INVALID_ENTRY_CAPABILITIES');
 const entries=kinds.map(kind=>{
  const matches=value.entries.filter(row=>row&&row.kind===kind);
  if(matches.length!==1||!assetStates.includes(matches[0].assetState))throw new Error('INVALID_ENTRY_CAPABILITIES');
  return {kind,assetState:matches[0].assetState,dependencies:'unverified',runtime:'unknown',launch:{allowed:false,reason:'LIFECYCLE_NOT_INTEGRATED'}};
 });
 return {schemaVersion:1,entries};
}

async function observe(root,parts,directory,signal){
 signal?.throwIfAborted();
 if(typeof root!=='string'||!isAbsolute(root))return 'unknown';
 let current;
 try{current=await realpath(root);if(!(await lstat(current)).isDirectory())return 'invalid';}
 catch{signal?.throwIfAborted();return 'unknown';}
 for(let index=0;index<parts.length;index++){
  signal?.throwIfAborted();current=join(current,parts[index]);
  try{
   const item=await lstat(current);signal?.throwIfAborted();
   // Reject all links beneath the configured root, including in-root links.
   // This is a conservative metadata observation, not a future launch path guard.
   if(item.isSymbolicLink())return 'invalid';
   const expectDirectory=index<parts.length-1||directory;
   if(expectDirectory?!item.isDirectory():!item.isFile())return 'invalid';
  }catch(error){signal?.throwIfAborted();return error.code==='ENOENT'?'missing':'unknown';}
 }
 return 'present';
}

export async function inspectEntryCapabilities({source,assetsDir,signal}={}){
 const checks=[
  ['workbench',assetsDir,['index.html'],false],
  ['cli',source,['hermes_cli','main.py'],false],
  ['tui',source,['ui-tui','node_modules'],true],
  ['dashboard',source,['hermes_cli','web_dist','index.html'],false],
  ['desktop',source,['desktop','node_modules'],true],
 ];
 const entries=[];
 for(const [kind,root,parts,directory] of checks){entries.push({kind,assetState:await observe(root,parts,directory,signal)});}
 signal?.throwIfAborted();
 return projectEntryCapabilities({schemaVersion:1,entries});
}
