import {readFile,writeFile,mkdir,lstat,realpath,readdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {resolve,join,dirname,relative,isAbsolute} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {packageFiles,allowedPackagePath} from './package-policy.mjs';
import {assertPortableEntryGuard} from './portable-entry-guard.mjs';
import {NATIVE_BASELINE} from './native-entry-adapters.mjs';
import {windowsEnvironment} from './portable-layout.mjs';

// Experimental, opt-in assembly from explicitly supplied LOCAL materials.
// This is not the default P0 bootstrap, an updater, or a runtime downloader.
// npm/uv installation and builds happen only after --apply-experimental.
const repository=fileURLToPath(new URL('../../',import.meta.url));
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const fail=code=>{throw new Error(code);};
const requiredRuntime=['python/python.exe','node/node.exe','node/node_modules/npm/bin/npm-cli.js','uv/uv.exe','git/cmd/git.exe','git/bin/bash.exe'];
const runtimeRoots=new Set(['python','node','uv','git','bin']);
const shellFiles=['launch.bat','scripts/open-hermes.ps1','scripts/start-web-workbench.ps1'];
const secretName=/(^|\/)(?:\.env(?:\..*)?|\.npmrc|\.gitconfig|auth\.json|credentials?)(?:\/|$)/i;
async function exists(path){try{await lstat(path);return true;}catch(error){if(error.code==='ENOENT')return false;throw error;}}
async function plain(path){
 const parent=dirname(path);if(parent!==path)await plain(parent);
 const info=await lstat(path);if(info.isSymbolicLink())fail('EXPERIMENT_LINK_REJECTED');return info;
}
function childPath(path){
 return typeof path==='string'&&/^[A-Za-z0-9_.@+/-]+$/.test(path)&&!path.split('/').some(p=>!p||p==='.'||p==='..'||p.endsWith('.')||p.endsWith(' '))&&!secretName.test(path);
}
function contains(a,b){const r=relative(a,b);return r===''||(!r.startsWith('..')&&!isAbsolute(r));}
async function put(path,bytes){await mkdir(dirname(path),{recursive:true});await writeFile(path,bytes,{flag:'wx'});}
async function copied(from,to,expected){
 if(!(await plain(from)).isFile())fail('EXPERIMENT_FILE_REQUIRED');
 const bytes=await readFile(from);
 if(expected&&(bytes.length!==expected.size||digest(bytes)!==expected.sha256))fail('EXPERIMENT_MATERIAL_CHANGED');
 await put(to,bytes);return {size:bytes.length,sha256:digest(bytes)};
}
async function walk(root,prefix=''){
 const entries=[];
 for(const name of (await readdir(join(root,prefix))).sort()){
  const path=prefix?prefix+'/'+name:name;if(!childPath(path))fail('EXPERIMENT_ASSET_PATH_REJECTED');
  const info=await plain(join(root,path));
  if(info.isDirectory())entries.push(...await walk(root,path));
  else if(info.isFile())entries.push(path);else fail('EXPERIMENT_ASSET_PATH_REJECTED');
 }
 return entries;
}
function execute(file,args,options){
 return execFileSync(file,args,{...options,encoding:'utf8',stdio:['ignore','pipe','pipe'],windowsHide:true,timeout:30*60*1000,maxBuffer:16*1024*1024});
}
function gitEnvironment(host){
 const env={};for(const key of ['SystemRoot','WINDIR','PATH','TEMP','TMP'])if(host[key])env[key]=host[key];
 return {...env,GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:process.platform==='win32'?'NUL':'/dev/null',GIT_TERMINAL_PROMPT:'0',GIT_ALLOW_PROTOCOL:'file',GIT_OPTIONAL_LOCKS:'0'};
}

// Manifest hashes identify operator-approved local runtime bytes, not official
// archive provenance. Approval of their origin remains an explicit prerequisite.
export async function inspectExperiment(options,{run=execute,host=process.env}={}){
 const {project,source,runtime,inventory,target,projectCommit}=options;
 if(![project,source,runtime,inventory,target].every(p=>typeof p==='string'&&isAbsolute(p))||!(/^[a-f0-9]{40}$/.test(projectCommit||'')))fail('EXPERIMENT_ARGUMENTS_INVALID');
 const roots=[];
 for(const p of [project,source,runtime]){if(!(await plain(p)).isDirectory())fail('EXPERIMENT_DIRECTORY_REQUIRED');roots.push(await realpath(p));}
 const parent=await realpath(dirname(target));await plain(dirname(target));
 const destination=join(parent,relative(dirname(target),target));
 if(destination===parent||await exists(destination))fail('EXPERIMENT_TARGET_EXISTS');
 for(const root of roots)if(contains(root,destination)||contains(destination,root))fail('EXPERIMENT_ROOTS_OVERLAP');
 if(!(await plain(inventory)).isFile())fail('EXPERIMENT_INVENTORY_REQUIRED');
 const bytes=await readFile(inventory),record=JSON.parse(bytes);
 if(record.schema!==1||record.kind!=='approved-local-runtime'||!Array.isArray(record.files)||record.files.length===0||record.files.length>100000)fail('EXPERIMENT_INVENTORY_INVALID');
 const componentLockBytes=await readFile(join(roots[0],'manifests','runtime-components.windows-x64.json'));
 if(record.componentLockSha256!==digest(componentLockBytes))fail('EXPERIMENT_RUNTIME_LOCK_MISMATCH');
 const componentLock=JSON.parse(componentLockBytes);
 const names=new Set();
 for(const f of record.files){
  if(!childPath(f.path)||!runtimeRoots.has(f.path.split('/')[0])||names.has(f.path.toLowerCase())||!Number.isSafeInteger(f.size)||f.size<0||!(/^[a-f0-9]{64}$/.test(f.sha256||'')))fail('EXPERIMENT_INVENTORY_INVALID');
  names.add(f.path.toLowerCase());
  const path=join(roots[2],f.path);if(!(await plain(path)).isFile())fail('EXPERIMENT_FILE_REQUIRED');
  const data=await readFile(path);if(data.length!==f.size||digest(data)!==f.sha256)fail('EXPERIMENT_MATERIAL_CHANGED');
 }
 for(const p of requiredRuntime)if(!names.has(p.toLowerCase()))fail('EXPERIMENT_RUNTIME_INCOMPLETE');
 const git=join(roots[2],'git','cmd','git.exe'),env=gitEnvironment(host);
 const call=(cwd,args)=>String(run(git,['-C',cwd,...args],{env})).trim();
 for(const [cwd,commit] of [[roots[0],projectCommit],[roots[1],NATIVE_BASELINE]]){
  if(call(cwd,['rev-parse','--verify','HEAD'])!==commit)fail('EXPERIMENT_SOURCE_MISMATCH');
  if(call(cwd,['status','--porcelain=v1','--untracked-files=no']))fail('EXPERIMENT_DIRTY_SOURCE');
  if(await exists(join(cwd,'.env')))fail('EXPERIMENT_SOURCE_ENV_REJECTED');
 }
 // The caller must use the reviewed project's assembler, not a different tree's
 // launcher allowlist or coordination manifest.
 if(await realpath(repository)!==roots[0])fail('EXPERIMENT_ASSEMBLER_SOURCE_MISMATCH');
 return {project:roots[0],source:roots[1],runtime:roots[2],target:destination,projectCommit,record,componentLock,inventorySha256:digest(bytes),git,gitEnv:env};
}

export async function prepareExperiment(options,{apply=false,platform=process.platform,run=execute,host=process.env}={}){
 if(platform!=='win32')fail('WINDOWS_REQUIRED');
 const input=await inspectExperiment(options,{run,host});
 const summary={schema:1,status:'plan-only',baseline:NATIVE_BASELINE,projectCommit:input.projectCommit,inventorySha256:input.inventorySha256,release_ready:false,
  effects:['new-root-only','local-git-clones','npm-registry-and-lifecycle-scripts','uv-python-dependencies-and-builds','workbench-and-dashboard-builds'],startsHermes:false};
 if(!apply)return summary;
 // mkdir without recursive is the exclusive claim: even an empty existing root
 // is rejected. Never clean up or retry an interrupted root automatically.
 await mkdir(input.target);const root=await realpath(input.target);
 const marker=join(root,'logs','diagnostics','p2-install-active.json');
 await put(marker,JSON.stringify({schema:1,kind:'native-experiment-preparation',recovery:'preserve-and-review',release_ready:false}));
 let stage='runtime';
 try{
  const runtime=join(root,'.cache','runtimes','windows-x64');
  for(const f of input.record.files)await copied(join(input.runtime,f.path),join(runtime,f.path),f);
  const git=join(runtime,'git','cmd','git.exe');
  const gitCall=(args)=>String(run(git,args,{env:input.gitEnv})).trim();
  const source=join(root,'src','hermes-agent'),project=join(root,'.cache','preparation','project');
  stage='source';
  for(const [from,to,sha] of [[input.source,source,NATIVE_BASELINE],[input.project,project,input.projectCommit]]){
   await mkdir(dirname(to),{recursive:true});
   gitCall(['clone','--no-local','--no-checkout','--',from,to]);
   gitCall(['-C',to,'checkout','--detach',sha]);
   gitCall(['-C',to,'remote','remove','origin']);
   if(gitCall(['-C',to,'rev-parse','HEAD'])!==sha)fail('EXPERIMENT_SOURCE_MISMATCH');
  }
  const env=windowsEnvironment(root,host);
  const profile=join(root,'.cache','preparation','profile'),temp=join(root,'.cache','preparation','tmp');
  await mkdir(profile,{recursive:true});await mkdir(temp,{recursive:true});await mkdir(join(root,'data'));
  Object.assign(env,{USERPROFILE:profile,HOME:profile,TEMP:temp,TMP:temp,
   npm_config_cache:join(root,'.cache','npm-cache'),UV_CACHE_DIR:join(root,'.cache','uv-cache'),
   UV_PROJECT_ENVIRONMENT:join(runtime,'venv'),UV_PYTHON_DOWNLOADS:'never',GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:'NUL',GIT_TERMINAL_PROMPT:'0'});
  // Do not inherit provider keys, pip/npm credentials, personal configs or a
  // host profile. Registry auth/proxies need a separately reviewed extension.
  const node=join(runtime,'node','node.exe'),npm=join(runtime,'node','node_modules','npm','bin','npm-cli.js');
  const command=(file,args,cwd)=>String(run(file,args,{cwd,env})).trim();
  stage='versions';
  const nodeVersion=command(node,['--version'],root),npmVersion=command(node,[npm,'--version'],root);
  const n=/^v(\d+)\.(\d+)\.(\d+)$/.exec(nodeVersion),m=/^(\d+)\.(\d+)\.(\d+)$/.exec(npmVersion);
  if(!n||!(+n[1]===22&&+n[2]>=22||+n[1]===24&&+n[2]>=11||+n[1]>=26)||!m||(+m[1]===11&&+m[2]>=10&&+m[2]<17))fail('EXPERIMENT_NODE_NPM_UNSUPPORTED');
  const python=join(runtime,'python','python.exe');
  const pythonVersion=command(python,['-I','-c','import sys; print(".".join(map(str,sys.version_info[:3])))'],root);
  if(!/^3\.(11|12|13)\.\d+$/.test(pythonVersion))fail('EXPERIMENT_PYTHON_UNSUPPORTED');
  const lockedVersion=id=>input.componentLock.components.find(c=>c.id===id)?.version;
  if(nodeVersion!=='v'+lockedVersion('node')||pythonVersion!==lockedVersion('python')?.split('+')[0])fail('EXPERIMENT_RUNTIME_VERSION_MISMATCH');
  stage='python-dependencies';
  command(join(runtime,'uv','uv.exe'),['sync','--locked','--no-dev','--extra','all','--python',python],source);
  const venvPython=join(runtime,'venv','Scripts','python.exe');
  if(!(await plain(venvPython)).isFile())fail('EXPERIMENT_VENV_MISSING');
  command(join(runtime,'uv','uv.exe'),['pip','check','--python',venvPython],source);
  stage='dashboard-build';
  command(node,[npm,'ci','--workspace','web','--include-workspace-root'],source);
  command(node,[npm,'run','build','--workspace','web'],source);
  stage='workbench-build';
  command(node,[npm,'ci'],join(project,'workbench'));
  command(node,[npm,'run','build'],join(project,'workbench'));
  for(const [cwd,sha] of [[source,NATIVE_BASELINE],[project,input.projectCommit]]){
   if(gitCall(['-C',cwd,'rev-parse','HEAD'])!==sha||gitCall(['-C',cwd,'status','--porcelain=v1','--untracked-files=no']))fail('EXPERIMENT_BUILD_CHANGED_SOURCE');
  }
  stage='payload';
  const tracked=gitCall(['-C',project,'ls-files','-z']).split('\0').filter(Boolean);
  const shell=tracked.filter(p=>p==='launch.bat'||p==='P0-Workbench.bat'||p.startsWith('scripts/')||p.startsWith('manifests/'));
  const assets=await walk(join(project,'workbench','dist'));
  if(!assets.includes('index.html'))fail('EXPERIMENT_WORKBENCH_ASSETS_MISSING');
  const payload=[...new Set([...shell,...packageFiles,...assets.map(p=>'workbench/dist/'+p)])];
  const payloadIdentity=[];
  for(const p of payload){
   if(!childPath(p)||p.startsWith('workbench/dist/')&&!allowedPackagePath(p))fail('EXPERIMENT_ASSET_PATH_REJECTED');
   if(p==='manifests/runtime-components.windows-x64.json')continue;
   payloadIdentity.push({path:p,...await copied(join(project,p),join(root,p))});
  }
  for(const p of shellFiles)if(!payload.includes(p))fail('EXPERIMENT_SHELL_INCOMPLETE');
  const dashboard=await walk(join(source,'hermes_cli','web_dist'));
  if(!dashboard.includes('index.html'))fail('EXPERIMENT_DASHBOARD_ASSETS_MISSING');
  const dashboardIdentity=[];
  for(const p of dashboard){const b=await readFile(join(source,'hermes_cli','web_dist',p));dashboardIdentity.push({path:p,size:b.length,sha256:digest(b)});}
  // Deliberately incompatible with default setup's bootstrap policy. It may not
  // reinstall the default baseline over this experimental root.
  const lock=JSON.parse(await readFile(join(project,'manifests','runtime-components.windows-x64.json'),'utf8'));
  const hermes=lock.components.find(c=>c.id==='hermes-agent');if(!hermes)fail('EXPERIMENT_LOCK_INVALID');
  hermes.version=NATIVE_BASELINE;hermes.version_role='native-experiment';
  hermes.source={type:'git',url:'https://github.com/NousResearch/hermes-agent.git',ref:NATIVE_BASELINE,commit:NATIVE_BASELINE};
  hermes.update_policy={mode:'disabled-for-experiment'};lock.supplemental_python_packages=[];
  lock.experimental_native={schema:1,release_ready:false,projectCommit:input.projectCommit,inventorySha256:input.inventorySha256};
  const lockBytes=Buffer.from(JSON.stringify(lock,null,2)+'\n');
  await put(join(root,'manifests','runtime-components.windows-x64.json'),lockBytes);
  stage='receipt';
  await put(join(runtime,'portable-location.txt'),root+'\n');
  const receipt={...summary,status:'assembled-pending-guard',nodeVersion,npmVersion,pythonVersion,componentLockSha256:digest(lockBytes),payload:payloadIdentity,dashboard:dashboardIdentity};
  await put(join(root,'logs','diagnostics','native-experiment-preparation.json'),JSON.stringify(receipt,null,2)+'\n');
  // Keep the production interrupted-install guard active until all preparation
  // has succeeded. A final guard check must happen after that marker is removed.
  const {unlink}=await import('node:fs/promises');
  await unlink(marker);
  try{
   await assertPortableEntryGuard(root,join(root,'data'));
   await writeFile(join(root,'logs','diagnostics','native-experiment-preparation.json'),JSON.stringify({...receipt,status:'prepared-not-accepted'},null,2)+'\n');
   await put(join(runtime,'ready.flag'),digest(lockBytes)+'\n');
  }catch(error){await put(marker,JSON.stringify({schema:1,kind:'native-experiment-preparation',stage:'final-guard',recovery:'preserve-and-review'}));throw error;}
  return {...summary,status:'prepared-not-accepted'};
 }catch{
  // Raw subprocess output can contain registry credentials or user paths. Do not
  // echo it or claim rollback. Leave this owned root and its marker for review.
  await put(join(root,'logs','diagnostics','native-experiment-failure.json'),JSON.stringify({schema:1,stage,status:'failed-preserved',release_ready:false})).catch(()=>{});
  fail('EXPERIMENT_PREPARATION_FAILED_'+stage.toUpperCase().replace(/-/g,'_'));
 }
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{
  const [config,mode,...extra]=process.argv.slice(2);
  if(!config||extra.length||!['--plan','--apply-experimental'].includes(mode))fail('EXPERIMENT_USAGE');
  const options=JSON.parse(await readFile(resolve(config),'utf8'));
  console.log(JSON.stringify(await prepareExperiment(options,{apply:mode==='--apply-experimental'})));
 }catch{console.error('Native experiment preparation refused or failed. No automatic cleanup/retry; inspect the owned preparation receipt if created.');process.exitCode=1;}
}
