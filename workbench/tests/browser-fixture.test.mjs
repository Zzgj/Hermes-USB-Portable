import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
const source=await readFile(new URL('./browser-rpc-fixture.js',import.meta.url),'utf8');
function fixture(){
 const window={location:{origin:'http://127.0.0.1:4173'}};
 runInNewContext(source,{window,Response,Request,Headers,URL,DOMException,EventTarget,MessageEvent,setTimeout});
 return window;
}
const auth={Authorization:'Bearer fixture-manager-token'};
test('browser fixture rejects wrong service, missing auth, methods and unknown endpoints',async()=>{
 const w=fixture();
 for(const [url,options,status] of [
  ['/api/capabilities/catalog',{},403],
  ['http://127.0.0.1:9119/api/capabilities/catalog',{headers:auth},403],
  ['http://wrong-host.invalid/api/capabilities/catalog',{method:'DELETE'},403],
  ['/api/capabilities/catalog',{headers:auth,method:'DELETE'},405],
  ['/api/capabilities/catalog?extra=1',{headers:auth},404],
  ['/api/capabilities/evidence',{headers:auth},404],
  ['/api/capabilities/prepare',{headers:auth},405],  // GET on POST-only prepare endpoint
 ])assert.equal((await w.fetch(url,options)).status,status);
 const response=await w.fetch('/api/capabilities/catalog',{headers:auth});
 assert.equal(response.status,200);
 assert.equal((await response.json()).cards[0].state,'draft');
});
test('browser fixture prepare endpoint returns capability and connection with correct auth',async()=>{
  const w=fixture();
  const auth={Authorization:'Bearer fixture-manager-token'};
  // Wrong auth rejected
  assert.equal((await w.fetch('/api/capabilities/prepare',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({card:{id:'x'},values:{}})})).status,403);
  // Wrong method rejected
  assert.equal((await w.fetch('/api/capabilities/prepare',{headers:auth,method:'DELETE'})).status,405);
  // Correct auth + body returns prepared capability
  const resp=await w.fetch('/api/capabilities/prepare',{method:'POST',headers:{...auth,'Content-Type':'application/json'},body:JSON.stringify({card:{id:'fixture-card',name:'Fixture',goal:'Test',method:{kind:'skill',name:'fixture-skill',fingerprint:'a'.repeat(64)},inputs:[{id:'source',label:'Source',required:true}],state:'draft'},values:{source:'test'}})});
  assert.equal(resp.status,200);
  const result=await resp.json();
  assert.equal(result.prepared.kind,'capability');
  assert.equal(result.prepared.cardId,'fixture-card');
  assert.equal(result.prepared.availability,'unknown');
  assert.equal(result.prepared.method.name,'fixture-skill');
  assert.equal(result.connection.port,12345);
  assert.equal(result.connection.token,'fixture-rpc-token');
  // RPC token differs from management token
  assert.notEqual(result.connection.token,'fixture-manager-token');
  // Prepare does not include any submission indicator
  assert.equal(result.prepared.submitted,undefined);
});
test('browser fixture tracks fetch request counts for prepare and catalog separately',async()=>{
  const w=fixture();
  const auth={Authorization:'Bearer fixture-manager-token'};
  // Before any requests
  assert.equal(w.__p2FetchRequests.length,0);
  // Catalog call
  await w.fetch('/api/capabilities/catalog',{headers:auth});
  assert.equal(w.__p2FetchRequests.length,1);
  assert.equal(w.__p2FetchRequests[0].url,'http://127.0.0.1:4173/api/capabilities/catalog');
  // Prepare call
  await w.fetch('/api/capabilities/prepare',{method:'POST',headers:{...auth,'Content-Type':'application/json'},body:JSON.stringify({card:{id:'fixture-card'},values:{}})});
  assert.equal(w.__p2FetchRequests.length,2);
  assert.equal(w.__p2FetchRequests[1].url,'http://127.0.0.1:4173/api/capabilities/prepare');
  assert.equal(w.__p2FetchRequests[1].method,'POST');
});
test('browser fixture prepare does not trigger any prompt.submit RPC',async()=>{
  const w=fixture();
  const auth={Authorization:'Bearer fixture-manager-token'};
  // Prepare via fetch
  await w.fetch('/api/capabilities/prepare',{method:'POST',headers:{...auth,'Content-Type':'application/json'},body:JSON.stringify({card:{id:'fixture-card'},values:{}})});
  // No WebSocket RPC requests should have been made (no WS connection established yet)
  assert.equal(w.__p2RpcRequests.length,0);
});
test('browser fixture RPC tracks prompt.submit count for duplicate submit detection',async()=>{
  const w=fixture();
  // Simulate WebSocket connection and two prompt.submit calls
  const ws=new w.WebSocket();
  // Wait for gateway.ready
  await new Promise(r=>setTimeout(r,20));
  // Send prompt.submit twice
  ws.send(JSON.stringify({jsonrpc:'2.0',id:1,method:'prompt.submit',params:{session_id:'p2-browser',text:'test'}}));
  ws.send(JSON.stringify({jsonrpc:'2.0',id:2,method:'prompt.submit',params:{session_id:'p2-browser',text:'test'}}));
  // Count prompt.submit calls
  const submits=w.__p2RpcRequests.filter(r=>r.method==='prompt.submit');
  assert.equal(submits.length,2);
  // Each has a unique id
  assert.notEqual(submits[0].id,submits[1].id);
  // Wait for completion
  await new Promise(r=>setTimeout(r,100));
});
test('browser fixture respects aborted requests including Request objects',async()=>{
  const w=fixture(),controller=new AbortController();controller.abort();
 await assert.rejects(w.fetch('/api/capabilities/catalog',{headers:auth,signal:controller.signal}),{name:'AbortError'});
 const request=new Request('http://127.0.0.1:4173/api/capabilities/catalog',{headers:auth});
 assert.equal((await w.fetch(request)).status,200);
});
