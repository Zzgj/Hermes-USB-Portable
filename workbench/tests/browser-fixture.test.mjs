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
  ['/api/capabilities/prepare',{headers:auth,method:'POST'},404],
 ])assert.equal((await w.fetch(url,options)).status,status);
 const response=await w.fetch('/api/capabilities/catalog',{headers:auth});
 assert.equal(response.status,200);
 assert.equal((await response.json()).cards[0].state,'draft');
});
test('browser fixture respects aborted requests including Request objects',async()=>{
 const w=fixture(),controller=new AbortController();controller.abort();
 await assert.rejects(w.fetch('/api/capabilities/catalog',{headers:auth,signal:controller.signal}),{name:'AbortError'});
 const request=new Request('http://127.0.0.1:4173/api/capabilities/catalog',{headers:auth});
 assert.equal((await w.fetch(request)).status,200);
});
