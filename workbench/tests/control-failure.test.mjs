// Real loopback management HTTP with synthetic start failures; no Hermes/model.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,rm,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import ts from 'typescript';
import {startControlServer} from '../scripts/control-server.mjs';
const source=await readFile(new URL('../src/domain/control.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText;
const {controlRequest}=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
for(const [failure,reason] of [['INSTANCE_LOCKED','INSTANCE_LOCKED'],['PROCESS_STARTUP_TIMEOUT','PROCESS_STARTUP_TIMEOUT'],['SOURCE_ENV_REQUIRES_REVIEW','SOURCE_ENV_REQUIRES_REVIEW'],['private-path-and-secret','UNKNOWN']])test(`startup failure projects only safe reason ${reason}`,async t=>{
 const root=await mkdtemp(join(tmpdir(),'control-failure-'));t.after(()=>rm(root,{recursive:true,force:true}));await mkdir(join(root,'assets'));
 let starts=0;const s=await startControlServer({assets:join(root,'assets'),startInstance:async()=>{starts++;throw new Error(failure);}});t.after(()=>s.close());
 const response=await fetch(s.origin+'/api/start',{method:'POST',headers:{Origin:s.origin,Authorization:'Bearer '+s.token}});
 assert.equal(response.status,500);assert.deepEqual(await response.json(),{error:'OPERATION_FAILED',reason});assert.equal(starts,1);
});
test('failed readiness retains owned handle until explicit stop, no automatic retry',async t=>{
 const root=await mkdtemp(join(tmpdir(),'control-readiness-'));t.after(()=>rm(root,{recursive:true,force:true}));
 let starts=0,stops=0;const s=await startControlServer({assets:root,startInstance:async()=>{starts++;return {state:'exited',connection:Promise.reject(new Error('PROCESS_EXITED_BEFORE_READY')),stop:async()=>{stops++;}};}});t.after(()=>s.close());
 const call=path=>fetch(s.origin+path,{method:'POST',headers:{Origin:s.origin,Authorization:'Bearer '+s.token}});
 assert.deepEqual(await(await call('/api/start')).json(),{error:'OPERATION_FAILED',reason:'PROCESS_EXITED_BEFORE_READY'});
 assert.equal((await call('/api/start')).status,409);assert.equal(starts,1);assert.equal(stops,0);
 assert.equal((await call('/api/stop')).status,200);assert.equal(stops,1);
});
for(const status of [403,409,500])test(`client preserves safe HTTP ${status} classification without leaking body`,async()=>{
 await assert.rejects(controlRequest('start','synthetic',new AbortController().signal,async()=>new Response(JSON.stringify({error:'OPERATION_FAILED',reason:'SECRET /private',token:'secret'}),{status})),e=>{
  assert.equal(e.status,status);assert.equal(e.reason,'UNKNOWN');assert.doesNotMatch(e.message,/SECRET|private|secret/);return true;
 });
});
test('client recognizes allowlisted reason and bounds error bodies',async()=>{
 await assert.rejects(controlRequest('start','synthetic',new AbortController().signal,async()=>new Response(JSON.stringify({error:'OPERATION_FAILED',reason:'INSTANCE_LOCKED'}),{status:500})),e=>e.reason==='INSTANCE_LOCKED');
 let cancelled=false;
 const body=new ReadableStream({start(c){c.enqueue(new Uint8Array(9000));},cancel(){cancelled=true;}});
 await assert.rejects(controlRequest('start','synthetic',new AbortController().signal,async()=>new Response(body,{status:500})),e=>e.reason==='UNKNOWN');assert.equal(cancelled,true);
});
