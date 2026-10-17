import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {assertPortableEntryGuard} from '../scripts/portable-entry-guard.mjs';
import {createPortableNativeEntries} from '../scripts/portable-native-entries.mjs';
import {acquireInstanceLock} from '../scripts/instance-lock.mjs';

const repository=fileURLToPath(new URL('../../',import.meta.url));
async function fixture(t){
 const root=await mkdtemp(join(tmpdir(),'portable-native-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const home=join(root,'data');await mkdir(home);
 for(const path of ['launch.bat','scripts/open-hermes.ps1','scripts/start-web-workbench.ps1','workbench/scripts/legacy-hermes-entry.mjs']){
  await mkdir(dirname(join(root,path)),{recursive:true});await writeFile(join(root,path),await readFile(join(repository,path)));
 }
 return {root,home};
}
test('matching coordinated launcher set accepts either checkout line ending',async t=>{
 const {root,home}=await fixture(t);await assertPortableEntryGuard(root,home);
 const path=join(root,'launch.bat');await writeFile(path,(await readFile(path,'utf8')).replace(/\r\n/g,'\n'));
 await assertPortableEntryGuard(root,home);
});
test('old launcher, restore marker and gateway receipt reject without auto-clearing',async t=>{
 const {root,home}=await fixture(t);const launcher=join(root,'launch.bat'),bytes=await readFile(launcher);
 await writeFile(launcher,'old uncoordinated launcher');await assert.rejects(assertPortableEntryGuard(root,home),/ENTRY_COORDINATION/);
 await writeFile(launcher,bytes);
 await writeFile(join(home,'gateway.pid'),'fixture');await assert.rejects(assertPortableEntryGuard(root,home),/EXTERNAL_ENTRY/);
 assert.equal(await readFile(join(home,'gateway.pid'),'utf8'),'fixture');await rm(join(home,'gateway.pid'));
 await mkdir(join(root,'updates'));await writeFile(join(root,'updates','hermes-restore-active.json'),'{}');
 await assert.rejects(assertPortableEntryGuard(root,home),/RECOVERY/);
});
test('production composition checks coordination under the same lock before adapter preparation',async t=>{
 const {root,home}=await fixture(t);let prepares=0,starts=0,finish;
 const makeAdapters=()=>({cli:{prepare:async()=>{
  prepares++;await assert.rejects(acquireInstanceLock(home),/INSTANCE_LOCKED/);
  return {start:()=>{
   starts++;
   return {ready:Promise.resolve(),closed:new Promise(resolve=>{finish=resolve;}),
    stop:async()=>{finish({treeExited:true});return {treeExited:true};}};
  }};
 }}});
 const manager=await createPortableNativeEntries({root,home},{makeAdapters});
 await writeFile(join(root,'launch.bat'),'unknown');await assert.rejects(manager.start('cli'),/ENTRY_COORDINATION/);
 assert.equal(prepares,0);assert.equal(starts,0);
 await writeFile(join(root,'launch.bat'),await readFile(join(repository,'launch.bat')));
 await manager.start('cli');assert.equal(prepares,1);assert.equal(starts,1);
 await manager.stop();assert.equal(manager.status().state,'idle');
 const next=await acquireInstanceLock(home);await next.release();
});
