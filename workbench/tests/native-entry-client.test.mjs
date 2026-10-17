import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const compile=path=>ts.transpileModule(readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function domain(fetcher){const module={exports:{}};new Function('module','exports','fetch',compile('../src/domain/native-entry.ts'))(module,module.exports,fetcher);return module.exports;}
test('status decoder rejects contradictory state and unexpected fields',()=>{
 const d=domain();assert.deepEqual(d.decodeNativeStatus({kind:null,state:'idle'}),{kind:null,state:'idle'});
 for(const value of [{kind:'cli',state:'idle'},{kind:null,state:'running'},{kind:'desktop',state:'running'},{kind:'cli',state:'ready'},{kind:null,state:'idle',token:'synthetic'}])assert.throws(()=>d.decodeNativeStatus(value));
});
test('transport sends fixed bodyless actions and strictly checks acknowledgement',async()=>{
 const calls=[];const d=domain(async(...args)=>{calls.push(args);return Response.json({accepted:true},{status:202});});
 const signal=new AbortController().signal;
 assert.equal(await d.requestNativeEntry('synthetic','cli',signal),null);
 assert.equal(calls[0][0],'/api/native-entry/cli/start');assert.equal(calls[0][1].method,'POST');assert.equal(calls[0][1].body,undefined);assert.equal(calls[0][1].redirect,'error');
 await assert.rejects(d.requestNativeEntry('synthetic','arbitrary',signal));assert.equal(calls.length,1);
 for(const response of [Response.json({accepted:true}),Response.json({accepted:false},{status:202}),new Response(' '.repeat(4097))]){
  await assert.rejects(domain(async()=>response).requestNativeEntry('synthetic','stop',signal));
 }
});
function harness(){
 const slots=[],calls=[];let cursor=0;
 const react={useState(initial){const i=cursor++;if(!(i in slots))slots[i]=initial;return [slots[i],v=>slots[i]=v];},useRef(initial){const i=cursor++;return slots[i]??(slots[i]={current:initial});},useCallback(fn){return fn;},useEffect(fn,deps){const i=cursor++;if(!slots[i]||slots[i].identity!==deps[0]){slots[i]?.cleanup?.();slots[i]={identity:deps[0],cleanup:fn()};}}};
 const module={exports:{}};
 const requestNativeEntry=(identity,action,signal)=>new Promise((resolve,reject)=>calls.push({identity,action,signal,resolve,reject}));
 new Function('require','module','exports',compile('../src/hooks/useNativeEntry.ts'))(name=>name==='react'?react:{requestNativeEntry},module,module.exports);
 return {calls,render(identity='synthetic'){cursor=0;return module.exports.useNativeEntry(identity);},close(){for(const slot of slots)slot?.cleanup?.();}};
}
test('unknown cannot start; duplicate action blocked; acknowledgement requires status read',async()=>{
 const h=harness();await h.render().act('cli');assert.equal(h.calls.length,0);
 let p=h.render().refresh();h.calls[0].resolve({kind:null,state:'idle'});await p;
 p=h.render().act('dashboard');await h.render().act('cli');assert.equal(h.calls.length,2);
 h.calls[1].resolve(null);await Promise.resolve();assert.equal(h.calls[2].action,'status');assert.equal(h.render().status.state,'unknown');
 h.calls[2].resolve({kind:'dashboard',state:'running'});await p;assert.equal(h.render().status.state,'running');h.close();
});
for(const outcome of ['resolve','reject'])test('identity change fences late '+outcome+' and old callbacks',async()=>{
 const h=harness(),old=h.render('old'),pending=old.refresh();h.render('new');assert.equal(h.calls[0].signal.aborted,true);
 h.calls[0][outcome](outcome==='resolve'?{kind:'dashboard',state:'running'}:new Error('late'));await pending;
 assert.equal(h.render('new').status.state,'unknown');assert.equal(h.render('new').failed,false);
 await old.act('stop');assert.equal(h.calls.length,1);h.close();
});
test('unmount aborts observation and fences retained callbacks',async()=>{
 const h=harness(),old=h.render(),p=old.refresh();h.close();assert.equal(h.calls[0].signal.aborted,true);
 h.calls[0].resolve({kind:null,state:'idle'});await p;await old.act('stop');await old.refresh();assert.equal(h.calls.length,1);
});
test('failed mutation leaves unknown and never retries automatically',async()=>{
 const h=harness();let p=h.render().refresh();h.calls[0].resolve({kind:null,state:'idle'});await p;
 p=h.render().act('cli');h.calls[1].reject(new Error('lost acknowledgement'));await p;
 assert.equal(h.render().failed,true);assert.equal(h.render().status.state,'unknown');await h.render().act('cli');assert.equal(h.calls.length,2);h.close();
});
// ---- T1 coverage: bounded body, cancellation, error-body isolation, post-ack status read, identity round trip ----
const encoder=new TextEncoder();
function streamed(chunks,{status=200,keepOpen=false}={}){
 const state={cancelled:false};
 let index=0;
 const stream=new ReadableStream({
  pull(controller){
   if(index<chunks.length){const chunk=chunks[index++];controller.enqueue(typeof chunk==='string'?encoder.encode(chunk):chunk);return undefined;}
   if(keepOpen)return new Promise(()=>{});
   controller.close();return undefined;
  },
  cancel(){state.cancelled=true;},
 });
 return {stream,state,response:new Response(stream,{status})};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('cancelling a pending body rejects and releases the stream',async()=>{
 let started;const reading=new Promise(resolve=>{started=resolve;});
 const state={cancelled:false};
 const stream=new ReadableStream({pull(){started();return new Promise(()=>{});},cancel(){state.cancelled=true;}});
 const d=domain(async()=>new Response(stream,{status:200}));
 const controller=new AbortController();
 const pending=d.requestNativeEntry('synthetic','status',controller.signal);
 await reading;controller.abort();
 await assert.rejects(pending,/NATIVE_REQUEST_CANCELLED|abort/i);
 assert.equal(state.cancelled,true);
});
test('chunked bodies over the byte limit stop before parsing',async()=>{
 const {response,state}=streamed(['{"kind":',encoder.encode(new Uint8Array(4096).fill(0x20))],{keepOpen:true});
 await assert.rejects(domain(async()=>response).requestNativeEntry('synthetic','status',new AbortController().signal),/NATIVE_RESPONSE_TOO_LARGE/);
 assert.equal(state.cancelled,true);
});
test('invalid utf-8 and truncated json are rejected',async()=>{
 const invalid=streamed([new Uint8Array([0x7b,0xff,0x7d])]);
 await assert.rejects(domain(async()=>invalid.response).requestNativeEntry('synthetic','status',new AbortController().signal));
 const truncated=streamed(['{"kind":null,"state":']);
 await assert.rejects(domain(async()=>truncated.response).requestNativeEntry('synthetic','status',new AbortController().signal));
});
test('error responses expose no body text and are cancelled',async()=>{
 for(const status of [403,409,500]){
  const {response,state}=streamed(['SYNTHETIC_SECRET_BODY'],{status,keepOpen:true});
  await assert.rejects(domain(async()=>response).requestNativeEntry('synthetic','stop',new AbortController().signal),error=>{
   assert.equal(error.message,'NATIVE_REQUEST_FAILED');assert.equal(error.message.includes('SYNTHETIC_SECRET_BODY'),false);return true;
  });
  await tick();assert.equal(state.cancelled,true);
 }
});
test('status read failure after acknowledgement stays unknown without retry',async()=>{
 const h=harness();let p=h.render().refresh();h.calls[0].resolve({kind:null,state:'idle'});await p;
 p=h.render().act('cli');h.calls[1].resolve(null);await tick();
 assert.equal(h.calls[2].action,'status');
 h.calls[2].reject(new Error('status read lost'));await p;
 assert.equal(h.render().status.state,'unknown');assert.equal(h.render().failed,true);
 await tick();assert.equal(h.calls.length,3);
 await h.render().act('cli');await h.render().act('dashboard');assert.equal(h.calls.length,3);h.close();
});
test('identity round trip fences the previous generation and its actions',async()=>{
 const h=harness();const first=h.render('alpha');const pending=first.refresh();
 h.render('beta');assert.equal(h.calls[0].signal.aborted,true);
 h.calls[0].resolve({kind:'dashboard',state:'running'});await pending;
 const returned=h.render('alpha');
 assert.equal(returned.status.state,'unknown');assert.equal(returned.pending,false);assert.equal(returned.failed,false);
 await first.act('stop');await first.act('cli');await h.render('alpha').act('cli');
 assert.equal(h.calls.length,1);h.close();
});
test('late rejection after unmount cannot mark a failed state',async()=>{
 const h=harness(),old=h.render(),p=old.refresh();h.close();assert.equal(h.calls[0].signal.aborted,true);
 h.calls[0].reject(new Error('late'));await p;await old.refresh();
 assert.equal(h.calls.length,1);h.close();
});
