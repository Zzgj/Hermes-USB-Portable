import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {startManagedInstance} from '../scripts/managed-instance.mjs';
import {acquireInstanceLock} from '../scripts/instance-lock.mjs';

test('managed native exit proof must resolve before shared lock is released',async t=>{
 const home=await mkdtemp(join(tmpdir(),'managed-proof-'));t.after(()=>rm(home,{recursive:true,force:true}));
 let finish;
 const exited=new Promise(resolve=>{finish=resolve;});
 const instance=await startManagedInstance(home,{}, {startProcess:()=>({ready:Promise.resolve(),exited,stop:async()=>{finish({treeExited:true});},state:'ready'})});
 await assert.rejects(acquireInstanceLock(home),/INSTANCE_LOCKED/);
 await instance.stop();
 const next=await acquireInstanceLock(home);await next.release();
});
test('rejected native exit evidence retains the shared lock',async t=>{
 const home=await mkdtemp(join(tmpdir(),'managed-unknown-'));t.after(()=>rm(home,{recursive:true,force:true}));
 const instance=await startManagedInstance(home,{}, {startProcess:()=>({ready:Promise.resolve(),exited:Promise.reject(new Error('PROCESS_TREE_EXIT_UNCONFIRMED')),stop:async()=>{},state:'unknown'})});
 await assert.rejects(instance.closed,/TREE_EXIT_UNCONFIRMED/);
 await assert.rejects(acquireInstanceLock(home),/INSTANCE_LOCKED/);
});
