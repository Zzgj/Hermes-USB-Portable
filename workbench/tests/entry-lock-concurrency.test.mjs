// P2-CLI-BASELINE-05 T1: Lock concurrency and isolation tests.
// Uses production acquireInstanceLock with real subprocess contention.
// Children report 'ready' and wait for 'go' before attempting lock acquisition.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,lstat} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawn} from 'node:child_process';

const LOCK_MODULE=new URL('../scripts/instance-lock.mjs',import.meta.url).href;

async function makeRoot(t){
 const root=await mkdtemp(join(tmpdir(),'p2-lock-conc-'));
 return root;
}

function registerRootCleanup(t,cleanup){
 t.after(async()=>{const ok=await cleanup.cleanupRoot();if(!ok)throw new Error('Root cleanup failed: not all children confirmed exited');});
}

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

// Message queue with per-wait timer isolation. Each nextLine() call creates
// its own timer and completion flag; the timer is cleared on success, timeout,
// or child exit. Old timers cannot reject new waits via shared state.
class LineQueue{
 constructor(child,timeoutMs=15000){
  this.buf='';this.queue=[];this.exited=false;this.exitInfo=null;
  this.timeoutMs=timeoutMs;this.child=child;
  this.pending=null; // {resolve, reject, timer, done}
  child.stdout.on('data',chunk=>{
   this.buf+=chunk.toString();
   let idx;
   while((idx=this.buf.indexOf('\n'))>=0){
    const line=this.buf.slice(0,idx);
    this.buf=this.buf.slice(idx+1);
    if(this.pending&&!this.pending.done){
     this.pending.done=true;clearTimeout(this.pending.timer);
     const r=this.pending.resolve;this.pending=null;r(line);
    }else{
     this.queue.push(line);
    }
   }
  });
  child.stdout.on('end',()=>{
   // Process any remaining buffered data as a final line if non-empty
   if(this.buf.length>0){
    const line=this.buf;
    this.buf='';
    if(this.pending&&!this.pending.done){
     this.pending.done=true;clearTimeout(this.pending.timer);
     const r=this.pending.resolve;this.pending=null;r(line);
    }else{
     this.queue.push(line);
    }
   }
  });
  child.on('exit',(code,signal)=>{
   this.exited=true;this.exitInfo={code,signal};
   if(this.pending&&!this.pending.done){
    this.pending.done=true;clearTimeout(this.pending.timer);
    const r=this.pending.reject;this.pending=null;
    r(new Error(`Child exited code=${code} signal=${signal} before next line. Remaining: ${this.buf.slice(0,200)}`));
   }
  });
  child.on('error',err=>{
   if(this.pending&&!this.pending.done){
    this.pending.done=true;clearTimeout(this.pending.timer);
    const r=this.pending.reject;this.pending=null;r(err);
   }
  });
 }
 async nextLine(){
  if(this.queue.length>0)return this.queue.shift();
  if(this.exited)throw new Error(`Child already exited (code=${this.exitInfo?.code}), no more lines`);
  if(this.pending)throw new Error('Concurrent nextLine() not supported — only one pending wait at a time');
  return new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>{
    if(!this.pending||this.pending.done)return;
    this.pending.done=true;
    this.pending=null;
    reject(new Error(`TIMEOUT after ${this.timeoutMs}ms waiting for line`));
   },this.timeoutMs);
   this.pending={resolve,reject,timer,done:false};
  });
 }
}

// Track child for cleanup. Creates exit promise at spawn time.
// Sends release, bounded wait, SIGKILL if needed, then CONFIRMS exit.
// Root deletion happens only after all tracked children confirm exited.
function trackChild(child,t,cleanupTracker){
 const exitPromise=new Promise(resolve=>{child.on('exit',()=>resolve());});
 child.stdin.on('error',()=>{});
 cleanupTracker.addChild(child);
 child.on('exit',()=>{cleanupTracker.childExited(child);});
 t.after(async()=>{
  if(child.exitCode===null&&child.signalCode===null){
   try{child.stdin.end('release\n');}catch{}
   let exited=await Promise.race([
    exitPromise.then(()=>true),
    new Promise(r=>setTimeout(()=>r(false),5000)),
   ]);
   if(!exited){
    try{child.kill('SIGKILL');}catch{}
    exited=await Promise.race([
     exitPromise.then(()=>true),
     new Promise(r=>setTimeout(()=>r(false),3000)),
    ]);
    if(!exited){
     throw new Error(`Cleanup failure: child PID ${child.pid} did not exit after SIGKILL`);
    }
   }
  }
 });
}

// CleanupTracker ensures root dir is only deleted after all children confirmed exited.
class CleanupTracker{
 constructor(){this.root=null;this.exitedCount=0;this.totalCount=0;this.childSet=new Set();}
 setRoot(root){this.root=root;}
 addChild(child){this.totalCount++;this.childSet.add(child);}
 childExited(child){
  if(this.childSet.has(child)){this.exitedCount++;this.childSet.delete(child);}
 }
 async cleanupRoot(){
  if(!this.root)return true;
  if(this.exitedCount<this.totalCount){
   return false;
  }
  try{await rm(this.root,{recursive:true,force:true});return true;}catch{return false;}
 }
}

async function waitReady(lq,label){
 const line=await lq.nextLine();
 const msg=JSON.parse(line);
 assert.equal(msg.result,'ready',`Expected ready from ${label}, got: ${line}`);
 assert.equal(msg.label,label);
 return msg;
}

// Test 1: two subprocesses racing for the same home
test('two concurrent acquirers on same home: exactly one wins, one gets INSTANCE_LOCKED',async t=>{
 const cleanup=new CleanupTracker();
 const root=await makeRoot(t);
 cleanup.setRoot(root);
 const home=join(root,'data');
 await mkdir(home);

 const childA=spawnLockAcquirer(home,'A');
 const childB=spawnLockAcquirer(home,'B');
 trackChild(childA,t,cleanup);trackChild(childB,t,cleanup);
 registerRootCleanup(t,cleanup);
 const lqA=new LineQueue(childA),lqB=new LineQueue(childB);

 await waitReady(lqA,'A');
 await waitReady(lqB,'B');
 childA.stdin.write('go\n');
 childB.stdin.write('go\n');

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
 const cleanup=new CleanupTracker();
 const root=await makeRoot(t);
 cleanup.setRoot(root);
 const home=join(root,'data');
 await mkdir(home);

 const childA=spawnLockAcquirer(home,'A');
 trackChild(childA,t,cleanup);
 const lqA=new LineQueue(childA);
 await waitReady(lqA,'A');
 childA.stdin.write('go\n');
 const resultA=JSON.parse(await lqA.nextLine());
 assert.equal(resultA.result,'acquired');

 const ownerPath=join(home,'.p2-manager-lock','owner.json');
 const ownerBefore=await readFile(ownerPath,'utf8');

 const childB=spawnLockAcquirer(home,'B');
 trackChild(childB,t,cleanup);
 registerRootCleanup(t,cleanup);
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
 const cleanup=new CleanupTracker();
 const root=await makeRoot(t);
 cleanup.setRoot(root);
 const home=join(root,'data');
 await mkdir(home);

 const childA=spawnLockAcquirer(home,'A');
 trackChild(childA,t,cleanup);
 const lqA=new LineQueue(childA);
 await waitReady(lqA,'A');
 childA.stdin.write('go\n');
 assert.equal(JSON.parse(await lqA.nextLine()).result,'acquired');

 childA.stdin.write('release\n');
 assert.equal(JSON.parse(await lqA.nextLine()).result,'released');

 await assert.rejects(()=>lstat(join(home,'.p2-manager-lock')),/ENOENT/);

 const childC=spawnLockAcquirer(home,'C');
 trackChild(childC,t,cleanup);
 registerRootCleanup(t,cleanup);
 const lqC=new LineQueue(childC);
 await waitReady(lqC,'C');
 childC.stdin.write('go\n');
 assert.equal(JSON.parse(await lqC.nextLine()).result,'acquired');
});

// Test 4: different homes can hold locks simultaneously, releasing one doesn't affect the other
test('different homes hold locks simultaneously, independent release',async t=>{
 const cleanup=new CleanupTracker();
 const root=await makeRoot(t);
 cleanup.setRoot(root);
 const homeA=join(root,'homeA'),homeB=join(root,'homeB');
 await mkdir(homeA);await mkdir(homeB);

 const childA=spawnLockAcquirer(homeA,'A');
 const childB=spawnLockAcquirer(homeB,'B');
 trackChild(childA,t,cleanup);trackChild(childB,t,cleanup);
 registerRootCleanup(t,cleanup);
 const lqA=new LineQueue(childA),lqB=new LineQueue(childB);

 await waitReady(lqA,'A');await waitReady(lqB,'B');
 childA.stdin.write('go\n');childB.stdin.write('go\n');
 assert.equal(JSON.parse(await lqA.nextLine()).result,'acquired');
 assert.equal(JSON.parse(await lqB.nextLine()).result,'acquired');

 childA.stdin.write('release\n');
 assert.equal(JSON.parse(await lqA.nextLine()).result,'released');

 await assert.rejects(()=>lstat(join(homeA,'.p2-manager-lock')),/ENOENT/);
 const bStat=await lstat(join(homeB,'.p2-manager-lock'));
 assert.ok(bStat.isDirectory(),'B lock must survive A release');
});

// Test 5: owner content replaced → release rejects, replacement content preserved
// Same-process verification (not subprocess) — tests lock's internal identity check.
test('tampered owner blocks release, replacement content preserved',async t=>{
 const {acquireInstanceLock}=await import('../scripts/instance-lock.mjs');
 const root=await mkdtemp(join(tmpdir(),'p2-lock-conc-'));
 t.after(()=>rm(root,{recursive:true,force:true}));
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
