// P2-CLI-BASELINE-04 T1: Lock concurrency and isolation tests.
// Uses production acquireInstanceLock with real subprocess contention.
// Children report 'ready' and wait for 'go' before attempting lock acquisition,
// ensuring true simultaneous contention rather than sequential startup.
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

// Spawn a child that reports 'ready', waits for 'go' on stdin, then attempts lock.
// After acquiring or failing, writes a JSON result line. On 'release' stdin,
// releases and writes 'released', then exits.
function spawnLockAcquirer(home,label){
 const code=`
  import {acquireInstanceLock} from ${JSON.stringify(LOCK_MODULE)};
  const home=${JSON.stringify(home)};
  const label=${JSON.stringify(label)};
  let lock=null,phase='waiting';
  process.stdout.write(JSON.stringify({label,result:'ready'})+'\\n');
  process.stdin.on('data',(data)=>{
   const msg=data.toString().trim();
   if(msg==='go'&&phase==='waiting'){
    phase='acquiring';
    acquireInstanceLock(home).then((l)=>{
     lock=l;phase='holding';
     process.stdout.write(JSON.stringify({label,result:'acquired'})+'\\n');
    }).catch((e)=>{
     process.stdout.write(JSON.stringify({label,result:'locked',error:e.message})+'\\n');
     process.exit(0);
    });
   }else if(msg==='release'&&phase==='holding'&&lock){
    phase='releasing';
    lock.release().then(()=>{
     process.stdout.write(JSON.stringify({label,result:'released'})+'\\n');
     process.exit(0);
    }).catch((e)=>{
     process.stdout.write(JSON.stringify({label,result:'release_error',error:e.message})+'\\n');
     process.exit(1);
    });
   }
  });
 `;
 return spawn(process.execPath,['--input-type=module','-e',code],{stdio:['pipe','pipe','pipe']});
}

// Message queue for robust stdout line reading. Handles chunked data,
// multiple lines, and child exit. Errors on timeout or unexpected exit.
class LineQueue{
 constructor(child,timeoutMs=15000){
  this.buf='';this.queue=[];this.resolveWait=null;this.rejectWait=null;this.exited=false;
  this.timeoutMs=timeoutMs;this.child=child;
  child.stdout.on('data',chunk=>{
   this.buf+=chunk.toString();
   let idx;
   while((idx=this.buf.indexOf('\n'))>=0){
    const line=this.buf.slice(0,idx);
    this.buf=this.buf.slice(idx+1);
    if(this.resolveWait){const r=this.resolveWait;this.resolveWait=null;this.rejectWait=null;r(line);}
    else this.queue.push(line);
   }
  });
  child.on('exit',(code,signal)=>{
   this.exited=true;
   if(this.rejectWait){const r=this.rejectWait;this.resolveWait=null;this.rejectWait=null;
    r(new Error(`Child exited code=${code} signal=${signal} before next line. Remaining buffer: ${this.buf.slice(0,200)}`));}
  });
  child.on('error',err=>{
   if(this.rejectWait){const r=this.rejectWait;this.resolveWait=null;this.rejectWait=null;r(err);}
  });
 }
 async nextLine(){
  if(this.queue.length>0)return this.queue.shift();
  if(this.exited)throw new Error('Child already exited, no more lines');
  return new Promise((resolve,reject)=>{
   this.resolveWait=resolve;this.rejectWait=reject;
   setTimeout(()=>{if(this.rejectWait){const r=this.rejectWait;this.resolveWait=null;this.rejectWait=null;
    r(new Error(`TIMEOUT after ${this.timeoutMs}ms waiting for line`));}},this.timeoutMs);
  });
 }
}

// Cleanup helper: send release, wait for exit with bounded timeout, kill if needed.
// Registered at spawn time so it runs even on assertion failure.
function trackChild(child,t){
 let exited=false;
 child.on('exit',()=>{exited=true;});
 child.stdin.on('error',()=>{});
 t.after(async()=>{
  if(!exited){
   try{child.stdin.end('release\n');}catch{}
   const result=await Promise.race([
    new Promise(r=>{child.on('exit',()=>r(true));}),
    new Promise(r=>setTimeout(()=>r(false),5000)),
   ]);
   if(!result){try{child.kill('SIGKILL');}catch{} await new Promise(r=>setTimeout(r,500));}
  }
 });
}

// Wait for child to report 'ready'
async function waitReady(lq,label){
 const line=await lq.nextLine();
 const msg=JSON.parse(line);
 assert.equal(msg.result,'ready',`Expected ready from ${label}, got: ${line}`);
 assert.equal(msg.label,label);
 return msg;
}

// Test 1: two subprocesses racing for the same home — exactly one acquires, one gets INSTANCE_LOCKED
test('two concurrent acquirers on same home: exactly one wins, one gets INSTANCE_LOCKED',async t=>{
 const root=await makeRoot(t);
 const home=join(root,'data');
 await mkdir(home);

 const childA=spawnLockAcquirer(home,'A');
 const childB=spawnLockAcquirer(home,'B');
 trackChild(childA,t);trackChild(childB,t);
 const lqA=new LineQueue(childA),lqB=new LineQueue(childB);

 // Wait for both to report ready
 await waitReady(lqA,'A');
 await waitReady(lqB,'B');

 // Send go to both simultaneously
 childA.stdin.write('go\n');
 childB.stdin.write('go\n');

 // Collect both results
 const results=[];
 results.push(JSON.parse(await lqA.nextLine()));
 results.push(JSON.parse(await lqB.nextLine()));

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
 trackChild(childA,t);
 const lqA=new LineQueue(childA);
 await waitReady(lqA,'A');
 childA.stdin.write('go\n');
 const resultA=JSON.parse(await lqA.nextLine());
 assert.equal(resultA.result,'acquired');

 const ownerPath=join(home,'.p2-manager-lock','owner.json');
 const ownerBefore=await readFile(ownerPath,'utf8');

 const childB=spawnLockAcquirer(home,'B');
 trackChild(childB,t);
 const lqB=new LineQueue(childB);
 await waitReady(lqB,'B');
 childB.stdin.write('go\n');
 const resultB=JSON.parse(await lqB.nextLine());
 assert.equal(resultB.result,'locked');

 const ownerAfter=await readFile(ownerPath,'utf8');
 assert.equal(ownerAfter,ownerBefore,'loser must not modify owner content');
});

// Test 3: after release, the same home can be re-acquired
test('after release, same home can be re-acquired',async t=>{
 const root=await makeRoot(t);
 const home=join(root,'data');
 await mkdir(home);

 const childA=spawnLockAcquirer(home,'A');
 trackChild(childA,t);
 const lqA=new LineQueue(childA);
 await waitReady(lqA,'A');
 childA.stdin.write('go\n');
 assert.equal(JSON.parse(await lqA.nextLine()).result,'acquired');

 // Release A
 childA.stdin.write('release\n');
 assert.equal(JSON.parse(await lqA.nextLine()).result,'released');

 // Lock dir should be gone
 await assert.rejects(()=>lstat(join(home,'.p2-manager-lock')),/ENOENT/);

 // Re-acquire with C
 const childC=spawnLockAcquirer(home,'C');
 trackChild(childC,t);
 const lqC=new LineQueue(childC);
 await waitReady(lqC,'C');
 childC.stdin.write('go\n');
 assert.equal(JSON.parse(await lqC.nextLine()).result,'acquired');
});

// Test 4: different homes can hold locks simultaneously, releasing one doesn't affect the other
test('different homes hold locks simultaneously, independent release',async t=>{
 const root=await makeRoot(t);
 const homeA=join(root,'homeA'),homeB=join(root,'homeB');
 await mkdir(homeA);await mkdir(homeB);

 const childA=spawnLockAcquirer(homeA,'A');
 const childB=spawnLockAcquirer(homeB,'B');
 trackChild(childA,t);trackChild(childB,t);
 const lqA=new LineQueue(childA),lqB=new LineQueue(childB);

 await waitReady(lqA,'A');await waitReady(lqB,'B');
 childA.stdin.write('go\n');childB.stdin.write('go\n');
 assert.equal(JSON.parse(await lqA.nextLine()).result,'acquired');
 assert.equal(JSON.parse(await lqB.nextLine()).result,'acquired');

 // Release A
 childA.stdin.write('release\n');
 assert.equal(JSON.parse(await lqA.nextLine()).result,'released');

 // A's lock should be gone
 await assert.rejects(()=>lstat(join(homeA,'.p2-manager-lock')),/ENOENT/);
 // B's lock should still exist
 const bStat=await lstat(join(homeB,'.p2-manager-lock'));
 assert.ok(bStat.isDirectory(),'B lock must survive A release');
});

// Test 5: owner content replaced → release rejects, replacement content preserved
// This test uses same-process verification (not subprocess) because it tests
// the lock's internal identity check, not concurrent behavior.
test('tampered owner blocks release, replacement content preserved',async t=>{
 const {acquireInstanceLock}=await import('../scripts/instance-lock.mjs');
 const root=await makeRoot(t);
 const home=join(root,'data');
 await mkdir(home);

 const lock=await acquireInstanceLock(home);
 const ownerPath=join(home,'.p2-manager-lock','owner.json');

 const tamperedContent='{"tampered":true}';
 await writeFile(ownerPath,tamperedContent,{mode:0o600});

 await assert.rejects(()=>lock.release(),/LOCK_OWNER_CHANGED/);

 const preserved=await readFile(ownerPath,'utf8');
 assert.equal(preserved,tamperedContent,'replacement content must be preserved');

 const lockStat=await lstat(join(home,'.p2-manager-lock'));
 assert.ok(lockStat.isDirectory(),'lock must survive tampered release attempt');
});
