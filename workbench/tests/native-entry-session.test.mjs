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
