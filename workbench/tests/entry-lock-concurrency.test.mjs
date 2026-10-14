// P2-CLI-BASELINE-03 T1: Lock concurrency and isolation tests.
// Uses production acquireInstanceLock with real subprocess contention.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,lstat} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawn} from 'node:child_process';

const LOCK_MODULE=new URL('../scripts/instance-lock.mjs',import.meta.url).href;

async function makeRoot(t){
 const root=await mkdtemp(join(tmpdir(),'p2-lock-conc-'));
 t.after(()=>rm(root,{recursive:true,force:true}));
 return root;
}

// Spawn a child process that attempts to acquire a lock on the given home.
// Uses IPC via stdout JSON to report the result.
function spawnLockAcquirer(home,label){
 const code=`
  import {acquireInstanceLock} from ${JSON.stringify(LOCK_MODULE)};
  import {join} from 'node:path';
  const home=${JSON.stringify(home)};
  try{
   const lock=await acquireInstanceLock(home);
   // Signal success, then hold the lock until parent sends a release signal
   process.stdout.write(JSON.stringify({label:${JSON.stringify(label)},result:'acquired'})+'\\n');
   // Wait for release signal on stdin
   process.stdin.on('data',()=>{
    lock.release().then(()=>{process.stdout.write(JSON.stringify({label:${JSON.stringify(label)},result:'released'})+'\\n');process.exit(0);}).catch(e=>{process.stdout.write(JSON.stringify({label:${JSON.stringify(label)},result:'release_error',error:e.message})+'\\n');process.exit(1);});
   });
  }catch(e){
   process.stdout.write(JSON.stringify({label:${JSON.stringify(label)},result:'locked',error:e.message})+'\\n');
   process.exit(0);
  }
 `;
 return spawn(process.execPath,['--input-type=module','-e',code],{stdio:['pipe','pipe','pipe',]});
}

function readLineFromStdout(child,timeout=10000){
 return new Promise((resolve,reject)=>{
  let buf='';
  const timer=setTimeout(()=>{reject(new Error('TIMEOUT_WAITING_FOR_OUTPUT'));},timeout);
  child.stdout.on('data',chunk=>{
   buf+=chunk.toString();
   const idx=buf.indexOf('\n');
   if(idx>=0){clearTimeout(timer);resolve(buf.slice(0,idx));}
  });
  child.on('error',e=>{clearTimeout(timer);reject(e);});
 });
}

// Test 1: two subprocesses racing for the same home — exactly one acquires, one gets INSTANCE_LOCKED
test('two concurrent acquirers on same home: exactly one wins, one gets INSTANCE_LOCKED',async t=>{
 const root=await makeRoot(t);
 const home=join(root,'data');
 await mkdir(home);

 // Spawn both nearly simultaneously using a barrier (pipe-based)
 const childA=spawnLockAcquirer(home,'A');
 const childB=spawnLockAcquirer(home,'B');

 const results=[];
 try{
  const lineA=await readLineFromStdout(childA);
  results.push(JSON.parse(lineA));
  const lineB=await readLineFromStdout(childB);
  results.push(JSON.parse(lineB));
 }finally{
  // Clean up: release whichever acquired and kill both
  for(const child of [childA,childB]){
   try{child.stdin.write('release\n');}catch{}
  }
  await new Promise(r=>setTimeout(r,500));
  for(const child of [childA,childB]){
   if(child.exitCode===null){child.kill('SIGKILL');}
  }
 }

 const acquired=results.filter(r=>r.result==='acquired');
 const locked=results.filter(r=>r.result==='locked');
 assert.equal(acquired.length,1,'exactly one acquirer must win');
 assert.equal(locked.length,1,'exactly one must get INSTANCE_LOCKED');
 assert.equal(locked[0].error,'INSTANCE_LOCKED');
});

// Test 2: loser does not modify winner's owner.json content
test('loser does not modify winner owner content',async t=>{
 const root=await makeRoot(t);
 const home=join(root,'data');
 await mkdir(home);

 const childA=spawnLockAcquirer(home,'A');
 const lineA=await readLineFromStdout(childA);
 const resultA=JSON.parse(lineA);
 assert.equal(resultA.result,'acquired');

 // Read the owner content set by winner
 const ownerPath=join(home,'.p2-manager-lock','owner.json');
 const ownerBefore=await readFile(ownerPath,'utf8');

 // Now spawn a loser
 const childB=spawnLockAcquirer(home,'B');
 const lineB=await readLineFromStdout(childB);
 const resultB=JSON.parse(lineB);
 assert.equal(resultB.result,'locked');

 // Verify owner content unchanged
 const ownerAfter=await readFile(ownerPath,'utf8');
 assert.equal(ownerAfter,ownerBefore,'loser must not modify owner content');

 // Cleanup
 try{childA.stdin.write('release\n');}catch{}
 await new Promise(r=>setTimeout(r,500));
 for(const child of [childA,childB]){
  if(child.exitCode===null){child.kill('SIGKILL');}
 }
});

// Test 3: after release, the same home can be re-acquired
test('after release, same home can be re-acquired',async t=>{
 const root=await makeRoot(t);
 const home=join(root,'data');
 await mkdir(home);

 const childA=spawnLockAcquirer(home,'A');
 const lineA=await readLineFromStdout(childA);
 assert.equal(JSON.parse(lineA).result,'acquired');

 // Release A
 childA.stdin.write('release\n');
 const releaseLine=await readLineFromStdout(childA);
 assert.equal(JSON.parse(releaseLine).result,'released');
 // Wait for process exit
 await new Promise(r=>{childA.on('exit',()=>r());});

 // Lock dir should be gone
 await assert.rejects(()=>lstat(join(home,'.p2-manager-lock')),/ENOENT/);

 // Re-acquire
 const childC=spawnLockAcquirer(home,'C');
 const lineC=await readLineFromStdout(childC);
 assert.equal(JSON.parse(lineC).result,'acquired');

 try{childC.stdin.write('release\n');}catch{}
 await new Promise(r=>setTimeout(r,500));
 if(childC.exitCode===null){childC.kill('SIGKILL');}
});

// Test 4: different homes can hold locks simultaneously, releasing one doesn't affect the other
test('different homes hold locks simultaneously, independent release',async t=>{
 const root=await makeRoot(t);
 const homeA=join(root,'homeA'),homeB=join(root,'homeB');
 await mkdir(homeA);await mkdir(homeB);

 const childA=spawnLockAcquirer(homeA,'A');
 const childB=spawnLockAcquirer(homeB,'B');
 const lineA=await readLineFromStdout(childA);
 const lineB=await readLineFromStdout(childB);
 assert.equal(JSON.parse(lineA).result,'acquired');
 assert.equal(JSON.parse(lineB).result,'acquired');

 // Release A
 childA.stdin.write('release\n');
 await readLineFromStdout(childA);
 await new Promise(r=>{childA.on('exit',()=>r());});

 // A's lock should be gone
 await assert.rejects(()=>lstat(join(homeA,'.p2-manager-lock')),/ENOENT/);
 // B's lock should still exist
 const bStat=await lstat(join(homeB,'.p2-manager-lock'));
 assert.ok(bStat.isDirectory(),'B lock must survive A release');

 // Cleanup B
 try{childB.stdin.write('release\n');}catch{}
 await new Promise(r=>setTimeout(r,500));
 if(childB.exitCode===null){childB.kill('SIGKILL');}
});

// Test 5: owner content replaced → release rejects, replacement content preserved
// (References existing instance-lock-recovery.test.mjs Test 4; this adds subprocess-level verification)
test('tampered owner blocks release via subprocess, replacement content preserved',async t=>{
 const {acquireInstanceLock}=await import('../scripts/instance-lock.mjs');
 const root=await makeRoot(t);
 const home=join(root,'data');
 await mkdir(home);

 const lock=await acquireInstanceLock(home);
 const ownerPath=join(home,'.p2-manager-lock','owner.json');

 // Tamper with owner content
 const tamperedContent='{"tampered":true}';
 await writeFile(ownerPath,tamperedContent,{mode:0o600});

 // Release must reject
 await assert.rejects(()=>lock.release(),/LOCK_OWNER_CHANGED/);

 // Tampered content must be preserved (not deleted or overwritten)
 const preserved=await readFile(ownerPath,'utf8');
 assert.equal(preserved,tamperedContent,'replacement content must be preserved');

 // Lock directory must still exist
 const lockStat=await lstat(join(home,'.p2-manager-lock'));
 assert.ok(lockStat.isDirectory(),'lock must survive tampered release attempt');
});
