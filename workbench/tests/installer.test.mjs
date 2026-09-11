import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,readdir} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {packageFiles,stageP2Package} from '../scripts/build-p2-package.mjs';
import {installP2Package,recoverP2Install} from '../scripts/install-p2-package.mjs';
import {acquireInstanceLock} from '../scripts/instance-lock.mjs';
import fs from 'node:fs/promises';
async function fixture(t){
 const root=await mkdtemp(join(tmpdir(),'hermes-p2-install-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const repo=join(root,'repo'),target=join(root,'target'),pkg=join(root,'package');
 await mkdir(repo);await mkdir(join(target,'data'),{recursive:true});await writeFile(join(target,'launch.bat'),'original launcher');await writeFile(join(target,'data','.env'),'private sentinel');
 for(const file of [...packageFiles,'workbench/dist/index.html']){await mkdir(dirname(join(repo,file)),{recursive:true});await writeFile(join(repo,file),'new '+file);}
 await stageP2Package(repo,pkg);return {root,repo,target,pkg};
}
test('verify is read-only; apply backs up shell and preserves private data',async t=>{
 const {target,pkg}=await fixture(t);
 const old=join(target,'scripts','start-p2-workbench.ps1');await mkdir(dirname(old));await writeFile(old,'old shell');
 const before=await readdir(target);assert.equal((await installP2Package(pkg,target)).status,'verified');assert.deepEqual(await readdir(target),before);
 const result=await installP2Package(pkg,target,{apply:true});assert.equal(result.status,'installed-development-snapshot');
 assert.equal(await readFile(join(result.backup,'scripts','start-p2-workbench.ps1'),'utf8'),'old shell');
 assert.equal(await readFile(join(target,'data','.env'),'utf8'),'private sentinel');assert.equal(await readFile(join(target,'launch.bat'),'utf8'),'original launcher');
});
test('tampered payload fails before any writes',async t=>{
 const {pkg,target}=await fixture(t);await writeFile(join(pkg,'workbench/dist/index.html'),'tampered');
 await assert.rejects(installP2Package(pkg,target,{apply:true}),/PACKAGE_HASH_MISMATCH/);
 assert.deepEqual((await readdir(target)).sort(),['data','launch.bat']);
});
test('manifest cannot install private-data paths or traversal',async t=>{
 const {pkg,target}=await fixture(t),path=join(pkg,'p2-package.json'),manifest=JSON.parse(await readFile(path));
 manifest.files[0].path='data/.env';await writeFile(path,JSON.stringify(manifest));
 await assert.rejects(installP2Package(pkg,target,{apply:true}),/INVALID_PACKAGE_ENTRY/);
 assert.equal(await readFile(join(target,'data','.env'),'utf8'),'private sentinel');
});
test('active instance lock blocks installation without changing payload',async t=>{
 const {pkg,target}=await fixture(t),lock=await acquireInstanceLock(join(target,'data'));
 try{await assert.rejects(installP2Package(pkg,target,{apply:true}),/INSTANCE_LOCKED/);assert.equal((await readdir(target)).includes('workbench'),false);}finally{await lock.release();}
});
test('mid-install rename failure restores earlier shell and removes active marker',async t=>{
 const {pkg,target}=await fixture(t),manifest=JSON.parse(await readFile(join(pkg,'p2-package.json')));
 const first=manifest.files[0].path,second=manifest.files[1].path;
 await mkdir(dirname(join(target,first)),{recursive:true});await writeFile(join(target,first),'old first');
 const original=fs.rename;
 t.mock.method(fs,'rename',async(from,to)=>{if(to===join(target,second))throw new Error('injected write failure');return original(from,to);});
 await assert.rejects(installP2Package(pkg,target,{apply:true}),/INSTALL_FAILED_ROLLED_BACK/);
 assert.equal(await readFile(join(target,first),'utf8'),'old first');
 await assert.rejects(fs.lstat(join(target,'logs/diagnostics/p2-install-active.json')),{code:'ENOENT'});
 await (await acquireInstanceLock(join(target,'data'))).release();
});
test('rollback failure retains marker and backup and blocks another install',async t=>{
 const {pkg,target}=await fixture(t),manifest=JSON.parse(await readFile(join(pkg,'p2-package.json')));
 const first=manifest.files[0].path;await mkdir(dirname(join(target,first)),{recursive:true});await writeFile(join(target,first),'old first');
 let count=0;const original=fs.rename;
 t.mock.method(fs,'rename',async(from,to)=>{if(++count>1)throw new Error('injected persistent failure');return original(from,to);});
 await assert.rejects(installP2Package(pkg,target,{apply:true}),/INSTALL_FAILED_REVIEW_BACKUP/);
 const marker=JSON.parse(await readFile(join(target,'logs/diagnostics/p2-install-active.json')));
 assert.equal(await readFile(join(target,marker.backup,first),'utf8'),'old first');
 await assert.rejects(installP2Package(pkg,target,{apply:true}),/INTERRUPTED_INSTALL_REQUIRES_RECOVERY/);
 assert.equal(await readFile(join(target,'data/.env'),'utf8'),'private sentinel');
 t.mock.restoreAll();
 const installed=await readFile(join(target,first));
 await writeFile(join(target,first),'later user edit');
 await assert.rejects(recoverP2Install(target,{apply:true}),/RECOVERY_TARGET_CHANGED/);
 assert.equal(await readFile(join(target,first),'utf8'),'later user edit');
 await writeFile(join(target,first),installed);
 const saved=join(target,marker.backup,first);
 await writeFile(saved,'damaged backup');
 await assert.rejects(recoverP2Install(target,{apply:true}),/BACKUP_VERIFY_FAILED/);
 await writeFile(saved,'old first');
 const lock=await acquireInstanceLock(join(target,'data'));
 try{await assert.rejects(recoverP2Install(target,{apply:true}),/INSTANCE_LOCKED/);}finally{await lock.release();}
 assert.equal((await recoverP2Install(target)).status,'recovery-verified');
 assert.equal((await recoverP2Install(target,{apply:true})).status,'recovered');
 assert.equal(await readFile(join(target,first),'utf8'),'old first');
 await assert.rejects(fs.lstat(join(target,'logs/diagnostics/p2-install-active.json')),{code:'ENOENT'});
});
