import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm,lstat} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createNativeEntryManager} from '../scripts/native-entry-manager.mjs';
import {acquireInstanceLock} from '../scripts/instance-lock.mjs';

async function fixture(t){
 const root=await mkdtemp(join(tmpdir(),'native-manager-'));
 t.after(()=>rm(root,{recursive:true,force:true}));
 const home=join(root,'data');await mkdir(home);
 return {root,home};
}
test('native entry shares the existing instance lock',async t=>{
 const {home}=await fixture(t);let starts=0,finish;
 const closed=new Promise(resolve=>{finish=resolve;});
 const adapter={prepare:async()=>({start:async()=>{starts++;return {closed,stop:async()=>{}};}})};
 const manager=await createNativeEntryManager({home,adapters:{cli:adapter}});
 const occupied=await acquireInstanceLock(home);
 try{await assert.rejects(manager.start('cli'),/INSTANCE_LOCKED/);assert.equal(starts,0);}
 finally{await occupied.release();}
 await manager.start('cli');
 try{await assert.rejects(acquireInstanceLock(home),/INSTANCE_LOCKED/);}
 finally{finish({treeExited:true});await manager.closed;}
 const next=await acquireInstanceLock(home);await next.release();
});
test('unavailable adapter releases only its newly acquired lock',async t=>{
 const {home}=await fixture(t);
 const manager=await createNativeEntryManager({home,adapters:{}});
 await assert.rejects(manager.start('dashboard'),/ENTRY_ADAPTER_UNAVAILABLE/);
 await assert.rejects(lstat(join(home,'.p2-manager-lock')),error=>error.code==='ENOENT');
});
test('recovery marker prevents preparation and launch',async t=>{
 const {root,home}=await fixture(t);let prepared=false;
 await mkdir(join(root,'logs','diagnostics'),{recursive:true});
 await writeFile(join(root,'logs','diagnostics','p2-install-active.json'),'{}');
 const manager=await createNativeEntryManager({home,adapters:{cli:{prepare:()=>{prepared=true;}}}});
 await assert.rejects(manager.start('cli'),/INTERRUPTED_INSTALL/);
 assert.equal(prepared,false);
});
