import test from 'node:test';
import assert from 'node:assert/strict';
import {PassThrough} from 'node:stream';
import {EventEmitter} from 'node:events';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createCdpClient,closeOwnedBrowser,waitUntil,projectNetwork,chromeEnvironment} from './s1-browser-driver.mjs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';

test('Chrome temp, home and caches remain in owned roots with an environment allowlist',()=>{
 const root=join(tmpdir(),'synthetic-browser-root'),tempRoot=join(tmpdir(),'short'),env=chromeEnvironment(root,tempRoot);
 assert.deepEqual(Object.keys(env).sort(),['HOME','LANG','PATH','TEMP','TMP','TMPDIR','XDG_CACHE_HOME','XDG_CONFIG_HOME'].sort());
 assert.equal(env.HOME===root,true);
 for(const key of ['TEMP','TMP','TMPDIR'])assert.equal(env[key]===tempRoot,true);
 for(const [key,dir] of [['XDG_CONFIG_HOME','config'],['XDG_CACHE_HOME','cache']])assert.equal(env[key]===join(root,dir),true);
});

function transport(t,options={}){
 const input=new PassThrough(),output=new PassThrough();
 const client=createCdpClient(input,output,{timeoutMs:30,...options});
 t.after(()=>{client.close();input.destroy();output.destroy();});
 return {input,output,client};
}
test('CDP handles split frames, events and out-of-order replies',async t=>{
 const events=[],{input,output,client}=transport(t,{onEvent:e=>events.push(e.method)});
 const chunks=[];input.on('data',chunk=>chunks.push(chunk.toString()));
 const first=client.send('First'),second=client.send('Second',{},'session');
 await new Promise(resolve=>setImmediate(resolve));
 const sent=chunks.join('').split('\0').filter(Boolean).map(JSON.parse);
 assert.equal(sent[1].sessionId,'session');
 output.write('{"id":2,"result":{"ok":');output.write('true}}\0{"method":"event"}\0{"id":1,"result":{}}\0');
 assert.deepEqual(await second,{ok:true});assert.deepEqual(await first,{});assert.deepEqual(events,['event']);
});
test('CDP timeout rejects without exposing request credentials',async t=>{
 const {client}=transport(t);
 await assert.rejects(client.send('Secret',{token:'synthetic-sensitive-marker'}),e=>e.message==='CDP_TIMEOUT');
});
test('CDP peer error is sanitized and future requests can finish',async t=>{
 const {client,output}=transport(t);const result=client.send('First');
 output.write('{"id":1,"error":{"message":"synthetic-sensitive-marker"}}\0');
 await assert.rejects(result,e=>e.message==='CDP_REJECTED');
 const next=client.send('Second');output.write('{"id":2,"result":{"ok":true}}\0');
 assert.deepEqual(await next,{ok:true});
});
test('CDP oversized input fails closed without exposing its content',async t=>{
 const {client,output}=transport(t);const result=client.send('First');
 output.write('x'.repeat(2*1024*1024+1));
 await assert.rejects(result,e=>e.message==='CDP_PROTOCOL');
 await assert.rejects(client.send('Second'),e=>e.message==='CDP_PROTOCOL');
});
test('CDP malformed input rejects pending and future requests',async t=>{
 const {client,output}=transport(t);const result=client.send('First');output.write('invalid secret\0');
 await assert.rejects(result,e=>e.message==='CDP_PROTOCOL');
 await assert.rejects(client.send('Second'),e=>e.message==='CDP_PROTOCOL');
});
test('CDP closed pipe rejects all waiters without waiting for timeout',async t=>{
 const {client,output}=transport(t,{timeoutMs:10000});const pending=client.send('First');output.emit('end');
 await assert.rejects(pending,e=>e.message==='CDP_CLOSED');
});
test('CDP write errors are sanitized and reject pending work',async t=>{
 const {client,input}=transport(t);const pending=client.send('First');input.emit('error',new Error('synthetic-sensitive-marker'));
 await assert.rejects(pending,e=>e.message==='CDP_CLOSED');
});
test('network evidence retains only known same-origin route and status',()=>{
 const origin='http://127.0.0.1:3333';
 assert.deepEqual(projectNetwork({url:origin+'/api/status?token=synthetic-sensitive-marker#secret',status:200},origin),{path:'/api/status',status:200});
 for(const url of ['http://wrong.invalid/api/status',origin+'/private-token-path',origin+'/assets/secret.js','not a url'])assert.equal(projectNetwork({url,status:200},origin),null);
 assert.equal(projectNetwork({url:origin+'/api/status',status:'200'},origin),null);
});
test('UI wait observes readiness and has a bounded failure',async()=>{
 let checks=0;await waitUntil(async()=>++checks===3,{timeoutMs:200,intervalMs:1});assert.equal(checks,3);
 await assert.rejects(waitUntil(async()=>false,{timeoutMs:5,intervalMs:1}),e=>e.message==='UI_WAIT_TIMEOUT');
});
test('already interrupted UI wait never evaluates its predicate',async()=>{
 const controller=new AbortController();controller.abort();let calls=0;
 await assert.rejects(waitUntil(async()=>{calls++;return true;},{signal:controller.signal}),e=>e.message==='BROWSER_INTERRUPTED');
 assert.equal(calls,0);
});
test('owned browser shutdown waits for actual close rather than kill request',async()=>{
 const child=new EventEmitter();child.pid=123;child.exitCode=null;child.signalCode=null;
 let kills=0,closed=false;child.kill=()=>{kills++;setTimeout(()=>{closed=true;child.signalCode='SIGTERM';child.emit('close');},5);return true;};
 await closeOwnedBrowser(child,async()=>{throw new Error('synthetic-sensitive-marker');},20);
 assert.equal(kills,1);assert.equal(closed,true);
});
test('failed shutdown is not reported as cleaned',async()=>{
 const child=new EventEmitter();child.pid=123;child.exitCode=null;child.signalCode=null;child.kill=()=>true;
 await assert.rejects(closeOwnedBrowser(child,async()=>{},5),e=>e.message==='BROWSER_CLEANUP_FAILED');
});
test('browser entry import is silent and does not start a browser',()=>{
 const url=new URL('./s1-browser-check.mjs',import.meta.url).href;
 const result=spawnSync(process.execPath,['--input-type=module','-e',`await import(${JSON.stringify(url)})`],{encoding:'utf8',timeout:3000});
 assert.equal(result.status,0);assert.equal(result.stdout.length,0);assert.equal(result.stderr.length,0);
});
test('explicit missing browser produces a failed sanitized report, never a skip',()=>{
 const result=spawnSync(process.execPath,[fileURLToPath(new URL('./s1-browser-check.mjs',import.meta.url))],{encoding:'utf8',timeout:3000,env:{...process.env,CHROME_BIN:'/missing-synthetic-sensitive-marker/browser'}});
 assert.equal(result.status,1);assert.equal(result.stderr.length,0);
 const report=JSON.parse(result.stdout);assert.equal(report.status,'failed');assert.equal(report.failure,'BROWSER_UNAVAILABLE');
 assert.equal(report.cleaned,true);assert.equal(report.results.length,0);assert.equal(result.stdout.includes('synthetic-sensitive-marker'),false);
});
test('already interrupted browser entry fails before browser discovery or startup',async()=>{
 const {runS1BrowserCheck}=await import('./s1-browser-check.mjs');
 const controller=new AbortController();controller.abort();
 const report=await runS1BrowserCheck({chromePath:'/missing-synthetic-sensitive-marker/browser',signal:controller.signal});
 assert.equal(report.status,'failed');assert.equal(report.failure,'BROWSER_INTERRUPTED');
 assert.equal(report.cleaned,true);assert.deepEqual(report.results,[]);assert.deepEqual(report.network,[]);
 assert.equal(JSON.stringify(report).includes('synthetic-sensitive-marker'),false);
});
