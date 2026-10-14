import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
function compile(path,module){return ts.transpileModule(readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module,target:ts.ScriptTarget.ES2022}}).outputText;}
const domain=await import('data:text/javascript;base64,'+Buffer.from(compile('../src/domain/entry-capabilities.ts',ts.ModuleKind.ESNext)).toString('base64'));
const snapshot=()=>({schemaVersion:1,entries:['workbench','cli','tui','dashboard','desktop'].map(kind=>({kind,assetState:'present',dependencies:'unverified',runtime:'unknown',launch:{allowed:false,reason:'LIFECYCLE_NOT_INTEGRATED'}}))});

test('capability decoder projects only known row fields',()=>{
 const input=snapshot();input.entries[0].path='/private';
 const rows=domain.decodeEntryCapabilities(input);assert.equal(rows.length,5);assert.deepEqual(rows[0],{kind:'workbench',assetState:'present'});
});
for(const [name,mutate] of [
 ['version',v=>v.schemaVersion=2],['duplicates',v=>v.entries[1].kind='workbench'],['missing entry',v=>v.entries.pop()],
 ['asset state',v=>v.entries[0].assetState='ready'],['launch enabled',v=>v.entries[0].launch.allowed=true],
 ['dependencies verified',v=>v.entries[0].dependencies='ready'],['runtime verified',v=>v.entries[0].runtime='ready'],
])test('decoder rejects incompatible '+name,()=>{const value=snapshot();mutate(value);assert.throws(()=>domain.decodeEntryCapabilities(value));});

test('body reader accepts valid response and rejects oversize or malformed data',async()=>{
 const signal=new AbortController().signal;
 assert.equal((await domain.readEntryCapabilities(Response.json(snapshot()),signal)).length,5);
 await assert.rejects(domain.readEntryCapabilities(new Response(' '.repeat(16385)),signal),/ENTRY_RESPONSE_TOO_LARGE/);
 await assert.rejects(domain.readEntryCapabilities(new Response('{'),signal));
});
test('body cancellation interrupts stalled reading',async()=>{
 let cancelled=false;const controller=new AbortController();
 const response=new Response(new ReadableStream({pull(){controller.abort();},cancel(){cancelled=true;}}));
 await assert.rejects(domain.readEntryCapabilities(response,controller.signal));assert.equal(cancelled,true);
});

// Synthetic hook scheduler; actual hook and decoder/read implementation are imported.
function harness(reader=domain.readEntryCapabilities){
 const slots=[],reads=[];let cursor=0;
 const react={useState(initial){const i=cursor++;if(!(i in slots))slots[i]=initial;return[slots[i],v=>slots[i]=v];},useRef(initial){const i=cursor++;return slots[i]??(slots[i]={current:initial});},useCallback(fn){return fn;},useEffect(fn,deps){const i=cursor++;if(!slots[i]||slots[i].identity!==deps[0]){slots[i]?.cleanup?.();slots[i]={identity:deps[0],cleanup:fn()};}}};
 const module={exports:{}};
 new Function('require','module','exports','fetch',compile('../src/hooks/useEntryCapabilities.ts',ts.ModuleKind.CommonJS))(name=>name==='react'?react:{readEntryCapabilities:reader},module,module.exports,(url,options)=>new Promise((resolve,reject)=>reads.push({url,options,resolve,reject})));
 return{reads,render(identity='token'){cursor=0;return module.exports.useEntryCapabilities(identity);},unmount(){for(const slot of slots)slot?.cleanup?.();}};
}
test('hook does not fetch without identity; authenticated request uses fixed URL',async()=>{
 const h=harness();await h.render('').inspect();assert.equal(h.reads.length,0);
 const p=h.render().inspect();assert.equal(h.reads[0].url,'/api/entry-capabilities');assert.equal(h.reads[0].options.credentials,'omit');
 h.reads[0].resolve(Response.json(snapshot()));await p;assert.equal(h.render().rows.length,5);h.unmount();
});
test('hook failure clears old rows and ends loading',async()=>{
 const h=harness();let p=h.render().inspect();h.reads[0].resolve(Response.json(snapshot()));await p;
 p=h.render().inspect();assert.equal(h.render().rows,null);h.reads[1].resolve(new Response('',{status:404}));await p;
 assert.equal(h.render().failed,true);assert.equal(h.render().loading,false);assert.equal(h.render().rows,null);h.unmount();
});
for(const outcome of ['success','error'])test('late body '+outcome+' cannot replace newer capabilities',async()=>{
 let entered,release,reject;const barrier=new Promise(r=>{entered=r;});let calls=0;
 const h=harness(async()=>{if(++calls===1){entered();return new Promise((yes,no)=>{release=yes;reject=no;});}return [{kind:'cli',assetState:'missing'}];});
 const a=h.render().inspect();h.reads[0].resolve(Response.json(snapshot()));await barrier;
 const b=h.render().inspect();h.reads[1].resolve(Response.json(snapshot()));await b;
 if(outcome==='success')release([{kind:'cli',assetState:'present'}]);else reject(new Error('late'));
 await a;assert.deepEqual(h.render().rows,[{kind:'cli',assetState:'missing'}]);assert.equal(h.render().failed,false);assert.equal(h.render().loading,false);h.unmount();
});
test('identity change hides old results, cancels pending reads and rejects stale callbacks',async()=>{
 const h=harness();const old=h.render('old');let p=old.inspect();h.reads[0].resolve(Response.json(snapshot()));await p;
 assert.equal(h.render('new').rows,null);assert.equal(h.render('old').rows,null);
 await old.inspect();assert.equal(h.reads.length,1);
 p=h.render('old').inspect();h.render('new');assert.equal(h.reads[1].options.signal.aborted,true);
 h.reads[1].resolve(Response.json(snapshot()));await p;assert.equal(h.render('new').rows,null);h.unmount();
});
test('unmount aborts pending capability reads',async()=>{
 const h=harness(),p=h.render().inspect();h.unmount();assert.equal(h.reads[0].options.signal.aborted,true);
 h.reads[0].resolve(Response.json(snapshot()));await p;assert.equal(h.render().rows,null);
});
