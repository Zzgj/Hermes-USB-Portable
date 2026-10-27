// Online first-install coordinator. The release builder supplies reviewed runtimes
// and a fixed source revision; this does not update an existing portable instance.
import {readFile,writeFile,mkdir,mkdtemp,lstat,realpath,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,join,dirname,isAbsolute,relative} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createInterface} from 'node:readline/promises';
import {executeExperimentCommand} from './experiment-command.mjs';
import {isMaterialPath as safePath} from './material-path.mjs';

const baseline='28044757aabd34010bd9f5f3e3f82b0906b46241';
const projectUrl='https://github.com/Zzgj/Hermes-USB-Portable.git';
const sourceUrl='https://github.com/NousResearch/hermes-agent.git';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const fail=code=>{throw new Error(code);};

async function absent(path){try{await lstat(path);return false;}catch(error){if(error.code==='ENOENT')return true;throw error;}}
async function plain(path){const parent=dirname(path);if(parent!==path)await plain(parent);const info=await lstat(path);if(info.isSymbolicLink())fail('ONLINE_LINK_REJECTED');return info;}
async function filesAt(root,prefix=''){
 const files=[];
 for(const name of (await readdir(join(root,prefix))).sort()){
  const path=prefix?prefix+'/'+name:name;if(!safePath(path))fail('ONLINE_PATH_REJECTED');
  const info=await plain(join(root,path));
  if(info.isDirectory())files.push(...await filesAt(root,path));else if(info.isFile())files.push(path);else fail('ONLINE_FILE_REQUIRED');
 }
 return files;
}
function inside(root,path){const r=relative(root,path);return !r||(!r.startsWith('..')&&!isAbsolute(r));}
export function installationEnvironment(work,runtime,host){
 const env={};for(const key of ['SystemRoot','WINDIR','COMSPEC','PATHEXT'])if(typeof host[key]==='string')env[key]=host[key];
 const system=host.SystemRoot||host.WINDIR;if(!system||!isAbsolute(system))fail('ONLINE_SYSTEM_ROOT_REQUIRED');
 Object.assign(env,{USERPROFILE:join(work,'profile'),HOME:join(work,'profile'),TEMP:join(work,'tmp'),TMP:join(work,'tmp'),
  PATH:[join(runtime,'python'),join(runtime,'node'),join(runtime,'uv'),join(runtime,'bin'),join(runtime,'git','cmd'),join(runtime,'git','bin'),join(system,'System32'),system].join(';'),
  PYTHONNOUSERSITE:'1',UV_NO_CONFIG:'1',GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:'NUL',GIT_TERMINAL_PROMPT:'0',GIT_ALLOW_PROTOCOL:'https:file',
  NPM_CONFIG_USERCONFIG:join(work,'empty-npmrc'),npm_config_cache:join(work,'npm-cache'),UV_CACHE_DIR:join(work,'uv-cache')});
 return env;
}
export async function installOnlineExperiment({packageRoot,target},{platform=process.platform,host=process.env,run=executeExperimentCommand,progress=()=>{}}={}){
 if(platform!=='win32')fail('WINDOWS_REQUIRED');
 if(![packageRoot,target].every(p=>typeof p==='string'&&isAbsolute(p)))fail('ONLINE_ABSOLUTE_PATHS_REQUIRED');
 await plain(packageRoot);packageRoot=await realpath(packageRoot);
 await plain(dirname(target));const parent=await realpath(dirname(target));target=join(parent,relative(dirname(target),target));
 if(target===parent||inside(packageRoot,target)||inside(target,packageRoot)||!await absent(target))fail('ONLINE_NEW_TARGET_REQUIRED');
 const manifest=JSON.parse(await readFile(join(packageRoot,'online-package.json'),'utf8'));
 if(manifest.schema!==1||manifest.kind!=='online-native-experiment'||manifest.baseline!==baseline||manifest.release_ready!==false||
  !/^[a-f0-9]{40}$/.test(manifest.projectCommit||'')||!Array.isArray(manifest.files)||manifest.files.length===0||manifest.files.length>100000)fail('ONLINE_MANIFEST_INVALID');
 const names=new Set();
 for(const entry of manifest.files){
  if(!safePath(entry.path)||names.has(entry.path.toLowerCase())||!Number.isSafeInteger(entry.size)||entry.size<0||!/^[a-f0-9]{64}$/.test(entry.sha256||''))fail('ONLINE_MANIFEST_INVALID');
  names.add(entry.path.toLowerCase());const file=join(packageRoot,entry.path);
  if(!(await plain(file)).isFile())fail('ONLINE_FILE_REQUIRED');const data=await readFile(file);
  if(data.length!==entry.size||hash(data)!==entry.sha256)fail('ONLINE_PACKAGE_CHANGED');
 }
 for(const path of ['runtime/python/python.exe','runtime/node/node.exe','runtime/uv/uv.exe','runtime/bin/rg.exe','archives/portablegit.exe','runtime-components.windows-x64.json','manifests/portable-release.json'])if(!names.has(path))fail('ONLINE_PACKAGE_INCOMPLETE');
 const actual=await filesAt(packageRoot);
 if(actual.length!==manifest.files.length+1||actual.some(p=>p!=='online-package.json'&&!names.has(p.toLowerCase())))fail('ONLINE_UNLISTED_PACKAGE_FILE');
 const releaseBytes=await readFile(join(packageRoot,'manifests','portable-release.json'));
 const release=JSON.parse(releaseBytes);
 if(!release||typeof release!=='object'||Array.isArray(release)||release.schema!==1||release.product!=='Hermes-USB-Portable'||
  typeof release.version!=='string'||!/^[A-Za-z0-9][A-Za-z0-9.-]{0,63}$/.test(release.version)||!safePath(release.version)||
  manifest.version!==release.version||release.channel!=='test'||release.hermesCommit!==baseline||release.release_ready!==false||
  release.updateCapability!=='unavailable'||release.distribution?.kind!=='github-releases'||
  release.distribution?.repository!=='Zzgj/Hermes-USB-Portable'||Object.keys(release.distribution).length!==2)fail('ONLINE_RELEASE_INVALID');
 const identities=new Map(manifest.files.map(f=>[f.path,f]));
 const lockBytes=await readFile(join(packageRoot,'runtime-components.windows-x64.json'));
 const lock=JSON.parse(lockBytes),gitComponent=lock.components?.find(c=>c.id==='portablegit');
 const gitBytes=await readFile(join(packageRoot,'archives','portablegit.exe'));
 if(!gitComponent||hash(gitBytes)!==gitComponent.integrity?.sha256||gitBytes.length!==gitComponent.source?.size_bytes)fail('ONLINE_GIT_ARCHIVE_CHANGED');
 // Work is outside the new target. The existing assembler alone claims target.
 // Failures always preserve both roots; no retries, recursive deletion or unlock.
 const work=await mkdtemp(join(parent,'.hermes-online-'));let stage='runtime';
 const receipt=join(work,'online-result.json');
 try{
  const runtime=join(work,'runtime');await mkdir(runtime);
  for(const path of await filesAt(join(packageRoot,'runtime'))){
   const expected=identities.get('runtime/'+path),data=await readFile(join(packageRoot,'runtime',path));
   if(!expected||data.length!==expected.size||hash(data)!==expected.sha256)fail('ONLINE_PACKAGE_CHANGED');
   const destination=join(runtime,path);await mkdir(dirname(destination),{recursive:true});await writeFile(destination,data,{flag:'wx'});
  }
  for(const name of ['profile','tmp'])await mkdir(join(work,name));await writeFile(join(work,'empty-npmrc'),'',{flag:'wx'});
  const env=installationEnvironment(work,runtime,host),python=join(runtime,'python','python.exe');
  const call=async(file,args,cwd=work)=>String(await run(file,args,{python,cwd,env},{scratch:join(work,'tmp')})).trim();
  const gitArchive=join(work,'portablegit.exe');await writeFile(gitArchive,gitBytes,{flag:'wx'});
  progress(stage);await call(gitArchive,['-y','-o'+join(runtime,'git')]);
  const git=join(runtime,'git','cmd','git.exe');
  for(const path of ['git/cmd/git.exe','git/bin/bash.exe'])if(!(await plain(join(runtime,path))).isFile())fail('ONLINE_GIT_INCOMPLETE');
  stage='source';progress(stage);
  const project=join(work,'project'),source=join(work,'hermes');
  for(const [path,url,sha] of [[project,projectUrl,manifest.projectCommit],[source,sourceUrl,baseline]]){
   await mkdir(path);await call(git,['init','--quiet',path]);
   await call(git,['-C',path,'-c','credential.helper=','fetch','--depth=1','--no-tags',url,sha]);
   await call(git,['-C',path,'checkout','--detach','FETCH_HEAD']);
   if(await call(git,['-C',path,'rev-parse','HEAD'])!==sha)fail('ONLINE_SOURCE_MISMATCH');
  }
  if(!lockBytes.equals(await readFile(join(project,'manifests','runtime-components.windows-x64.json'))))fail('ONLINE_COMPONENT_LOCK_MISMATCH');
  const sourceRelease=join(project,'manifests','portable-release.json');await plain(sourceRelease);
  if(!releaseBytes.equals(await readFile(sourceRelease)))fail('ONLINE_RELEASE_SOURCE_MISMATCH');
  const inventory=[];
  for(const path of await filesAt(runtime)){
   if(/(^|\/)(?:\.env(?:\..*)?|\.npmrc|\.gitconfig|auth\.json|credentials?)(?:\/|$)/i.test(path))fail('ONLINE_RUNTIME_PRIVATE_FILE');
   const data=await readFile(join(runtime,path));inventory.push({path,size:data.length,sha256:hash(data)});
  }
  const inventoryPath=join(work,'runtime-inventory.json');
  await writeFile(inventoryPath,JSON.stringify({schema:1,kind:'approved-local-runtime',componentLockSha256:hash(lockBytes),files:inventory}),{flag:'wx'});
  const config=join(work,'assembly.json');
  await writeFile(config,JSON.stringify({project,source,runtime,inventory:inventoryPath,target,projectCommit:manifest.projectCommit,entryScope:'cli-and-dashboard'}),{flag:'wx'});
  stage='dependencies-and-assets';progress(stage);
  const output=await call(join(runtime,'node','node.exe'),[join(project,'workbench','scripts','prepare-native-experiment.mjs'),config,'--apply-experimental'],project);
  const result=JSON.parse(output);
  if(result.status!=='prepared-not-accepted'||result.baseline!==baseline||result.projectCommit!==manifest.projectCommit||result.entryScope!=='cli-and-dashboard')fail('ONLINE_ASSEMBLY_RESULT_INVALID');
  stage='readback';progress(stage);
  const installedRelease=join(target,'manifests','portable-release.json');await plain(installedRelease);
  if(!releaseBytes.equals(await readFile(installedRelease)))fail('ONLINE_RELEASE_READBACK_FAILED');
  const finalLockPath=join(target,'manifests','runtime-components.windows-x64.json');await plain(finalLockPath);
  const finalLockBytes=await readFile(finalLockPath),finalLock=JSON.parse(finalLockBytes);
  const readyPath=join(target,'.cache','runtimes','windows-x64','ready.flag');await plain(readyPath);
  const preparationPath=join(target,'logs','diagnostics','native-experiment-preparation.json');await plain(preparationPath);
  const preparation=JSON.parse(await readFile(preparationPath,'utf8'));
  if((await readFile(readyPath,'utf8')).trim()!==hash(finalLockBytes)||preparation.status!=='prepared-not-accepted'||
   preparation.projectCommit!==manifest.projectCommit||preparation.baseline!==baseline||preparation.entryScope!=='cli-and-dashboard'||
   finalLock.experimental_native?.projectCommit!==manifest.projectCommit||finalLock.experimental_native?.release_ready!==false||
   finalLock.experimental_native?.entryScope!=='cli-and-dashboard'||
   !await absent(join(target,'logs','diagnostics','p2-install-active.json')))fail('ONLINE_READBACK_FAILED');
  for(const path of ['P2-Workbench.bat','scripts/start-p2-workbench.ps1','workbench/dist/index.html','src/hermes-agent/hermes_cli/web_dist/index.html'])if(!(await plain(join(target,path))).isFile())fail('ONLINE_READBACK_FAILED');
  await writeFile(receipt,JSON.stringify({schema:1,status:'prepared-not-accepted',version:release.version,projectCommit:manifest.projectCommit,baseline,release_ready:false}),{flag:'wx'});
  progress('prepared-not-accepted');return {status:'prepared-not-accepted',version:release.version,target,work,release_ready:false};
 }catch(error){
  await writeFile(receipt,JSON.stringify({schema:1,status:'failed-preserved',stage,commandTreeExited:typeof error?.treeExited==='boolean'?error.treeExited:null,release_ready:false}),{flag:'wx'}).catch(()=>{});
  fail('ONLINE_INSTALL_FAILED_'+stage.toUpperCase().replaceAll('-','_'));
 }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 let prompt;
 try{
  const args=process.argv.slice(2);if(args.length)fail('ONLINE_INTERACTIVE_ONLY');
  if(!process.stdin.isTTY)fail('ONLINE_CONFIRMATION_REQUIRED');
  prompt=createInterface({input:process.stdin,output:process.stdout});
  console.log('ONLINE experimental installation. New Windows directory only. Downloads dependencies and runs build scripts. No model call. Existing instances are not updated.');
  const target=(await prompt.question('New absolute target directory (must not exist): ')).trim();
  if(await prompt.question('Type INSTALL to authorize this new-directory installation: ')!=='INSTALL')fail('ONLINE_NOT_CONFIRMED');
  prompt.close();prompt=null;
  const packageRoot=fileURLToPath(new URL('../../',import.meta.url));
  const result=await installOnlineExperiment({packageRoot,target},{progress:stage=>console.log('Stage: '+stage)});
  console.log('Prepared, not acceptance-tested. Start P2-Workbench.bat inside the target. Retain the preparation directory until acceptance.');
  console.log('Target: '+result.target);
  console.log('Version: '+result.version);
 }catch{console.error('Online installation refused or failed. Do not retry over an existing target, remove locks, or delete preparation directories. Preserve the local receipt.');process.exitCode=1;}
 finally{prompt?.close();}
}
