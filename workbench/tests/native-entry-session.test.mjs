import test from 'node:test';
import assert from 'node:assert/strict';
import {createNativeEntrySession} from '../scripts/native-entry-session.mjs';

function fixture(){
 let releases=0,starts=0,finish;
 const closed=new Promise(resolve=>{finish=resolve;});
 const session=createNativeEntrySession({
  acquire:async()=>({release:async()=>{releases++;}}),
  prepare:async kind=>({start:async()=>{starts++;return {closed,stop:async()=>{}};}}),
 });
 return {session,finish,counts:()=>({releases,starts})};
}
test('entry retains lock until confirmed tree exit; rejects duplicate start',async()=>{
 const f=fixture();await f.session.start('cli');
 await assert.rejects(f.session.start('dashboard'),/ENTRY_BUSY/);
 await f.session.stop();
 assert.equal(f.session.status().state,'stopping');
 assert.equal(f.counts().releases,0);
 f.finish({treeExited:true});await f.session.closed;
 assert.deepEqual(f.counts(),{starts:1,releases:1});
 assert.equal(f.session.status().state,'idle');
});
test('unconfirmed exit preserves ownership and rejects restart',async()=>{
 const f=fixture();await f.session.start('dashboard');
 f.finish({treeExited:false});await f.session.closed;
 assert.equal(f.session.status().state,'unknown');
 assert.equal(f.counts().releases,0);
 await assert.rejects(f.session.start('cli'),/ENTRY_BUSY/);
});
test('unsupported kind has no acquisition or launch effects',async()=>{
 const f=fixture();await assert.rejects(f.session.start('desktop'),/INVALID_ENTRY/);
 assert.deepEqual(f.counts(),{starts:0,releases:0});
});

test('stop while starting fences late readiness',async()=>{
 let ready,finish;
 const session=createNativeEntrySession({
  acquire:async()=>({release:async()=>{}}),
  prepare:async()=>({start:async()=>({
   ready:new Promise(resolve=>{ready=resolve;}),
   closed:new Promise(resolve=>{finish=resolve;}),stop:async()=>{},
  })}),
 });
 await session.start('dashboard');
 assert.equal(session.status().state,'starting');
 await session.stop();ready();await Promise.resolve();
 assert.equal(session.status().state,'stopping');
 finish({treeExited:true});await session.closed;
 assert.equal(session.status().state,'idle');
});

test('readiness failure preserves owned stop and lock',async()=>{
 let rejectReady,finish,stops=0,releases=0;
 const session=createNativeEntrySession({
  acquire:async()=>({release:async()=>{releases++;}}),
  prepare:async()=>({start:async()=>({
   ready:new Promise((resolve,reject)=>{rejectReady=reject;}),
   closed:new Promise(resolve=>{finish=resolve;}),stop:async()=>{stops++;},
  })}),
 });
 await session.start('cli');rejectReady(new Error('not ready'));await Promise.resolve();
 assert.equal(session.status().state,'unknown');assert.equal(releases,0);
 await session.stop();assert.equal(stops,1);
 finish({treeExited:true});await session.closed;assert.equal(releases,1);
});

test('confirmed stop awaits lock release, not just host acknowledgement',async()=>{
 let finish,release;let entered=false;
 const session=createNativeEntrySession({
  acquire:async()=>({release:()=>{entered=true;return new Promise(resolve=>{release=resolve;});}}),
  prepare:async()=>({start:()=>({closed:new Promise(resolve=>{finish=resolve;}),stop:async()=>{finish({treeExited:true});return {treeExited:true};}})}),
 });
 await session.start('cli');let stopped=false;
 const stopping=session.stop().then(()=>{stopped=true;});
 await Promise.resolve();await Promise.resolve();
 assert.equal(entered,true);assert.equal(stopped,false);
 await assert.rejects(session.start('dashboard'),/ENTRY_BUSY/);
 release();await stopping;assert.equal(session.status().state,'idle');
});

test('only a ready owned Dashboard can be explicitly opened',async()=>{
 let finish,ready,opens=0;
 const session=createNativeEntrySession({
  acquire:async()=>({release:async()=>{}}),
  prepare:async()=>({start:()=>({ready:new Promise(resolve=>{ready=resolve;}),closed:new Promise(resolve=>{finish=resolve;}),stop:async()=>{},open:async()=>{opens++;}})}),
 });
 await session.start('dashboard');await assert.rejects(session.open(),/ENTRY_NOT_READY/);
 ready();await Promise.resolve();await session.open();assert.equal(opens,1);
 await session.stop();await assert.rejects(session.open(),/ENTRY_NOT_READY/);
 finish({treeExited:true});await session.closed;
 await assert.rejects(session.open(),/ENTRY_NOT_READY/);
});
