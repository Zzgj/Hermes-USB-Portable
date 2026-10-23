import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {probeNativeDashboardPage} from '../scripts/native-dashboard-health.mjs';
import {createNativeEntryAdapters,NATIVE_BASELINE} from '../scripts/native-entry-adapters.mjs';
import {packageFiles} from '../scripts/package-policy.mjs';
const token='synthetic-dashboard-token-123456789';
function html(identity=token){
 return '<!doctype html><html><head><script type="module" crossorigin src="/assets/entry-test.js"></script>'+
  '<link rel="stylesheet" href="/assets/entry-test.css">'+
  '<script>window.__HERMES_SESSION_TOKEN__="'+identity+'";window.__HERMES_DASHBOARD_EMBEDDED_CHAT__=true;'+
  'window.__HERMES_BASE_PATH__="";window.__HERMES_AUTH_REQUIRED__=false;</script></head><body><div id="root"></div></body></html>';
}
async function server(t,handler){
 const requests=[];
 const owned=createServer((req,res)=>{
  requests.push({path:req.url,method:req.method,authorization:req.headers.authorization,cookie:req.headers.cookie});
  handler(req,res);
 });
 owned.listen(0,'127.0.0.1');await once(owned,'listening');
 t.after(async()=>{owned.closeAllConnections();await new Promise((resolve,reject)=>owned.close(e=>e?reject(e):resolve()));});
 return {port:owned.address().port,requests};
}
function asset(req,res){
 // The pinned server declares the CSS route as GET; HEAD is not its contract.
 if(req.method!=='GET'){res.writeHead(405);res.end();return;}
 res.writeHead(200,{'Content-Type':req.url.endsWith('.css')?'text/css':'application/javascript'});res.end('/* synthetic asset, never executed */');
}

test('real loopback checks the matching page and entry assets without sending credentials',async t=>{
 const f=await server(t,(req,res)=>{
  if(req.url==='/'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(html());}else asset(req,res);
 });
 assert.equal(await probeNativeDashboardPage({...f,token}),true);
 assert.deepEqual(f.requests.map(r=>[r.method,r.path]),[['GET','/'],['GET','/assets/entry-test.js'],['GET','/assets/entry-test.css']]);
 assert.ok(f.requests.every(r=>!r.authorization&&!r.cookie&&!r.path.includes(token)));
 assert.ok(packageFiles.includes('workbench/scripts/native-dashboard-health.mjs'));
});

test('headless, wrong identity, unavailable frontend and redirect are not Dashboard readiness',async t=>{
 const cases=[{body:'<script>window.__HERMES_SESSION_TOKEN__="'+token+'";</script>Headless backend'},
  {body:html('different-synthetic-token')},{body:html().replace('id="root"','id="not-root"')},
  {body:html().replace('/assets/entry-test.js','/src/main.tsx')},{status:404,body:'Frontend not built'},
  {status:302,location:'/must-not-follow',body:''},{type:'application/json',body:html()}];
 for(const scenario of cases){
  const f=await server(t,(req,res)=>{res.writeHead(scenario.status??200,{'Content-Type':scenario.type??'text/html',...(scenario.location?{Location:scenario.location}:{})});res.end(scenario.body);});
  assert.equal(await probeNativeDashboardPage({...f,token}),false);
  assert.deepEqual(f.requests.map(r=>r.path),['/']);
 }
});

test('missing or HTML-fallback entry assets refuse a browser-open readiness claim',async t=>{
 for(const status of [404,200]){
  const f=await server(t,(req,res)=>{
   if(req.url==='/'){res.writeHead(200,{'Content-Type':'text/html'});res.end(html());}
   else{res.writeHead(status,{'Content-Type':'text/html'});res.end();}
  });
  assert.equal(await probeNativeDashboardPage({...f,token}),false);
 }
});

test('page cannot cause external, encoded or traversing resource requests',async t=>{
 for(const path of ['https://invalid.example/asset.js','//invalid.example/asset.js','/assets/../secret.js','/assets/%2e%2e/secret.js','/assets/a.js?token=secret']){
  const f=await server(t,(req,res)=>{res.writeHead(200,{'Content-Type':'text/html'});res.end(html().replace('/assets/entry-test.js',path));});
  assert.equal(await probeNativeDashboardPage({...f,token}),false);
  assert.deepEqual(f.requests.map(r=>r.path),['/']);
 }
});

test('deadline covers a body stalled after successful response headers',async t=>{
 let received=false;
 const f=await server(t,(_req,res)=>{received=true;res.writeHead(200,{'Content-Type':'text/html'});res.flushHeaders();res.write('<html>');});
 assert.equal(await probeNativeDashboardPage({...f,token,timeoutMs:500}),false);
 assert.equal(received,true);
});

test('explicit cancellation after the request starts prevents success and later asset requests',async t=>{
 const controller=new AbortController();
 const f=await server(t,(_req,res)=>{res.writeHead(200,{'Content-Type':'text/html'});res.flushHeaders();controller.abort();});
 assert.equal(await probeNativeDashboardPage({...f,token,signal:controller.signal}),false);
 assert.deepEqual(f.requests.map(r=>r.path),['/']);
});

test('the same deadline covers an entry asset body stalled after valid headers',async t=>{
 let assetRequested=false;
 const f=await server(t,(req,res)=>{
  if(req.url==='/'){res.writeHead(200,{'Content-Type':'text/html'});res.end(html());}
  else{assetRequested=true;res.writeHead(200,{'Content-Type':'application/javascript'});res.flushHeaders();res.write('/* partial');}
 });
 assert.equal(await probeNativeDashboardPage({...f,token,timeoutMs:500}),false);assert.equal(assetRequested,true);
});

test('oversized streamed body and invalid UTF-8 fail closed',async t=>{
 for(const body of [Buffer.alloc(2*1024*1024+1,65),Buffer.from([0xff,0xfe,0xff])]){
  const f=await server(t,(_req,res)=>{res.writeHead(200,{'Content-Type':'text/html'});res.end(body);});
  assert.equal(await probeNativeDashboardPage({...f,token}),false);
 }
});

test('empty JavaScript and oversized entry resources fail without downloading the next asset',async t=>{
 for(const oversized of [false,true]){
  const f=await server(t,(req,res)=>{
   if(req.url==='/'){res.writeHead(200,{'Content-Type':'text/html'});res.end(html());}
   else{
    res.writeHead(200,{'Content-Type':'application/javascript',...(oversized?{'Content-Length':String(16*1024*1024+1)}:{})});
    if(oversized)res.flushHeaders();else res.end();
   }
  });
  assert.equal(await probeNativeDashboardPage({...f,token}),false);
  assert.deepEqual(f.requests.map(r=>r.path),['/','/assets/entry-test.js']);
 }
});

test('production Dashboard adapter reaches real HTTP page checks before opening the owned URL',async t=>{
 const root=await mkdtemp(join(tmpdir(),'dashboard-adapter-http-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const source=join(root,'source'),home=join(root,'home'),python=join(root,'python');
 await mkdir(join(source,'hermes_cli','web_dist'),{recursive:true});await mkdir(home);
 await writeFile(join(source,'hermes_cli','main.py'),'synthetic');await writeFile(join(source,'hermes_cli','web_dist','index.html'),'synthetic');await writeFile(python,'synthetic');
 let launch,finish,ready,pageAvailable=true;const opened=[];
 const f=await server(t,(req,res)=>{
  if(req.url==='/'){res.writeHead(pageAvailable?200:404,{'Content-Type':'text/html'});res.end(html(launch.environment.HERMES_DASHBOARD_SESSION_TOKEN));}
  else asset(req,res);
 });
 const adapters=createNativeEntryAdapters({python,source,environment:{},openBrowser:async url=>opened.push(url)}, {
  platform:'win32',inspect:()=>({commit:NATIVE_BASELINE,tracked_changes:false}),probe:async()=>true,
  start:options=>{launch=options;return {ready:new Promise(r=>{ready=r;}),closed:new Promise(r=>{finish=r;}),stop:async()=>finish({treeExited:true})};},
 });
 const child=(await adapters.dashboard.prepare({home})).start();
 assert.equal(await launch.probe(f.port,new AbortController().signal),true);
 ready({port:f.port});await child.ready;await child.open();
 assert.deepEqual(opened,[`http://127.0.0.1:${f.port}/`]);
 pageAvailable=false;await assert.rejects(child.open(),/DASHBOARD_NOT_READY/);assert.equal(opened.length,1);
 finish({treeExited:true});await child.closed;
});
