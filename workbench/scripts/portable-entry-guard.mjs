import {readFile,lstat,realpath} from 'node:fs/promises';
import {join,isAbsolute} from 'node:path';
import {createHash} from 'node:crypto';

// Installation-coherence guard, not a signature or a sandbox against a local
// user replacing executable code. All project-controlled launchers must be from
// the same package. Existing external processes must be stopped before upgrade.
export async function assertPortableEntryGuard(root,home){
 if(!isAbsolute(root)||!isAbsolute(home))throw new Error('PORTABLE_ENTRY_ROOT_REQUIRED');
 root=await realpath(root);home=await realpath(home);
 const data=await lstat(join(root,'data'));
 if(data.isSymbolicLink()||!data.isDirectory())throw new Error('PORTABLE_ENTRY_HOME_MISMATCH');
 if(home!==await realpath(join(root,'data')))throw new Error('PORTABLE_ENTRY_HOME_MISMATCH');
 for(const path of [join(root,'logs','diagnostics','p2-install-active.json'),join(root,'updates','hermes-restore-active.json')]){
  try{await lstat(path);throw new Error('INTERRUPTED_INSTALL_REQUIRES_RECOVERY');}catch(error){if(error.code!=='ENOENT')throw error;}
 }
 // No PID liveness inference or auto-reclamation, even for an apparently stale
 // gateway receipt. Non-cooperating pre-upgrade processes are not adopted.
 try{await lstat(join(home,'gateway.pid'));throw new Error('EXTERNAL_ENTRY_REQUIRES_REVIEW');}catch(error){if(error.code!=='ENOENT')throw error;}
 const manifest=JSON.parse(await readFile(new URL('./portable-entry-guard.json',import.meta.url),'utf8'));
 if(manifest.schema!==1||!Array.isArray(manifest.files)||manifest.files.length!==4)throw new Error('ENTRY_COORDINATION_UNCONFIRMED');
 const required=new Set(['launch.bat','scripts/open-hermes.ps1','scripts/start-web-workbench.ps1','workbench/scripts/legacy-hermes-entry.mjs']);
 for(const file of manifest.files){
  if(!required.delete(file.path)||!/^[a-f0-9]{64}$/.test(file.sha256))throw new Error('ENTRY_COORDINATION_UNCONFIRMED');
  let target=root;
  const parts=file.path.split('/');
  for(const [index,part] of parts.entries()){
   target=join(target,part);const metadata=await lstat(target);
   if(metadata.isSymbolicLink()||(index===parts.length-1?!metadata.isFile():!metadata.isDirectory())||metadata.size>128*1024)throw new Error('ENTRY_COORDINATION_UNCONFIRMED');
  }
  // Git may use CRLF on Windows and LF on Linux; compare logical UTF-8 bytes.
  if(createHash('sha256').update((await readFile(target,'utf8')).replace(/\r\n/g,'\n')).digest('hex')!==file.sha256)throw new Error('ENTRY_COORDINATION_UNCONFIRMED');
 }
}
