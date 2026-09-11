import {mkdir,realpath,lstat,writeFile,readFile,unlink,rmdir} from 'node:fs/promises';
import {join,isAbsolute} from 'node:path';
import {randomUUID} from 'node:crypto';

// Atomic mkdir arbitrates cooperating managers. Existing locks are never reclaimed
// based on PID liveness: USB migration and PID reuse make that unsafe.
export async function acquireInstanceLock(runtimeRoot) {
 if(!isAbsolute(runtimeRoot))throw new Error('LOCK_ROOT_MUST_BE_ABSOLUTE');
 const root=await realpath(runtimeRoot),directory=join(root,'.p2-manager-lock');
 try{await mkdir(directory,{mode:0o700});}catch(error){
  if(error.code==='EEXIST')throw new Error('INSTANCE_LOCKED');
  throw new Error('LOCK_CREATE_FAILED');
 }
 const identity=await lstat(directory),owner=join(directory,'owner.json');
 const record=JSON.stringify({schema:1,nonce:randomUUID(),pid:process.pid,created:new Date().toISOString()});
 try{await writeFile(owner,record,{flag:'wx',mode:0o600});}catch{
  // Preserve an incomplete lock rather than risking removal of an unknown file.
  throw new Error('LOCK_INITIALIZATION_FAILED');
 }
 let releasing;
 const release=()=>{
  if(releasing)return releasing;
  releasing=(async()=>{
   const current=await lstat(directory);
   if(current.isSymbolicLink()||current.dev!==identity.dev||current.ino!==identity.ino)throw new Error('LOCK_IDENTITY_CHANGED');
   const file=await lstat(owner);
   if(!file.isFile()||file.isSymbolicLink()||file.size>4096||(await readFile(owner,'utf8'))!==record)throw new Error('LOCK_OWNER_CHANGED');
   await unlink(owner);
   // Nonrecursive: unexpected contents stay untouched and prevent release.
   await rmdir(directory);
  })();return releasing;
 };
 return {release};
}
