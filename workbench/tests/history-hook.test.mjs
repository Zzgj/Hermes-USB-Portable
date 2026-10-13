// Executes the production hook and domain functions with a minimal hook scheduler.
// RPC/fetch are synthetic and fetch deliberately ignores abort to expose stale callbacks.
// Actual React/browser rendering is covered separately by test:s1-browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const settle=()=>new Promise(resolve=>setImmediate(resolve));
function harness(t){
 const slots=[],effects=[],calls=[],reads=[],cache=new Map();let cursor=0,rpc;
 const react={useState(initial){const i=cursor++;if(!(i in slots))slots[i]=initial;return [slots[i],value=>{slots[i]=typeof value==='function'?value(slots[i]):value;}];},useRef(initial){const i=cursor++;if(!(i in slots))slots[i]={current:initial};return slots[i];},useEffect(fn){const i=cursor++;if(!(i in slots)){slots[i]=true;effects.push(fn());}}};
 const fetch=(_url,options)=>new Promise((resolve,reject)=>reads.push({resolve,reject,options}));
 function load(url){
  if(cache.has(url.href))return cache.get(url.href).exports;
  const module={exports:{}};cache.set(url.href,module);
  const compiled=ts.transpileModule(readFileSync(url,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const require=spec=>{if(spec==='react')return react;if(!spec.startsWith('.'))throw new Error('UNEXPECTED_IMPORT');return load(new URL(spec+'.ts',url));};
  new Function('require','module','exports','fetch',compiled)(require,module,module.exports,fetch);
  if(url.pathname.endsWith('/rpc.ts'))module.exports.connectHermes=options=>{rpc=options;return {close(){},request:async(method,params)=>{
   calls.push({method,params});if(method==='session.create')return {session_id:'runtime',stored_session_id:'stored',info:{cwd:'synthetic',desktop_contract:6}};
   if(method==='session.list')return {sessions:[{id:'id',title:'Synthetic',message_count:1}]};return {};
  }};};
  return module.exports;
 }
 const {useLiveChat}=load(new URL('../src/hooks/useLiveChat.ts',import.meta.url));
 const render=()=>{cursor=0;return useLiveChat();};
 async function connect(){render().setManagementToken('management-only');render().connectTo({port:1234,token:'upstream-only'});rpc.onState('ready');await settle();render().listSessions();await settle();assert.equal(render().phase,'ready');}
 t.after(()=>effects.forEach(fn=>fn?.()));
 return {render,connect,reads,calls,disconnect:()=>rpc.onState('closed')};
}
function resolveRead(read,text){read.resolve(new Response(JSON.stringify({sessionId:'id',messages:[{role:'user',text}],omitted:false})));}
test('production hook keeps RPC identity for capability and learning; history uses management credential',async t=>{
 const h=harness(t);await h.connect();
 const draft={cardId:'card',prompt:'synthetic prompt',fingerprint:'a'.repeat(64),port:1234,token:'upstream-only',epoch:h.render().connectionEpoch};
 assert.equal(h.render().submitCapability({...draft,port:0,token:'management-only'}),false);
 const learning={source:'synthetic',scope:'synthetic',prompt:'synthetic',fingerprint:'a'.repeat(64),port:1234,token:'upstream-only'};
 h.render().acceptLearnDraft(learning);assert.deepEqual(h.render().learnDraft,learning);
 h.render().viewTranscript('id');assert.equal(h.reads[0].options.headers.Authorization,'Bearer management-only');resolveRead(h.reads[0],'safe');await settle();
 assert.equal(h.render().submitCapability(draft),true);assert.equal(h.calls.filter(c=>c.method==='prompt.submit').length,1);
});
for(const oldResult of ['success','error'])test(`production hook ignores late ${oldResult} after close while newer read remains loading`,async t=>{
 const h=harness(t);await h.connect();h.render().viewTranscript('id');const old=h.reads[0];
 h.render().hideTranscript();h.render().viewTranscript('id');assert.equal(h.reads.length,2);
 if(oldResult==='success')resolveRead(old,'stale');else old.reject(new Error('synthetic'));
 await settle();assert.equal(h.render().transcript,null);assert.equal(h.render().transcriptError,null);assert.equal(h.render().transcriptLoading,true);
 resolveRead(h.reads[1],'new');await settle();assert.equal(h.render().transcript.messages[0].text,'new');assert.equal(h.render().transcriptLoading,false);
});
test('production hook isolates reconnect generation and clears displayed history on socket loss',async t=>{
 const h=harness(t);await h.connect();h.render().viewTranscript('id');const old=h.reads[0];h.disconnect();await h.connect();h.render().viewTranscript('id');
 old.reject(new Error('late'));await settle();assert.equal(h.render().transcriptError,null);assert.equal(h.render().transcriptLoading,true);
 resolveRead(h.reads[1],'fresh');await settle();assert.equal(h.render().transcript.messages[0].text,'fresh');h.disconnect();assert.equal(h.render().transcript,null);
});
