// P2-S1-LOCK-01: Lock conflict recovery and stale lock safety tests.
// Verifies that existing locks are never auto-reclaimed based on PID liveness,
// lock content is preserved on conflict, owner tampering blocks release, and
// the control server surfaces INSTANCE_LOCKED as OPERATION_FAILED via HTTP.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,stat,lstat} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {startControlServer} from '../scripts/control-server.mjs';

// --- Unit tests: acquireInstanceLock production function ---

async function makeRoot(t){
 const root=await mkdtemp(join(tmpdir(),'p2-lock-'));
 t.after(()=>rm(root,{recursive:true,force:true}));
 return root;
}

// Test 1: existing lock causes INSTANCE_LOCKED, lock content preserved
test('existing lock returns INSTANCE_LOCKED and preserves lock content',async t=>{
 const {acquireInstanceLock}=await import('../scripts/instance-lock.mjs');
 const root=await makeRoot(t);
 // Pre-create a synthetic lock directory with an owner.json
 const lockDir=join(root,'.p2-manager-lock');
 await mkdir(lockDir,{mode:0o700});
 const ownerContent=JSON.stringify({schema:1,nonce:'synthetic-nonce',pid:99999,created:'2020-01-01T00:00:00.000Z'});
 await writeFile(join(lockDir,'owner.json'),ownerContent,{mode:0o600});
 // Attempt to acquire must fail with INSTANCE_LOCKED
 await assert.rejects(()=>acquireInstanceLock(root),/^Error: INSTANCE_LOCKED$/);
 // Lock directory and owner.json must be unchanged
 const preserved=await readFile(join(lockDir,'owner.json'),'utf8');
 assert.equal(preserved,ownerContent,'lock owner.json must be preserved');
 const lockStat=await lstat(lockDir);
 assert.ok(lockStat.isDirectory(),'lock directory must still exist');
});

// Test 2: stale PID (nonexistent process) does not cause auto-reclaim
test('stale PID does not trigger auto-reclaim of lock',async t=>{
 const {acquireInstanceLock}=await import('../scripts/instance-lock.mjs');
 const root=await makeRoot(t);
 const lockDir=join(root,'.p2-manager-lock');
 await mkdir(lockDir,{mode:0o700});
 // Synthetic PID only: the test neither checks nor assumes host PID liveness.
 const staleOwner=JSON.stringify({schema:1,nonce:'stale-nonce',pid:999999,created:'2020-01-01T00:00:00.000Z'});
 await writeFile(join(lockDir,'owner.json'),staleOwner,{mode:0o600});
 // Must still reject — stale PID is not a reason to reclaim
 await assert.rejects(()=>acquireInstanceLock(root),/^Error: INSTANCE_LOCKED$/);
 const preserved=await readFile(join(lockDir,'owner.json'),'utf8');
 assert.equal(preserved,staleOwner,'stale lock must be preserved');
});

// Test 3: normal acquire-release cycle allows re-acquire
test('normal acquire and release allows re-acquisition',async t=>{
 const {acquireInstanceLock}=await import('../scripts/instance-lock.mjs');
 const root=await makeRoot(t);
 const lock1=await acquireInstanceLock(root);
 await lock1.release();
 // Lock directory should be gone
 await assert.rejects(()=>lstat(join(root,'.p2-manager-lock')),/ENOENT/);
 // Can acquire again
 const lock2=await acquireInstanceLock(root);
 await lock2.release();
 await assert.rejects(()=>lstat(join(root,'.p2-manager-lock')),/ENOENT/);
});

// Test 4: tampered owner blocks release, lock not deleted
test('owner content replacement blocks release and preserves lock',async t=>{
 const {acquireInstanceLock}=await import('../scripts/instance-lock.mjs');
 const root=await makeRoot(t);
 const lock=await acquireInstanceLock(root);
 // Tamper with owner.json content
 await writeFile(join(root,'.p2-manager-lock','owner.json'),'tampered',{mode:0o600});
 // Release must reject
 await assert.rejects(()=>lock.release(),/LOCK_OWNER_CHANGED/);
 // Lock directory must still exist (not deleted)
 const lockStat=await lstat(join(root,'.p2-manager-lock'));
 assert.ok(lockStat.isDirectory(),'lock must survive tampered release attempt');
});

// Test 5: real HTTP — status=idle but start fails with lock conflict
test('control server: status idle but start fails when lock exists',async t=>{
 const {acquireInstanceLock}=await import('../scripts/instance-lock.mjs');
 const assets=await mkdtemp(join(tmpdir(),'p2-lock-http-'));
 await writeFile(join(assets,'index.html'),'fixture');
 t.after(async()=>{
  // Only remove this test's owned directory; never a lock under the shared temp root.
  await rm(assets,{recursive:true,force:true});
 });
 // Create a home dir with a pre-existing lock
 const home=await mkdtemp(join(tmpdir(),'p2-lock-home-'));
 t.after(()=>rm(home,{recursive:true,force:true}));
 const lockDir=join(home,'.p2-manager-lock');
 await mkdir(lockDir,{mode:0o700});
 const ownerContent=JSON.stringify({schema:1,nonce:'http-test',pid:99999,created:'2020-01-01T00:00:00.000Z'});
 await writeFile(join(lockDir,'owner.json'),ownerContent,{mode:0o600});
 let startCalls=0;
 const control=await startControlServer({
  assets,
  startInstance:async()=>{
   startCalls++;
   // This mimics what startHermesInstance does internally — it calls
   // startManagedInstance which calls acquireInstanceLock on home.
   // If the lock exists, acquireInstanceLock throws INSTANCE_LOCKED.
   const unexpected=await acquireInstanceLock(home);
   await unexpected.release();
   throw new Error('EXPECTED_LOCK_CONFLICT');
  },
 });
 t.after(()=>control.close());
 // Step 1: status should be idle (instance===null, not busy)
 const statusResp=await fetch(control.origin+'/api/status',{headers:{Authorization:'Bearer '+control.token,Origin:control.origin}});
 assert.equal(statusResp.status,200);
 const statusBody=await statusResp.json();
 assert.equal(statusBody.state,'idle','status must be idle when no instance handle exists');
 // Step 2: start must fail with 500 OPERATION_FAILED (lock conflict surfaces as generic failure)
 const startResp=await fetch(control.origin+'/api/start',{method:'POST',headers:{Authorization:'Bearer '+control.token,Origin:control.origin}});
 assert.equal(startResp.status,500);
 const startBody=await startResp.json();
 assert.equal(startBody.error,'OPERATION_FAILED');
 assert.equal(startBody.reason,'INSTANCE_LOCKED');
 assert.equal(startCalls,1,'startInstance must be called exactly once');
 // Step 3: status still idle after failed start (instance handle not retained)
 const statusAfter=await fetch(control.origin+'/api/status',{headers:{Authorization:'Bearer '+control.token,Origin:control.origin}});
 const statusAfterBody=await statusAfter.json();
 assert.equal(statusAfterBody.state,'idle','status must remain idle after failed start');
 // Step 4: the lock must still exist (not cleaned up by the failed start)
 const lockStat=await lstat(lockDir);
 assert.ok(lockStat.isDirectory(),'lock must survive failed start attempt');
 assert.equal(await readFile(join(lockDir,'owner.json'),'utf8'),ownerContent);
});
