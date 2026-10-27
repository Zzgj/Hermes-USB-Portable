import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,lstat,symlink} from 'node:fs/promises';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {inspectExperiment,prepareExperiment} from '../scripts/prepare-native-experiment.mjs';
import {packageFiles} from '../scripts/package-policy.mjs';
import {NATIVE_BASELINE} from '../scripts/native-entry-adapters.mjs';

// All child commands are counted synchronous doubles. No executable in the
// fixture is run; this suite is NOT Windows/npm/uv/build/entry acceptance.
const repo=fileURLToPath(new URL('../../',import.meta.url));
const projectCommit='a'.repeat(40);
const hash=b=>createHash('sha256').update(b).digest('hex');
const componentLockSha256=hash(readFileSync(join(repo,'manifests/runtime-components.windows-x64.json')));
const shell=['launch.bat','P2-Workbench.bat','scripts/start-p2-workbench.ps1','scripts/open-hermes.ps1','scripts/start-web-workbench.ps1'];
const trackedShell=[...shell,'manifests/runtime-components.windows-x64.json','manifests/portable-release.json'];
const runtimeFiles=['python/python.exe','node/node.exe','node/node_modules/npm/bin/npm-cli.js','uv/uv.exe','git/cmd/git.exe','git/bin/bash.exe'];
const exists=async p=>{try{await lstat(p);return true;}catch(e){if(e.code==='ENOENT')return false;throw e;}};
function put(path,bytes){mkdirSync(dirname(path),{recursive:true});writeFileSync(path,bytes);}
async function fixture(t){
 const root=await mkdtemp(join(tmpdir(),'native-experiment-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const source=join(root,'input-source'),runtime=join(root,'input-runtime'),inventory=join(root,'inventory.json'),target=join(root,'target');
 await mkdir(source);await mkdir(runtime);
 const files=[];
 for(const path of runtimeFiles){const bytes=Buffer.from('synthetic runtime '+path);put(join(runtime,path),bytes);files.push({path,size:bytes.length,sha256:hash(bytes)});}
 await writeFile(inventory,JSON.stringify({schema:1,kind:'approved-local-runtime',componentLockSha256,files}));
 const options={project:repo,source,runtime,inventory,target,projectCommit};
 const calls=[];
 function run(file,args,settings){
  calls.push({file,args,settings});
  if(args[0]==='-C'){
   if(args[2]==='rev-parse')return args[1]===source||args[1].endsWith('hermes-agent')?NATIVE_BASELINE:projectCommit;
   if(args[2]==='status')return '';
   if(args[2]==='ls-files')return trackedShell.join('\0')+'\0';
   if(['checkout','remote'].includes(args[2]))return '';
  }
  if(args[0]==='clone'){
   const destination=args.at(-1);mkdirSync(destination,{recursive:true});
   if(destination.endsWith('project')){
    for(const p of new Set([...packageFiles,...trackedShell]))put(join(destination,p),readFileSync(join(repo,p)));
   }else put(join(destination,'hermes_cli','main.py'),'# synthetic source');
   return '';
  }
  if(args[0]==='--version')return 'v22.22.3';
  if(args[1]==='--version')return '10.9.0';
  if(args[0]==='-I')return '3.11.15';
  if(args[0]==='sync'){put(join(target,'.cache','runtimes','windows-x64','venv','Scripts','python.exe'),'synthetic venv');return '';}
  if(args[0]==='pip')return '';
  if(args[1]==='ci')return '';
  if(args[1]==='run'&&args[2]==='build'){
   if(settings.cwd.endsWith('hermes-agent'))put(join(settings.cwd,'hermes_cli','web_dist','index.html'),'synthetic dashboard');
   else put(join(settings.cwd,'dist','index.html'),'synthetic workbench');
   return '';
  }
  throw new Error('Unexpected synthetic command');
 }
 return {root,options,calls,run,files,deps:{platform:'win32',run,host:{SystemRoot:'C:\\Windows',PATH:'synthetic-host-path',PRIVATE_TOKEN:'must-not-copy'}}};
}

test('plan checks identities and runtime bytes without creating a target or installing',async t=>{
 const {options,calls,deps}=await fixture(t);
 const result=await prepareExperiment(options,deps);
 assert.equal(result.status,'plan-only');assert.equal(await exists(options.target),false);
 assert.ok(calls.every(c=>c.args[0]==='-C'&&['rev-parse','status'].includes(c.args[2])));
});

test('existing target is rejected without commands or modifications',async t=>{
 const {options,calls,deps}=await fixture(t);await mkdir(options.target);await writeFile(join(options.target,'sentinel'),'keep');
 await assert.rejects(prepareExperiment(options,{...deps,apply:true}),/EXPERIMENT_TARGET_EXISTS/);
 assert.equal(calls.length,0);assert.equal(await readFile(join(options.target,'sentinel'),'utf8'),'keep');
});

test('runtime hash mismatch and traversal inventory reject before any command',async t=>{
 const {options,calls,deps,files}=await fixture(t);
 await writeFile(join(options.runtime,files[0].path),'changed');
 await assert.rejects(prepareExperiment(options,deps),/EXPERIMENT_MATERIAL_CHANGED/);
 files[0].path='../outside';await writeFile(options.inventory,JSON.stringify({schema:1,kind:'approved-local-runtime',componentLockSha256,files}));
 await assert.rejects(prepareExperiment(options,deps),/EXPERIMENT_INVENTORY_INVALID/);assert.equal(calls.length,0);
});

test('source SHA mismatch and source env reject without creating target',async t=>{
 const {options,run,deps}=await fixture(t);
 await assert.rejects(inspectExperiment(options,{...deps,run:(file,args,settings)=>args[2]==='rev-parse'?'b'.repeat(40):run(file,args,settings)}),/EXPERIMENT_SOURCE_MISMATCH/);
 await writeFile(join(options.source,'.env'),'synthetic-secret-not-read');
 await assert.rejects(prepareExperiment(options,deps),/EXPERIMENT_SOURCE_ENV_REJECTED/);
 assert.equal(await exists(options.target),false);
});

test('linked runtime and overlapping destination reject',async t=>{
 const {options,deps,root}=await fixture(t);
 await assert.rejects(prepareExperiment({...options,target:join(options.runtime,'nested')},deps),/EXPERIMENT_ROOTS_OVERLAP/);
 const linked=join(root,'linked-runtime');await symlink(options.runtime,linked,process.platform==='win32'?'junction':'dir');
 await assert.rejects(prepareExperiment({...options,runtime:linked},deps),/EXPERIMENT_LINK_REJECTED/);
});

test('apply wires fixed source, fresh venv, both builds and final readiness without launching Hermes',async t=>{
 const {options,calls,deps}=await fixture(t);
 const result=await prepareExperiment(options,{...deps,apply:true});
 assert.equal(result.status,'prepared-not-accepted');assert.equal(result.release_ready,false);
 const root=options.target,runtime=join(root,'.cache','runtimes','windows-x64');
 const lock=await readFile(join(root,'manifests','runtime-components.windows-x64.json'));
 assert.equal((await readFile(join(runtime,'ready.flag'),'utf8')).trim(),hash(lock));
 assert.equal(JSON.parse(lock).components.find(c=>c.id==='hermes-agent').source.commit,NATIVE_BASELINE);
 assert.equal(packageFiles.includes('manifests/portable-release.json'),false,'first-install identity is not a legacy P2 payload');
 assert.deepEqual(await readFile(join(root,'manifests','portable-release.json')),await readFile(join(repo,'manifests','portable-release.json')));
 assert.equal(await exists(join(root,'logs','diagnostics','p2-install-active.json')),false);
 assert.ok(calls.some(c=>c.args[0]==='sync'&&c.args.includes('--locked')));
 assert.equal(calls.filter(c=>c.args[1]==='run'&&c.args[2]==='build').length,2);
 assert.ok(calls.every(c=>!c.settings.env.PRIVATE_TOKEN));
 assert.ok(calls.every(c=>!c.args.includes('hermes_cli.main')));
 assert.equal(await exists(join(root,'data','.env')),false);
 assert.equal(await exists(join(root,'P2-Workbench.bat')),true);
 assert.equal(await exists(join(root,'scripts','start-p2-workbench.ps1')),true);
});

test('failed dependency command preserves root and marker without ready.flag or later builds',async t=>{
 const {options,calls,run,deps}=await fixture(t);
 const failing=(file,args,settings)=>{if(args[0]==='sync')throw new Error('synthetic dependency failure');return run(file,args,settings);};
 await assert.rejects(prepareExperiment(options,{...deps,run:failing,apply:true}),/EXPERIMENT_PREPARATION_FAILED_PYTHON_DEPENDENCIES/);
 assert.equal(await exists(join(options.target,'logs','diagnostics','p2-install-active.json')),true);
 assert.equal(await exists(join(options.target,'.cache','runtimes','windows-x64','ready.flag')),false);
 assert.equal(calls.filter(c=>c.args[1]==='run').length,0);
 const failure=await readFile(join(options.target,'logs','diagnostics','native-experiment-failure.json'),'utf8');
 assert.equal(failure.includes('synthetic dependency failure'),false);
});

test('CLI-only preparation builds workbench without installing or building the upstream web workspace',async t=>{
 const {options,calls,deps}=await fixture(t);
 const result=await prepareExperiment({...options,entryScope:'cli'},{...deps,apply:true});
 assert.equal(result.entryScope,'cli');assert.equal(result.status,'prepared-not-accepted');
 assert.ok(calls.every(c=>!c.args.includes('--workspace')));
 assert.equal(calls.filter(c=>c.args[1]==='run'&&c.args[2]==='build').length,1);
 assert.equal(await exists(join(options.target,'workbench','dist','index.html')),true);
 assert.equal(await exists(join(options.target,'src','hermes-agent','hermes_cli','web_dist')),false);
 const receipt=JSON.parse(await readFile(join(options.target,'logs','diagnostics','native-experiment-preparation.json'),'utf8'));
 assert.equal(receipt.entryScope,'cli');assert.deepEqual(receipt.dashboard,[]);
 const lock=JSON.parse(await readFile(join(options.target,'manifests','runtime-components.windows-x64.json'),'utf8'));
 assert.equal(lock.experimental_native.entryScope,'cli');assert.equal(lock.experimental_native.release_ready,false);
});

test('unknown entry scope rejects before any filesystem staging or child command',async t=>{
 const {options,calls,deps}=await fixture(t);
 await assert.rejects(prepareExperiment({...options,entryScope:'anything'},{...deps,apply:true}),/EXPERIMENT_ENTRY_SCOPE_INVALID/);
 assert.equal(calls.length,0);assert.equal(await exists(options.target),false);
});

test('assembly awaits supervised commands instead of treating pending output as a source identity',async t=>{
 const {options,run,deps}=await fixture(t);
 let active=0,maximum=0;
 const supervised=async(...args)=>{
  active++;maximum=Math.max(maximum,active);
  await Promise.resolve();
  try{return run(...args);}finally{active--;}
 };
 const result=await prepareExperiment({...options,entryScope:'cli'},{...deps,run:supervised,apply:true});
 assert.equal(result.status,'prepared-not-accepted');assert.equal(maximum,1);assert.equal(active,0);
});

test('unconfirmed supervised teardown stops assembly and preserves its blocked root',async t=>{
 const {options,run,calls,deps}=await fixture(t);
 const supervised=async(file,args,settings)=>{
  await Promise.resolve();
  if(args[0]==='sync')throw Object.assign(new Error('EXPERIMENT_COMMAND_TREE_UNCONFIRMED'),{treeExited:false});
  return run(file,args,settings);
 };
 await assert.rejects(prepareExperiment(options,{...deps,run:supervised,apply:true}),/EXPERIMENT_PREPARATION_FAILED_PYTHON_DEPENDENCIES/);
 assert.equal(await exists(join(options.target,'logs','diagnostics','p2-install-active.json')),true);
 assert.equal(await exists(join(options.target,'.cache','runtimes','windows-x64','ready.flag')),false);
 assert.equal(calls.some(c=>c.args[1]==='ci'||c.args[1]==='run'),false);
 const failure=JSON.parse(await readFile(join(options.target,'logs','diagnostics','native-experiment-failure.json'),'utf8'));
 assert.equal(failure.commandTreeExited,false);assert.equal(failure.status,'failed-preserved');
});

test('final guard rejection restores the blocking marker and never publishes readiness',async t=>{
 const {options,run,deps}=await fixture(t);
 const tamper=(file,args,settings)=>{
  const result=run(file,args,settings);
  if(args[0]==='clone'&&args.at(-1).endsWith('project'))put(join(args.at(-1),'launch.bat'),'synthetic mismatch');
  return result;
 };
 await assert.rejects(prepareExperiment(options,{...deps,run:tamper,apply:true}),/EXPERIMENT_PREPARATION_FAILED_/);
 assert.equal(await exists(join(options.target,'logs','diagnostics','p2-install-active.json')),true);
 assert.equal(await exists(join(options.target,'.cache','runtimes','windows-x64','ready.flag')),false);
 const receipt=JSON.parse(await readFile(join(options.target,'logs','diagnostics','native-experiment-preparation.json'),'utf8'));
 assert.notEqual(receipt.status,'prepared-not-accepted');
});

test('readiness publication failure cannot leave a successful preparation receipt',async t=>{
 const {options,run,deps}=await fixture(t);
 const collision=(file,args,settings)=>{
  const result=run(file,args,settings);
  if(args[0]==='sync')mkdirSync(join(options.target,'.cache','runtimes','windows-x64','ready.flag'));
  return result;
 };
 await assert.rejects(prepareExperiment(options,{...deps,run:collision,apply:true}),/EXPERIMENT_PREPARATION_FAILED_/);
 assert.equal(await exists(join(options.target,'logs','diagnostics','p2-install-active.json')),true);
 const receipt=JSON.parse(await readFile(join(options.target,'logs','diagnostics','native-experiment-preparation.json'),'utf8'));
 assert.notEqual(receipt.status,'prepared-not-accepted');
});
