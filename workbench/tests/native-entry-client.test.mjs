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
test('diagnostics accept only allowlisted conflict headers and never read error bodies',async()=>{
 const cases=[[403,'INSTANCE_LOCKED','FORBIDDEN'],[404,'INSTANCE_LOCKED','UNAVAILABLE'],
  [409,'INSTANCE_LOCKED','INSTANCE_LOCKED'],[409,'DASHBOARD_NOT_READY','DASHBOARD_NOT_READY'],
  [409,'INSTANCE_LOCKED: PRIVATE','CONFLICT'],[409,'toString','CONFLICT'],
  [409,'INSTANCE_LOCKED, INSTANCE_LOCKED','CONFLICT'],[500,'INSTANCE_LOCKED','TRANSPORT']];
 for(const [status,header,expected] of cases){
  let cancelled=false;
  const body=new ReadableStream({pull(){return new Promise(()=>{});},cancel(){cancelled=true;}});
  const d=domain(async()=>new Response(body,{status,headers:{'X-Native-Entry-Reason':header}}));
  await assert.rejects(d.requestNativeEntry('synthetic','dashboard',new AbortController().signal),error=>{
   assert.equal(error.message,'NATIVE_REQUEST_FAILED');assert.equal(d.nativeFailureReason(error),expected);return true;
  });
  assert.equal(cancelled,true);
 }
 const d=domain();assert.equal(d.nativeFailureReason(new Error('INSTANCE_LOCKED: PRIVATE')),'TRANSPORT');
});
test('complete native reason allowlists agree and success ignores diagnostic headers',async()=>{
 const source=ts.createSourceFile('control-server.mjs',readFileSync(new URL('../scripts/control-server.mjs',import.meta.url),'utf8'),ts.ScriptTarget.ES2022,true,ts.ScriptKind.JS);
 const declarations=[];
 const visit=node=>{if(ts.isVariableDeclaration(node)&&node.name.getText(source)==='nativeOperationReasons')declarations.push(node);ts.forEachChild(node,visit);};visit(source);
 assert.equal(declarations.length,1);const init=declarations[0].initializer;
 assert.ok(ts.isNewExpression(init));assert.equal(init.expression.getText(source),'Set');
 assert.equal(init.arguments.length,1);assert.ok(ts.isArrayLiteralExpression(init.arguments[0]));
 const reasons=init.arguments[0].elements.map(node=>{assert.ok(ts.isStringLiteral(node));return node.text;});
 const d=domain();assert.deepEqual(reasons,[...d.nativeOperationReasons]);assert.equal(new Set(reasons).size,reasons.length);
 for(const reason of reasons){
  const current=domain(async()=>Response.json({}, {status:409,headers:{'X-Native-Entry-Reason':reason}}));
  await assert.rejects(current.requestNativeEntry('synthetic','open',new AbortController().signal),error=>current.nativeFailureReason(error)===reason);
 }
 const success=domain(async()=>Response.json({accepted:true},{status:202,headers:{'X-Native-Entry-Reason':'INSTANCE_LOCKED'}}));
 assert.equal(await success.requestNativeEntry('synthetic','open',new AbortController().signal),null);
});
function harness({manualClock=false}={}){
 const slots=[],calls=[];let cursor=0,writes=0;
 const timers=new Set();
 const schedule=manualClock?(fn,ms)=>{const timer={fn,ms};timers.add(timer);return timer;}:setTimeout;
 const cancel=manualClock?timer=>timers.delete(timer):clearTimeout;
 const react={useState(initial){const i=cursor++;if(!(i in slots))slots[i]=initial;return [slots[i],v=>{writes++;slots[i]=v;}];},useRef(initial){const i=cursor++;return slots[i]??(slots[i]={current:initial});},useCallback(fn){return fn;},useEffect(fn,deps){const i=cursor++;if(!slots[i]||slots[i].identity!==deps[0]){slots[i]?.cleanup?.();slots[i]={identity:deps[0],cleanup:fn()};}}};
 const module={exports:{}},d=domain();
 const requestNativeEntry=(identity,action,signal)=>new Promise((resolve,reject)=>calls.push({identity,action,signal,resolve,reject}));
 new Function('require','module','exports','setTimeout','clearTimeout',compile('../src/hooks/useNativeEntry.ts'))(name=>name==='react'?react:{...d,requestNativeEntry},module,module.exports,schedule,cancel);
 return {calls,failure:code=>new d.NativeEntryRequestError(code),fireTimer(){assert.equal(timers.size,1);const [timer]=timers;timers.delete(timer);timer.fn();return timer.ms;},get writes(){return writes;},render(identity='synthetic'){cursor=0;return module.exports.useNativeEntry(identity);},close(){for(const slot of slots)slot?.cleanup?.();}};
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
test('safe diagnosis does not prove idle; refresh clears it and idle stop is fenced',async()=>{
 const h=harness();let p=h.render().refresh();h.calls[0].resolve({kind:null,state:'idle'});await p;
 await h.render().act('stop');assert.equal(h.calls.length,1);
 p=h.render().act('dashboard');h.calls[1].reject(h.failure('INSTANCE_LOCKED'));await p;
 assert.equal(h.render().failure,'INSTANCE_LOCKED');assert.equal(h.render().status.state,'unknown');
 await h.render().act('dashboard');assert.equal(h.calls.length,2);
 p=h.render().refresh();assert.equal(h.render().failure,null);
 h.calls[2].resolve({kind:null,state:'idle'});await p;assert.equal(h.render().failure,null);h.close();
});
test('late diagnostic failure cannot cross an identity change',async()=>{
 const h=harness(),p=h.render('old').refresh();h.render('new');
 h.calls[0].reject(h.failure('INSTANCE_LOCKED'));await p;
 assert.equal(h.render('new').failure,null);assert.equal(h.render('new').failed,false);h.close();
});
for(const outcome of ['resolve','reject'])test('old '+outcome+' cannot clear a new identity request or its pending gate',async()=>{
 const h=harness(),old=h.render('old').refresh(),next=h.render('new').refresh();
 assert.equal(h.calls.length,2);assert.equal(h.render('new').pending,true);
 h.calls[0][outcome](outcome==='resolve'?{kind:'dashboard',state:'running'}:h.failure('INSTANCE_LOCKED'));await old;
 assert.equal(h.render('new').pending,true);assert.equal(h.render('new').failure,null);assert.equal(h.render('new').failed,false);
 await h.render('new').refresh();await h.render('new').act('stop');assert.equal(h.calls.length,2);
 h.calls[1].resolve({kind:null,state:'idle'});await next;
 assert.equal(h.render('new').pending,false);assert.equal(h.render('new').status.state,'idle');h.close();
});
for(const action of ['status','dashboard'])test('hook deadline classifies '+action+' as cancelled without retry',async()=>{
 const h=harness({manualClock:true});
 if(action==='dashboard'){const initial=h.render().refresh();h.calls[0].resolve({kind:null,state:'idle'});await initial;}
 const pending=action==='status'?h.render().refresh():h.render().act(action),call=h.calls.at(-1),count=h.calls.length;
 assert.equal(h.fireTimer(),action==='status'?20000:130000);assert.equal(call.signal.aborted,true);
 call.reject(new Error('synthetic cancelled transport'));await pending;
 assert.equal(h.render().failure,'CANCELLED');assert.equal(h.render().status.state,'unknown');assert.equal(h.render().pending,false);
 await h.render().act('dashboard');assert.equal(h.calls.length,count);h.close();
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
 const writesAfterClose=h.writes;
 h.calls[0].reject(new Error('late'));await p;await old.refresh();
 assert.equal(h.writes,writesAfterClose,'no state write after unmount');
 const view=h.render();assert.equal(view.failed,false);assert.equal(view.status.state,'unknown');
 assert.equal(h.calls.length,1);
});
