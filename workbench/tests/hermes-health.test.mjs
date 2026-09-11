import test from 'node:test';
import assert from 'node:assert/strict';
import {probeHermes} from '../scripts/hermes-health.mjs';
class Socket extends EventTarget {
 closed=false;sent=[];
 send(raw){this.sent.push(JSON.parse(raw));}
 close(){this.closed=true;}
 frame(value){this.dispatchEvent(new MessageEvent('message',{data:JSON.stringify(value)}));}
}
const token='test-token-not-real-123';
test('probe requires ready and matching unknown-method response, then closes',async()=>{
 const socket=new Socket();let endpoint;
 const pending=probeHermes({port:12345,token,createSocket:url=>{endpoint=url;return socket;}});
 socket.dispatchEvent(new Event('open'));assert.equal(socket.sent.length,0);
 socket.frame({jsonrpc:'2.0',method:'event',params:{type:'gateway.ready'}});
 assert.equal(socket.sent[0].method,'p2.health.unsupported');
 assert.equal(new URL(endpoint).hostname,'127.0.0.1');assert.equal(new URL(endpoint).searchParams.get('token'),token);
 socket.frame({jsonrpc:'2.0',id:'p2-health',error:{code:-32601,message:'unused'}});
 assert.equal(await pending,true);assert.equal(socket.closed,true);
});
test('abort and timeout close unfinished socket',async()=>{
 const socket=new Socket(),controller=new AbortController();
 const pending=probeHermes({port:12345,token,signal:controller.signal,createSocket:()=>socket});
 controller.abort();assert.equal(await pending,false);assert.equal(socket.closed,true);
 const timed=new Socket();assert.equal(await probeHermes({port:12345,token,timeoutMs:5,createSocket:()=>timed}),false);assert.equal(timed.closed,true);
});
test('malformed frames and unexpected result fail without raw error output',async()=>{
 for(const frame of [null,{jsonrpc:'2.0',id:'p2-health',result:true}]){
  const socket=new Socket(),pending=probeHermes({port:12345,token,createSocket:()=>socket});socket.frame(frame);assert.equal(await pending,false);
 }
});
test('invalid options never open a socket',async()=>{
 let opened=false;assert.equal(await probeHermes({port:0,token,createSocket:()=>{opened=true;}}),false);assert.equal(opened,false);
});
