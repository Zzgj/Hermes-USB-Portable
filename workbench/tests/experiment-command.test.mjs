import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';
import {mkdtemp,writeFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {executeExperimentCommand} from '../scripts/experiment-command.mjs';

// The supervisor is a counted transport double. These tests do not prove native
// Windows Job behavior; no subprocess, installer, or external tool is executed.
async function fixture(t,scenario){
 const scratch=await mkdtemp(join(tmpdir(),'experiment-command-test-'));
 t.after(()=>rm(scratch,{recursive:true,force:true}));
 let handle,launch,kills=0;
 const spawnHost=(python,args,settings)=>{
  launch={python,args,settings};
  handle=new EventEmitter();handle.stdin=new PassThrough();handle.stdout=new PassThrough();handle.stderr=new PassThrough();
  handle.kill=()=>{kills++;handle.emit('close',null);return true;};
  queueMicrotask(()=>Promise.resolve(scenario(handle,args,settings)).catch(e=>{handle.emit('error',e);handle.emit('close',1);}));
  return handle;
 };
 const options={python:join(scratch,'python.exe'),cwd:scratch,env:{ONLY:'fixture'},timeoutMs:1000,stopMs:100};
 const run=overrides=>executeExperimentCommand(join(scratch,'git.exe'),['version'],{...options,...overrides},{platform:'win32',scratch,spawnHost});
 return {scratch,run,get launch(){return launch;},get handle(){return handle;},get kills(){return kills;}};
}
const frame=(host,event)=>host.stdout.write(JSON.stringify(event)+'\n');
const start=host=>frame(host,{event:'started'});
const close=(host,exitCode=0)=>{frame(host,{event:'closed',treeExited:true,exitCode});host.emit('close',0);};
const receiptDirectory=args=>args[args.findIndex(arg=>arg.endsWith('experiment-command-worker.py'))+1];
async function receipt(args,output='ok\n',exitCode=0){
 const directory=receiptDirectory(args);
 await writeFile(join(directory,'stdout.bin'),output);
 await writeFile(join(directory,'result.json'),JSON.stringify({schema:1,exitCode,bytes:Buffer.byteLength(output)}));
}

test('command output is returned only after private close proof, with a clean command directory',async t=>{
 let release,arrived;
 const barrier=new Promise(resolve=>{arrived=resolve;});
 const f=await fixture(t,async(host,args)=>{
  start(host);await receipt(args);arrived();await new Promise(resolve=>{release=resolve;});close(host);
 });
 let settled=false;const operation=f.run().finally(()=>{settled=true;});
 await barrier;await Promise.resolve();assert.equal(settled,false);release();
 assert.equal(await operation,'ok\n');assert.deepEqual(await readdir(f.scratch),[]);
 assert.deepEqual(f.launch.args.slice(0,2),['-I','-B']);assert.equal(f.launch.args[3],'dashboard');
 assert.deepEqual(f.launch.args.slice(5,7),['-I','-B']);
 assert.ok(f.launch.args[7].endsWith('experiment-command-worker.py'));
 assert.equal(f.launch.settings.shell,false);assert.deepEqual(f.launch.settings.env,{ONLY:'fixture'});assert.equal(f.kills,0);
});

test('nonzero business exit is rejected without exposing output after confirmed teardown',async t=>{
 const f=await fixture(t,async(host,args)=>{start(host);await receipt(args,'PRIVATE OUTPUT',7);close(host);});
 await assert.rejects(f.run(),e=>e.message==='EXPERIMENT_COMMAND_FAILED'&&e.treeExited===true);
 assert.deepEqual(await readdir(f.scratch),[]);
});

test('direct host exit and a forged worker receipt cannot replace tree confirmation',async t=>{
 const f=await fixture(t,async(host,args)=>{start(host);await receipt(args);host.emit('close',0);});
 await assert.rejects(f.run(),e=>e.message==='EXPERIMENT_COMMAND_TREE_UNCONFIRMED'&&!e.treeExited);
 assert.equal((await readdir(f.scratch)).length,1);
});

test('transport failure remains latched even after a valid closed frame',async t=>{
 const f=await fixture(t,async(host,args)=>{
  start(host);await receipt(args);host.stdout.emit('error',new Error('private details'));close(host);
 });
 await assert.rejects(f.run(),e=>e.message==='EXPERIMENT_COMMAND_TREE_UNCONFIRMED'&&!e.treeExited);
 assert.equal((await readdir(f.scratch)).length,1);
});

test('timeout requests EOF and rejects only after confirmed cleanup',async t=>{
 const f=await fixture(t,host=>{
  start(host);host.stdin.once('finish',()=>close(host,104));
 });
 await assert.rejects(f.run({timeoutMs:20}),e=>e.message==='EXPERIMENT_COMMAND_TIMEOUT'&&e.treeExited===true);
 assert.equal(f.handle.stdin.writableEnded,true);assert.equal(f.kills,0);assert.deepEqual(await readdir(f.scratch),[]);
});

test('never-close after timeout is unknown, preserves evidence and only kills its owned host',async t=>{
 const f=await fixture(t,host=>{start(host);});
 await assert.rejects(f.run({timeoutMs:10,stopMs:10}),e=>e.message==='EXPERIMENT_COMMAND_TREE_UNCONFIRMED'&&!e.treeExited);
 assert.equal((await readdir(f.scratch)).length,1);
 // A late completion must not retroactively delete the retained command root.
 close(f.handle);assert.equal(f.kills,1);assert.equal((await readdir(f.scratch)).length,1);
});

test('malformed protocol requests stop and cannot be repaired by a later valid frame',async t=>{
 const f=await fixture(t,host=>{start(host);host.stdout.write('not-json\n');close(host);});
 await assert.rejects(f.run(),e=>e.message==='EXPERIMENT_COMMAND_TREE_UNCONFIRMED'&&!e.treeExited);
 assert.equal(f.handle.stdin.writableEnded,true);assert.equal((await readdir(f.scratch)).length,1);
});

test('worker failure is confirmed failure, never successful empty output',async t=>{
 const f=await fixture(t,host=>{start(host);close(host,105);});
 await assert.rejects(f.run(),e=>e.message==='EXPERIMENT_COMMAND_WORKER_FAILED'&&e.treeExited===true);
 assert.deepEqual(await readdir(f.scratch),[]);
});

test('missing or inconsistent receipts fail closed without leaking filesystem errors',async t=>{
 for(const scenario of [host=>{start(host);close(host);},async(host,args)=>{
  start(host);await receipt(args);await writeFile(join(receiptDirectory(args),'stdout.bin'),'changed');close(host);
 }]){
  const f=await fixture(t,scenario);
  await assert.rejects(f.run(),e=>e.message==='EXPERIMENT_COMMAND_RECEIPT'&&e.treeExited===true);
  assert.deepEqual(await readdir(f.scratch),[]);
 }
});

test('non-Windows or invalid options reject without launching or staging',async t=>{
 const f=await fixture(t,()=>assert.fail('must not spawn'));
 await assert.rejects(f.run({python:'relative'}),/EXPERIMENT_COMMAND_ARGUMENTS/);
 await assert.rejects(executeExperimentCommand('unused',[],{},{platform:'linux',scratch:f.scratch}),/WINDOWS_REQUIRED/);
 assert.equal(f.launch,undefined);assert.deepEqual(await readdir(f.scratch),[]);
});
