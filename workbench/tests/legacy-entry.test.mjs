import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,rm,lstat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {legacyCommand,runLockedLegacyEntry} from '../scripts/legacy-hermes-entry.mjs';
import {acquireInstanceLock} from '../scripts/instance-lock.mjs';

test('legacy entry uses fixed foreground modes; rejects profile and daemon escape',()=>{
 assert.deepEqual(legacyCommand([]),['-m','hermes_cli.main','--cli']);
 assert.deepEqual(legacyCommand(['gateway']),['-m','hermes_cli.main','gateway','run']);
 assert.deepEqual(legacyCommand(['gateway','run']),['-m','hermes_cli.main','gateway','run']);
 for(const args of [['gateway','start'],['gateway','restart'],['gateway','stop'],['gateway','install'],['dashboard','--stop'],['--profile','other'],['chat','-p','other'],['desktop'],['--tui'],['update']])assert.throws(()=>legacyCommand(args),/LEGACY_COMMAND_UNSUPPORTED/);
 assert.deepEqual(legacyCommand(['config','edit']),['-m','hermes_cli.main','config','edit']);
});

test('legacy and native/managed lock users exclude each other until confirmed tree exit',async t=>{
 const root=await mkdtemp(join(tmpdir(),'legacy-entry-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const home=join(root,'data');await mkdir(home);
 let finish,started;const barrier=new Promise(resolve=>{started=resolve;});
 let launches=0;
 const prepare=async()=>({start:()=>{launches++;started();return {ready:Promise.resolve(),closed:new Promise(resolve=>{finish=resolve;}),stop:async()=>{}};}});
 const lock=await acquireInstanceLock(home);
 await assert.rejects(runLockedLegacyEntry({home,prepare}),/INSTANCE_LOCKED/);assert.equal(launches,0);
 await lock.release();
 const run=runLockedLegacyEntry({home,prepare});await barrier;
 await assert.rejects(acquireInstanceLock(home),/INSTANCE_LOCKED/);
 finish({treeExited:true,exitCode:42});assert.equal(await run,42);
 const next=await acquireInstanceLock(home);await next.release();
});

test('unknown legacy exit retains lock and cannot report success',async t=>{
 const root=await mkdtemp(join(tmpdir(),'legacy-unknown-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const home=join(root,'data');await mkdir(home);
 await assert.rejects(runLockedLegacyEntry({home,prepare:async()=>({start:()=>({ready:Promise.resolve(),closed:Promise.resolve({treeExited:false}),stop:async()=>{}})})}),/LEGACY_EXIT_UNCONFIRMED/);
 assert.equal((await lstat(join(home,'.p2-manager-lock'))).isDirectory(),true);
});
