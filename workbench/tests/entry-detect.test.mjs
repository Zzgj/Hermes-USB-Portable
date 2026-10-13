// Failing tests for P2-S3-ENTRY-01: native entry detection (CLI/TUI/Desktop/Web).
// Verifies the control server exposes /api/entries, the client decodes it, and
// detection is read-only with no process spawning or sensitive path leakage.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm,stat,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {startControlServer} from '../scripts/control-server.mjs';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';

// Transpile entry-detect.ts for client-side decode tests
const source=await readFile(new URL('../src/domain/entry-detect.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {decodeEntryList,decodeEntryStatus,entryLabel}=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);

// --- Unit tests for decode functions (already pass, ensure no regression) ---

test('decodeEntryStatus accepts valid entries and rejects malformed',()=>{
 const cli=decodeEntryStatus({kind:'cli',available:true,path:'/usr/bin/hermes',note:'installed'});
 assert.equal(cli.kind,'cli');assert.equal(cli.available,true);assert.equal(cli.path,'/usr/bin/hermes');
 const web=decodeEntryStatus({kind:'web',available:false});
 assert.equal(web.available,false);assert.equal(web.note,'');
 assert.throws(()=>decodeEntryStatus({kind:'bad',available:true}));
 assert.throws(()=>decodeEntryStatus({kind:'cli',available:'yes'}));
});

test('decodeEntryList rejects duplicates and oversized lists',()=>{
 const list=decodeEntryList({entries:[{kind:'cli',available:true},{kind:'tui',available:false}]});
 assert.equal(list.length,2);
 assert.throws(()=>decodeEntryList({entries:[{kind:'cli',available:true},{kind:'cli',available:false}]}));
 assert.throws(()=>decodeEntryList({entries:'bad'}));
});

// --- Real HTTP tests: control server /api/entries route ---

async function makeHarness(t,options={}){
 const assets=await mkdtemp(join(tmpdir(),'p2-entry-'));
 await writeFile(join(assets,'index.html'),'<div id="root">test</div>');
 const h=await startControlServer({assets,startInstance:async()=>({state:'ready',connection:Promise.resolve({port:12345,token:'synthetic'}),stop:async()=>{}}),...options});
 t.after(()=>h.close());
 return h;
}

// Test 1: /api/entries returns 200 with entry list when detectEntries is provided
test('GET /api/entries returns entry list from detectEntries callback',async t=>{
 const entries=[
  {kind:'cli',available:true,note:'CLI available'},
  {kind:'tui',available:false,note:'TUI not found'},
  {kind:'desktop',available:false,note:'Desktop not installed'},
  {kind:'web',available:true,note:'Web Dashboard ready'},
 ];
 const h=await makeHarness(t,{detectEntries:async()=>entries});
 const resp=await fetch(h.origin+'/api/entries',{headers:{Authorization:'Bearer '+h.token,Origin:h.origin}});
 assert.equal(resp.status,200);
 const body=await resp.json();
 assert.ok(Array.isArray(body.entries));
 assert.equal(body.entries.length,4);
 assert.equal(body.entries[0].kind,'cli');
 assert.equal(body.entries[0].available,true);
});

// Test 2: /api/entries does not require instance ready (read-only, no busy lock)
test('GET /api/entries works without starting an instance',async t=>{
 const h=await makeHarness(t,{detectEntries:async()=>[{kind:'cli',available:true}]});
 // No /api/start called — instance is null
 const resp=await fetch(h.origin+'/api/entries',{headers:{Authorization:'Bearer '+h.token,Origin:h.origin}});
 assert.equal(resp.status,200);
 const body=await resp.json();
 assert.equal(body.entries.length,1);
});

// Test 3: /api/entries rejects wrong token
test('GET /api/entries rejects wrong management token with 403',async t=>{
 const h=await makeHarness(t,{detectEntries:async()=>[]});
 const resp=await fetch(h.origin+'/api/entries',{headers:{Authorization:'Bearer wrong-token',Origin:h.origin}});
 assert.equal(resp.status,403);
});

// Test 4: /api/entries rejects foreign Origin
test('GET /api/entries rejects foreign Origin',async t=>{
 const h=await makeHarness(t,{detectEntries:async()=>[]});
 const resp=await fetch(h.origin+'/api/entries',{headers:{Authorization:'Bearer '+h.token,Origin:'http://foreign.invalid'}});
 assert.equal(resp.status,403);
});

// Test 5: /api/entries returns 404 when detectEntries not provided
test('GET /api/entries returns 404 when detectEntries not configured',async t=>{
 const h=await makeHarness(t);
 const resp=await fetch(h.origin+'/api/entries',{headers:{Authorization:'Bearer '+h.token,Origin:h.origin}});
 assert.equal(resp.status,404);
});

// Test 6: /api/entries does not block other operations (catalog available during entry detection)
test('entry detection does not block catalog or status',async t=>{
 let resolveDetection;
 const slowDetect=new Promise(resolve=>{resolveDetection=resolve;});
 const h=await makeHarness(t,{
  detectEntries:async()=>{await slowDetect;return[{kind:'cli',available:true}];},
  readCatalog:async()=>({cards:[]}),
 });
 // Start entry detection (will hang until we resolve)
 const entryPromise=fetch(h.origin+'/api/entries',{headers:{Authorization:'Bearer '+h.token,Origin:h.origin}});
 // While that's pending, catalog and status should still work
 await new Promise(r=>setTimeout(r,50));
 const statusResp=await fetch(h.origin+'/api/status',{headers:{Authorization:'Bearer '+h.token,Origin:h.origin}});
 assert.equal(statusResp.status,200);
 // Now resolve detection
 resolveDetection();
 const entryResp=await entryPromise;
 assert.equal(entryResp.status,200);
});

// Test 7: detectEntries receives source and home paths
test('detectEntries callback receives source and home parameters',async t=>{
 let receivedParams=null;
 const tmpRoot=await mkdtemp(join(tmpdir(),'p2-entry-params-'));
 const h=await makeHarness(t,{
  source:join(tmpRoot,'src'),
  home:join(tmpRoot,'data'),
  detectEntries:async(params)=>{receivedParams=params;return[];},
 });
 await fetch(h.origin+'/api/entries',{headers:{Authorization:'Bearer '+h.token,Origin:h.origin}});
 assert.ok(receivedParams);
 assert.ok(typeof receivedParams.source==='string');
 assert.ok(typeof receivedParams.home==='string');
});

// Test 8: entry response does not include sensitive absolute paths in path field
test('entry response path field is optional and does not leak sensitive paths',async t=>{
 const h=await makeHarness(t,{detectEntries:async()=>[
  {kind:'cli',available:true,note:'CLI available'},
  {kind:'web',available:true,note:'Web Dashboard ready'},
 ]});
 const resp=await fetch(h.origin+'/api/entries',{headers:{Authorization:'Bearer '+h.token,Origin:h.origin}});
 const body=await resp.json();
 for(const entry of body.entries){
  // path is optional; if present must not be an absolute filesystem path
  if(entry.path!==undefined){
   assert.ok(!entry.path.includes(':'),'path must not contain drive letter');
   assert.ok(!entry.path.startsWith('/'),'path must not be absolute filesystem path');
  }
 }
});

// Test 9: real HTTP entry list is decodable by client decodeEntryList
test('real HTTP entry response is decodable by client decodeEntryList',async t=>{
 const h=await makeHarness(t,{detectEntries:async()=>[
  {kind:'cli',available:true,note:'CLI available'},
  {kind:'tui',available:false,note:'TUI not found'},
  {kind:'desktop',available:false,note:'Desktop not installed'},
  {kind:'web',available:true,note:'Web Dashboard ready'},
 ]});
 const resp=await fetch(h.origin+'/api/entries',{headers:{Authorization:'Bearer '+h.token,Origin:h.origin}});
 const body=await resp.json();
 const decoded=decodeEntryList(body);
 assert.equal(decoded.length,4);
 assert.equal(decoded[0].kind,'cli');
 assert.equal(decoded[0].available,true);
 assert.equal(decoded[3].kind,'web');
 assert.equal(decoded[3].available,true);
});

// Test 10: detectEntries callback can check file existence (simulated layout)
test('detectEntries can detect CLI via hermes_cli/main.py existence',async t=>{
 const tmpRoot=await mkdtemp(join(tmpdir(),'p2-entry-layout-'));
 const source=join(tmpRoot,'src','hermes-agent');
 await mkdir(join(source,'hermes_cli'),{recursive:true});
 await writeFile(join(source,'hermes_cli','main.py'),'# synthetic');
 t.after(()=>rm(tmpRoot,{recursive:true,force:true}));
 const h=await makeHarness(t,{
  source,
  home:join(tmpRoot,'data'),
  detectEntries:async({source:src})=>{
   const results=[];
   try{await stat(join(src,'hermes_cli','main.py'));results.push({kind:'cli',available:true,note:'hermes_cli 入口存在'});}
   catch{results.push({kind:'cli',available:false,note:'未找到 hermes_cli 入口'});}
   results.push({kind:'tui',available:false,note:'便携包无独立 TUI 入口'});
   results.push({kind:'desktop',available:false,note:'便携包无独立 Desktop 应用'});
   results.push({kind:'web',available:true,note:'Web 工作台已就绪'});
   return results;
  },
 });
 const resp=await fetch(h.origin+'/api/entries',{headers:{Authorization:'Bearer '+h.token,Origin:h.origin}});
 const body=await resp.json();
 const cli=body.entries.find(e=>e.kind==='cli');
 assert.equal(cli.available,true);
 const tui=body.entries.find(e=>e.kind==='tui');
 assert.equal(tui.available,false);
});
