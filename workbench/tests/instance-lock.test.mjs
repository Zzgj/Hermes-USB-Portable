import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile,readFile,lstat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {acquireInstanceLock} from '../scripts/instance-lock.mjs';
import {startManagedInstance} from '../scripts/managed-instance.mjs';
const sandbox=async(t)=>{const root=await mkdtemp(join(tmpdir(),'hermes-p2-lock-'));t.after(()=>rm(root,{recursive:true,force:true}));return root;};
test('simultaneous acquisitions have exactly one winner',async t=>{
 const root=await sandbox(t);
 const results=await Promise.allSettled(Array.from({length:8},()=>acquireInstanceLock(root)));
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 for(const result of results)if(result.status==='rejected')assert.equal(result.reason.message,'INSTANCE_LOCKED');
 const lock=results.find(r=>r.status==='fulfilled').value;
 const release=lock.release();assert.strictEqual(lock.release(),release);await release;
 await (await acquireInstanceLock(root)).release();
});
test('changed owner is not deleted or silently taken over',async t=>{
 const root=await sandbox(t),lock=await acquireInstanceLock(root),owner=join(root,'.p2-manager-lock','owner.json');
 await writeFile(owner,'unrecognized owner');
 await assert.rejects(lock.release(),/LOCK_OWNER_CHANGED/);
 assert.equal(await readFile(owner,'utf8'),'unrecognized owner');
 await assert.rejects(acquireInstanceLock(root),/INSTANCE_LOCKED/);
});
test('unexpected lock contents survive release attempt',async t=>{
 const root=await sandbox(t),lock=await acquireInstanceLock(root),extra=join(root,'.p2-manager-lock','do-not-delete');
 await writeFile(extra,'preserve');await assert.rejects(lock.release());
 assert.equal(await readFile(extra,'utf8'),'preserve');
 await assert.rejects(acquireInstanceLock(root),/INSTANCE_LOCKED/);
});
const service="process.stdout.write('HERMES_BACKEND_READY port=12345\\n');setInterval(()=>{},1000)";
const options=()=>({executable:process.execPath,args:['-e',service],cwd:process.cwd(),env:{},probe:async()=>true,startupMs:3000,stopMs:100});
test('manager holds lock until its child stops',async t=>{
 const root=await sandbox(t),manager=await startManagedInstance(root,options());
 try{
  await manager.ready;await assert.rejects(startManagedInstance(root,options()),/INSTANCE_LOCKED/);
  await manager.stop();await assert.rejects(lstat(join(root,'.p2-manager-lock')),{code:'ENOENT'});
  const next=await startManagedInstance(root,options());await next.ready;await next.stop();
 }finally{await manager.stop();}
});
test('invalid startup options release the acquired lock',async t=>{
 const root=await sandbox(t);
 await assert.rejects(startManagedInstance(root,{...options(),executable:'node'}));
 await (await acquireInstanceLock(root)).release();
});
test('independent process is excluded until the owner releases',async t=>{
 const root=await sandbox(t),lock=await acquireInstanceLock(root);
 const moduleUrl=new URL('../scripts/instance-lock.mjs',import.meta.url).href;
 const code=`import {acquireInstanceLock} from ${JSON.stringify(moduleUrl)};try{const lock=await acquireInstanceLock(${JSON.stringify(root)});await lock.release();console.log('acquired');}catch(error){console.log(error.message);process.exitCode=2;}`;
 const run=()=>promisify(execFile)(process.execPath,['--input-type=module','-e',code],{env:{},timeout:3000});
 await assert.rejects(run(),error=>error.code===2&&error.stdout.trim()==='INSTANCE_LOCKED');
 await lock.release();assert.equal((await run()).stdout.trim(),'acquired');
});
