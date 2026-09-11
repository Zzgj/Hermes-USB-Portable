import fs,{readFile,lstat,mkdir,writeFile,unlink,realpath} from 'node:fs/promises';
import {join,dirname,resolve,relative,isAbsolute} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {packageFiles,allowedPackagePath} from './package-policy.mjs';
import {acquireInstanceLock} from './instance-lock.mjs';
const hash=value=>createHash('sha256').update(value).digest('hex');
async function info(path){try{return await lstat(path);}catch(error){if(error.code==='ENOENT')return null;throw error;}}
async function noLinks(path){
 const parent=dirname(path);if(parent!==path)await noLinks(parent);
 const item=await info(path);if(item?.isSymbolicLink())throw new Error('INSTALL_LINK_REJECTED');
}
async function replace(path,bytes){
 await noLinks(path);await mkdir(dirname(path),{recursive:true});
 const temporary=path+'.p2-'+randomUUID();
 await writeFile(temporary,bytes,{flag:'wx'});
 try{await fs.rename(temporary,path);}catch(error){await unlink(temporary);throw error;}
}
export async function installP2Package(packageRoot,target,{apply=false}={}){
 if(!isAbsolute(packageRoot)||!isAbsolute(target))throw new Error('ABSOLUTE_PATHS_REQUIRED');
 await noLinks(packageRoot);await noLinks(target);
 packageRoot=await realpath(packageRoot);target=await realpath(target);
 const overlap=(base,path)=>{const rel=relative(base,path);return rel===''||(!rel.startsWith('..')&&!isAbsolute(rel));};
 if(overlap(packageRoot,target)||overlap(target,packageRoot)||target===dirname(target))throw new Error('INSTALL_TARGET_INVALID');
 if(!(await info(join(target,'launch.bat')))?.isFile())throw new Error('PORTABLE_TARGET_REQUIRED');
 const marker=join(target,'logs','diagnostics','p2-install-active.json');
 await noLinks(marker);if(await info(marker))throw new Error('INTERRUPTED_INSTALL_REQUIRES_RECOVERY');
 await noLinks(join(packageRoot,'p2-package.json'));
 const manifest=JSON.parse(await readFile(join(packageRoot,'p2-package.json'),'utf8'));
 if(manifest.schema!==1||manifest.package!=='Hermes-Portable-P2'||manifest.release_ready!==false||manifest.status!=='development-snapshot'||!Array.isArray(manifest.files)||manifest.files.length>2000)throw new Error('INVALID_PACKAGE_MANIFEST');
 const seen=new Set(),entries=[];
 for(const file of manifest.files){
  if(!allowedPackagePath(file.path)||seen.has(file.path.toLowerCase())||!Number.isSafeInteger(file.size)||file.size<0||!/^[a-f0-9]{64}$/.test(file.sha256))throw new Error('INVALID_PACKAGE_ENTRY');
  seen.add(file.path.toLowerCase());await noLinks(join(packageRoot,file.path));await noLinks(join(target,file.path));
  const bytes=await readFile(join(packageRoot,file.path));if(bytes.length!==file.size||hash(bytes)!==file.sha256)throw new Error('PACKAGE_HASH_MISMATCH');
  const old=await info(join(target,file.path));if(old&&!old.isFile())throw new Error('TARGET_NOT_FILE');
  entries.push({...file,bytes});
 }
 for(const path of [...packageFiles,'workbench/dist/index.html'])if(!seen.has(path.toLowerCase()))throw new Error('PACKAGE_INCOMPLETE');
 if(!apply)return {status:'verified',files:entries.length};
 await noLinks(join(target,'data'));await noLinks(join(target,'logs','diagnostics'));
 const lock=await acquireInstanceLock(join(target,'data'));
 const backup=join(target,'logs','diagnostics','p2-package-'+randomUUID()),written=[];
 let marked=false;
 try{
  await mkdir(backup,{recursive:true});
  for(const entry of entries){
   const old=await info(join(target,entry.path));entry.previous=old?await readFile(join(target,entry.path)):null;
   if(entry.previous){const saved=join(backup,entry.path);await mkdir(dirname(saved),{recursive:true});await writeFile(saved,entry.previous,{flag:'wx'});if(hash(await readFile(saved))!==hash(entry.previous))throw new Error('BACKUP_VERIFY_FAILED');}
  }
  await writeFile(join(backup,'restore-manifest.json'),JSON.stringify(entries.map(entry=>({path:entry.path,existed:entry.previous!==null,old_sha256:entry.previous===null?null:hash(entry.previous),new_sha256:entry.sha256})),null,2));
  await writeFile(marker,JSON.stringify({schema:1,backup:relative(target,backup).split('\\').join('/')}),{flag:'wx'});marked=true;
  for(const entry of entries){
   await replace(join(target,entry.path),entry.bytes);written.push(entry);
   if(hash(await readFile(join(target,entry.path)))!==entry.sha256)throw new Error('INSTALL_VERIFY_FAILED');
  }
  await unlink(marker);marked=false;
  return {status:'installed-development-snapshot',files:entries.length,backup};
 }catch(error){
  let restored=true;
  for(const entry of written.reverse()){
   try{
    const path=join(target,entry.path);await noLinks(path);
    if(hash(await readFile(path))!==entry.sha256)throw new Error('CHANGED_SINCE_WRITE');
    if(entry.previous!==null)await replace(path,entry.previous);else await unlink(path);
   }catch{restored=false;}
  }
  if(restored&&marked){await unlink(marker);marked=false;}
  throw new Error(restored?'INSTALL_FAILED_ROLLED_BACK':'INSTALL_FAILED_REVIEW_BACKUP');
 }finally{await lock.release();}
}
export async function recoverP2Install(target,{apply=false}={}){
 if(!isAbsolute(target))throw new Error('ABSOLUTE_PATHS_REQUIRED');
 await noLinks(target);target=await realpath(target);
 if(target===dirname(target)||!(await info(join(target,'launch.bat')))?.isFile())throw new Error('PORTABLE_TARGET_REQUIRED');
 const marker=join(target,'logs/diagnostics/p2-install-active.json');
 await noLinks(marker);
 if(!(await info(marker))?.isFile()||(await info(marker)).size>4096)throw new Error('INVALID_RECOVERY_MARKER');
 const markerBytes=await readFile(marker),record=JSON.parse(markerBytes);
 if(record.schema!==1||typeof record.backup!=='string'||!/^logs\/diagnostics\/p2-package-[a-f0-9-]{36}$/.test(record.backup))throw new Error('INVALID_RECOVERY_MARKER');
 const backup=join(target,record.backup),manifestPath=join(backup,'restore-manifest.json');
 await noLinks(manifestPath);
 if(!(await info(manifestPath))?.isFile()||(await info(manifestPath)).size>1024*1024)throw new Error('INVALID_RESTORE_MANIFEST');
 const entries=JSON.parse(await readFile(manifestPath));
 if(!Array.isArray(entries)||entries.length===0||entries.length>2000)throw new Error('INVALID_RESTORE_MANIFEST');
 const seen=new Set(),actions=[];
 for(const entry of entries){
  if(!allowedPackagePath(entry.path)||seen.has(entry.path.toLowerCase())||typeof entry.existed!=='boolean'||!/^[a-f0-9]{64}$/.test(entry.new_sha256)||(entry.existed?!/^[a-f0-9]{64}$/.test(entry.old_sha256):entry.old_sha256!==null))throw new Error('INVALID_RESTORE_ENTRY');
  seen.add(entry.path.toLowerCase());
  const path=join(target,entry.path),saved=join(backup,entry.path);
  await noLinks(path);await noLinks(saved);
  const old=entry.existed?await readFile(saved):null;
  if(old!==null&&hash(old)!==entry.old_sha256)throw new Error('BACKUP_VERIFY_FAILED');
  const item=await info(path);if(item&&!item.isFile())throw new Error('TARGET_NOT_FILE');
  const current=item?hash(await readFile(path)):null;
  if(current!==entry.old_sha256&&current!==entry.new_sha256)throw new Error('RECOVERY_TARGET_CHANGED');
  actions.push({path,old,current,expected:entry.old_sha256});
 }
 for(const path of [...packageFiles,'workbench/dist/index.html'])if(!seen.has(path.toLowerCase()))throw new Error('RESTORE_MANIFEST_INCOMPLETE');
 if(!apply)return {status:'recovery-verified',files:actions.length,backup};
 await noLinks(join(target,'data'));const lock=await acquireInstanceLock(join(target,'data'));
 try{
  // Recheck every target before the first write, then again immediately before each write.
  const check=async action=>{await noLinks(action.path);const item=await info(action.path);if(item&&!item.isFile())throw new Error('RECOVERY_TARGET_CHANGED');if((item?hash(await readFile(action.path)):null)!==action.current)throw new Error('RECOVERY_TARGET_CHANGED');};
  if(!(await readFile(marker)).equals(markerBytes))throw new Error('RECOVERY_MARKER_CHANGED');
  for(const action of actions)await check(action);
  for(const action of actions){
   await check(action);
   if(action.current===action.expected)continue;
   if(action.old===null)await unlink(action.path);else await replace(action.path,action.old);
  }
  for(const action of actions){const item=await info(action.path);if((item?hash(await readFile(action.path)):null)!==action.expected)throw new Error('RECOVERY_VERIFY_FAILED');}
  await noLinks(marker);if(!(await readFile(marker)).equals(markerBytes))throw new Error('RECOVERY_MARKER_CHANGED');
  await unlink(marker);
  return {status:'recovered',files:actions.length,backup};
 }finally{await lock.release();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{
  const [packageRoot,target,flag]=process.argv.slice(2);
  if(packageRoot==='--recover-verify'||packageRoot==='--recover-apply'){
   if(!target||flag)throw new Error('INVALID_ARGUMENTS');
   console.log(JSON.stringify(await recoverP2Install(resolve(target),{apply:packageRoot==='--recover-apply'})));
  }else{
  if(!packageRoot||!target||!['--verify','--apply-experimental'].includes(flag))throw new Error('INVALID_ARGUMENTS');
  console.log(JSON.stringify(await installP2Package(resolve(packageRoot),resolve(target),{apply:flag==='--apply-experimental'})));
  }
 }catch(error){console.error(error.message);process.exitCode=1;}
}
