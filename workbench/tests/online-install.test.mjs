import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,readdir,rm,symlink} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {installOnlineExperiment,installationEnvironment} from '../scripts/install-online-experiment.mjs';
import {isMaterialPath} from '../scripts/material-path.mjs';

const baseline='28044757aabd34010bd9f5f3e3f82b0906b46241',commit='a'.repeat(40);
const hash=b=>createHash('sha256').update(b).digest('hex');
async function put(path,data){await mkdir(dirname(path),{recursive:true});await writeFile(path,data);}
async function fixture(t){
 const root=await mkdtemp(join(tmpdir(),'online-test-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const packageRoot=join(root,'package'),target=join(root,'new-target');await mkdir(packageRoot);
 const gitArchive=Buffer.from('synthetic executable - never run');
 const lock={components:[{id:'portablegit',source:{size_bytes:gitArchive.length},integrity:{sha256:hash(gitArchive)}}]};
 const lockBytes=Buffer.from(JSON.stringify(lock));
 const payload=new Map([
  ['runtime/python/python.exe','synthetic'],['runtime/node/node.exe','synthetic'],
  ['runtime/node/node_modules/npm/bin/npm-cli.js','synthetic'],['runtime/uv/uv.exe','synthetic'],['runtime/bin/rg.exe','synthetic'],
  ['runtime/python/Lib/site-packages/setuptools/script (dev).tmpl','synthetic resource'],
  ['archives/portablegit.exe',gitArchive],['runtime-components.windows-x64.json',lockBytes],
 ]);
 const files=[];for(const [path,value] of payload){const data=Buffer.from(value);await put(join(packageRoot,path),data);files.push({path,size:data.length,sha256:hash(data)});}
 const manifest={schema:1,kind:'online-native-experiment',baseline,projectCommit:commit,release_ready:false,files};
 const manifestPath=join(packageRoot,'online-package.json');await writeFile(manifestPath,JSON.stringify(manifest));
 const calls=[];let active=0,maximum=0;
 const run=async(file,args,settings,limits)=>{
  active++;maximum=Math.max(maximum,active);
  try{
   calls.push({file,args,settings,limits});await Promise.resolve();
   if(args[0]==='-y'){
    const runtime=args[1].slice(2);await put(join(runtime,'cmd','git.exe'),'synthetic');await put(join(runtime,'bin','bash.exe'),'synthetic');return '';
   }
   if(args[0]==='init')return '';
   if(args[0]==='-C'){
    if(args[2]==='rev-parse')return args[1].endsWith('project')?commit:baseline;
    if(args[2]==='checkout'&&args[1].endsWith('project'))await put(join(args[1],'manifests','runtime-components.windows-x64.json'),lockBytes);
    return '';
   }
   assert.ok(args[0].endsWith('prepare-native-experiment.mjs'));assert.equal(args[2],'--apply-experimental');
   const config=JSON.parse(await readFile(args[1],'utf8'));assert.equal(config.projectCommit,commit);assert.equal(config.entryScope,'cli-and-dashboard');assert.equal(config.target,target);
   const inventory=JSON.parse(await readFile(config.inventory,'utf8'));assert.equal(inventory.kind,'approved-local-runtime');assert.equal(inventory.componentLockSha256,hash(lockBytes));
   assert.ok(inventory.files.some(f=>f.path.endsWith('script (dev).tmpl')));
   const finalLock=Buffer.from(JSON.stringify({experimental_native:{projectCommit:commit,release_ready:false,entryScope:'cli-and-dashboard'}}));
   const result={status:'prepared-not-accepted',baseline,projectCommit:commit,entryScope:'cli-and-dashboard'};
   await put(join(target,'manifests','runtime-components.windows-x64.json'),finalLock);
   await put(join(target,'.cache','runtimes','windows-x64','ready.flag'),hash(finalLock));
   await put(join(target,'logs','diagnostics','native-experiment-preparation.json'),JSON.stringify(result));
   for(const p of ['P2-Workbench.bat','scripts/start-p2-workbench.ps1','workbench/dist/index.html','src/hermes-agent/hermes_cli/web_dist/index.html'])await put(join(target,p),'synthetic');
   return JSON.stringify(result);
  }finally{active--;}
 };
 return {root,options:{packageRoot,target},manifest,manifestPath,calls,run,maximum:()=>maximum,
  deps:{platform:'win32',host:{SystemRoot:join(root,'windows'),PRIVATE_TOKEN:'do-not-inherit'},run}};
}

test('online chain uses exact source revisions, owned scratch, fresh assembly and artifact readback',async t=>{
 const f=await fixture(t);const result=await installOnlineExperiment(f.options,f.deps);
 assert.equal(result.status,'prepared-not-accepted');assert.equal(result.release_ready,false);assert.equal(f.maximum(),1);
 assert.equal(f.calls.filter(c=>c.args.includes('fetch')).length,2);
 assert.ok(f.calls.filter(c=>c.args.includes('fetch')).every(c=>c.args.includes('--depth=1')&&c.args.includes('credential.helper=')));
 for(const c of f.calls){assert.equal(c.settings.env.PRIVATE_TOKEN,undefined);assert.equal(c.limits.scratch,join(result.work,'tmp'));}
 assert.equal(JSON.parse(await readFile(join(result.work,'online-result.json'),'utf8')).status,'prepared-not-accepted');
});

test('existing destination preserves sentinel and launches zero commands',async t=>{
 const f=await fixture(t);await put(join(f.options.target,'sentinel'),'keep');
 await assert.rejects(installOnlineExperiment(f.options,f.deps),/ONLINE_NEW_TARGET_REQUIRED/);
 assert.equal(await readFile(join(f.options.target,'sentinel'),'utf8'),'keep');assert.equal(f.calls.length,0);
});

test('changed or unlisted material and traversal manifest fail before staging',async t=>{
 const f=await fixture(t);await put(join(f.options.packageRoot,'runtime','extra.dll'),'not listed');
 await assert.rejects(installOnlineExperiment(f.options,f.deps),/ONLINE_UNLISTED_PACKAGE_FILE/);
 await rm(join(f.options.packageRoot,'runtime','extra.dll'));
 await writeFile(join(f.options.packageRoot,'runtime','node','node.exe'),'changed');
 await assert.rejects(installOnlineExperiment(f.options,f.deps),/ONLINE_PACKAGE_CHANGED/);
 f.manifest.files[0].path='../outside';await writeFile(f.manifestPath,JSON.stringify(f.manifest));
 await assert.rejects(installOnlineExperiment(f.options,f.deps),/ONLINE_MANIFEST_INVALID/);
 assert.equal(f.calls.length,0);assert.deepEqual(await readdir(f.root),['package']);
});

test('linked parent and overlapping root are rejected without commands',async t=>{
 const f=await fixture(t);const link=join(f.root,'linked');await symlink(f.options.packageRoot,link,process.platform==='win32'?'junction':'dir');
 await assert.rejects(installOnlineExperiment({...f.options,target:join(link,'new')},f.deps),/ONLINE_LINK_REJECTED/);
 await assert.rejects(installOnlineExperiment({...f.options,target:join(f.options.packageRoot,'new')},f.deps),/ONLINE_NEW_TARGET_REQUIRED/);
 assert.equal(f.calls.length,0);
});

test('unknown extraction teardown preserves workspace and does not fetch or retry',async t=>{
 const f=await fixture(t);let calls=0;
 await assert.rejects(installOnlineExperiment(f.options,{...f.deps,run:async()=>{calls++;throw Object.assign(new Error('private arbitrary detail'),{treeExited:false});}}),/ONLINE_INSTALL_FAILED_RUNTIME/);
 assert.equal(calls,1);const work=(await readdir(f.root)).find(p=>p.startsWith('.hermes-online-'));
 const receipt=await readFile(join(f.root,work,'online-result.json'),'utf8');assert.equal(receipt.includes('private arbitrary detail'),false);
 assert.equal(JSON.parse(receipt).commandTreeExited,false);assert.equal(JSON.parse(receipt).status,'failed-preserved');
});

test('successful command text without matching ready artifact cannot report prepared',async t=>{
 const f=await fixture(t);
 await assert.rejects(installOnlineExperiment(f.options,{...f.deps,run:async(...args)=>{
  const output=await f.run(...args);if(args[1][0].endsWith('prepare-native-experiment.mjs'))await writeFile(join(f.options.target,'.cache','runtimes','windows-x64','ready.flag'),'wrong');return output;
 }}),/ONLINE_INSTALL_FAILED_READBACK/);
});

test('source identity mismatch stops before dependency installation',async t=>{
 const f=await fixture(t);
 await assert.rejects(installOnlineExperiment(f.options,{...f.deps,run:async(...args)=>args[1][2]==='rev-parse'?'b'.repeat(40):f.run(...args)}),/ONLINE_INSTALL_FAILED_SOURCE/);
 assert.ok(f.calls.every(c=>!c.args[0].endsWith('prepare-native-experiment.mjs')));
});

test('material grammar accepts pinned Python resources but denies Windows aliases and traversal',()=>{
 for(const path of ['python/Lib/site-packages/setuptools/launcher manifest.xml','python/Lib/site-packages/setuptools/script (dev).tmpl','python/Lib/site-packages/setuptools/_vendor/jaraco/text/Lorem ipsum.txt'])assert.equal(isMaterialPath(path),true,path);
 for(const path of ['../x','a/../x','/x','a\\x','a:stream','x/CON.txt','x/lpt1','a//b','a/aux','a./b','a /b','a\0b'])assert.equal(isMaterialPath(path),false,path);
});

test('environment drops private configuration and non-Windows invocation fails before filesystem access',async()=>{
 const env=installationEnvironment('/owned','/owned/runtime',{SystemRoot:'/windows',API_KEY:'synthetic',NODE_OPTIONS:'untrusted',HTTP_PROXY:'private'});
 for(const key of ['API_KEY','NODE_OPTIONS','HTTP_PROXY'])assert.equal(env[key],undefined);
 await assert.rejects(installOnlineExperiment({packageRoot:'/missing',target:'/missing/new'},{platform:'linux'}),/WINDOWS_REQUIRED/);
});
