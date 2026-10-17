import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';
import {resolve} from 'node:path';
import {startNativeOwnedProcess} from '../scripts/native-owned-process.mjs';

function fixture(t,{kind='cli',probe=async()=>true}={}){
 const host=new EventEmitter();host.stdin=new PassThrough();host.stdout=new PassThrough();host.stderr=new PassThrough();
 let spawnOptions;
 const child=startNativeOwnedProcess({kind,python:resolve('synthetic-python'),args:['-c','synthetic'],cwd:resolve('.'),environment:{},probe},
  {platform:'win32',spawnHost:(command,args,options)=>{spawnOptions=options;return host;}});
 const frame=value=>host.stdout.emit('data',Buffer.from(JSON.stringify(value)+'\n'));
 t.after(()=>{host.emit('close',1);host.stdin.destroy();host.stdout.destroy();host.stderr.destroy();});
 return {child,host,frame,options:()=>spawnOptions};
}
test('real transport parser requires closed proof plus host exit and preserves code',async t=>{
 const f=fixture(t);f.frame({event:'started'});await f.child.ready;
 assert.equal(f.child.state,'ready');assert.equal(f.options().shell,false);
 f.frame({event:'closed',treeExited:true,exitCode:42});f.host.emit('close',0);
 assert.deepEqual(await f.child.closed,{treeExited:true,exitCode:42});assert.equal(f.child.state,'exited');
});
test('host exit zero alone never proves native tree exit',async t=>{
 const f=fixture(t);f.host.emit('close',0);
 await assert.rejects(f.child.ready,/EXITED_BEFORE_READY/);
 assert.equal((await f.child.closed).treeExited,false);assert.equal(f.child.state,'unknown');
});
test('a protocol stream error invalidates a later otherwise valid exit proof',async t=>{
 const f=fixture(t);f.frame({event:'started'});await f.child.ready;
 f.host.stdout.emit('error',new Error('synthetic transport failure'));
 f.frame({event:'closed',treeExited:true,exitCode:0});f.host.emit('close',0);
 assert.equal((await f.child.closed).treeExited,false);assert.equal(f.child.state,'unknown');
 await assert.rejects(f.child.stop(),/STOP_UNCONFIRMED/);
});
test('malformed host output invalidates even a later completion frame',async t=>{
 const f=fixture(t);f.host.stdout.emit('data',Buffer.from('raw output\n'));
 assert.equal(f.host.stdin.writableEnded,true);
 f.frame({event:'closed',treeExited:true,exitCode:0});f.host.emit('close',0);
 await assert.rejects(f.child.ready,/PROTOCOL/);assert.equal((await f.child.closed).treeExited,false);
});
test('stop fences a held Dashboard probe; no late running state',async t=>{
 let probeEntered,finishProbe;
 const entered=new Promise(resolve=>{probeEntered=resolve;});
 const f=fixture(t,{kind:'dashboard',probe:()=>{probeEntered();return new Promise(resolve=>{finishProbe=resolve;});}});
 f.frame({event:'started'});f.frame({event:'port',port:12345});await entered;
 const stopping=f.child.stop();finishProbe(true);
 await assert.rejects(f.child.ready,/STOPPED_BEFORE_READY/);assert.equal(f.child.state,'stopping');
 f.frame({event:'closed',treeExited:true,exitCode:104});f.host.emit('close',0);
 await stopping;assert.equal(f.child.state,'exited');
});
