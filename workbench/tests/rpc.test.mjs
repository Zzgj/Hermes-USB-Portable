import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import test from 'node:test';
import ts from 'typescript';
const text=await readFile(new URL('../src/domain/rpc.ts',import.meta.url),'utf8');
const js=ts.transpileModule(text,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {decodeFrame,decodeMessage,encodeRequest,RpcChannel,decodeSession,decodeInterrupt,connectHermes}=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
test('coalesced events preserve order and session sequence',()=>{
 const event={jsonrpc:'2.0',method:'event',params:{type:'message.delta',session_id:'demo',seq:7,payload:{delta:'hello'}}};
 const frames=decodeFrame(JSON.stringify(event)+'\n'+JSON.stringify({jsonrpc:'2.0',id:'r1',result:{status:'streaming'}}));
 assert.equal(frames.length,2);assert.equal(frames[0].seq,7);assert.equal(frames[1].kind,'result');
});
test('ready event may omit session and sequence; errors are not success',()=>{
 assert.equal(decodeMessage({jsonrpc:'2.0',method:'event',params:{type:'gateway.ready',payload:{}}}).kind,'event');
 assert.equal(decodeMessage({jsonrpc:'2.0',id:null,error:{code:-32700,message:'Parse error'}}).kind,'error');
});
test('malformed envelopes and oversized frames fail closed',()=>{
 for(const value of [null,[],{jsonrpc:'1.0'},{jsonrpc:'2.0',id:'x',result:0,error:{}},{jsonrpc:'2.0',method:'event',params:{type:'x',seq:-1}}])assert.throws(()=>decodeMessage(value));
 assert.throws(()=>decodeFrame('{broken'));
 assert.throws(()=>decodeFrame('x'.repeat(1_048_577)));
});
test('outgoing request is exactly one JSON object',()=>{
 assert.deepEqual(JSON.parse(encodeRequest('r1','session.interrupt',{session_id:'demo'})),{jsonrpc:'2.0',id:'r1',method:'session.interrupt',params:{session_id:'demo'}});
});
test('channel matches out-of-order responses and routes events separately',async()=>{
 const sent=[],events=[];const channel=new RpcChannel(text=>sent.push(JSON.parse(text)),event=>events.push(event));
 const first=channel.request('one'),second=channel.request('two');
 channel.receive(JSON.stringify({jsonrpc:'2.0',id:sent[1].id,result:'second'}));
 channel.receive(JSON.stringify({jsonrpc:'2.0',method:'event',params:{type:'gateway.ready'}}));
 channel.receive(JSON.stringify({jsonrpc:'2.0',id:sent[0].id,result:'first'}));
 assert.deepEqual(await Promise.all([first,second]),['first','second']);
 assert.equal(events.length,1);assert.equal(channel.pendingCount,0);channel.close();
});
test('disconnect rejects every pending request and does not send again',async()=>{
 const sent=[];const channel=new RpcChannel(text=>sent.push(text),()=>{});
 const checks=[channel.request('one'),channel.request('two')].map(p=>assert.rejects(p,{reason:'disconnected'}));
 channel.close();await Promise.all(checks);
 await assert.rejects(channel.request('three'),{reason:'disconnected'});
 assert.equal(sent.length,2);assert.equal(channel.pendingCount,0);
});
test('timeout removes pending entry; late response does not complete next request',async()=>{
 const sent=[];const channel=new RpcChannel(text=>sent.push(JSON.parse(text)),()=>{});
 await assert.rejects(channel.request('slow',{},5),{reason:'timeout'});
 const next=channel.request('next');channel.receive(JSON.stringify({jsonrpc:'2.0',id:sent[0].id,result:'late'}));
 assert.equal(channel.pendingCount,1);
 channel.receive(JSON.stringify({jsonrpc:'2.0',id:sent[1].id,result:'ok'}));assert.equal(await next,'ok');channel.close();
});
test('malformed inbound frame closes channel; remote error text is not exposed',async()=>{
 let sent;const channel=new RpcChannel(text=>{sent=JSON.parse(text)},()=>{});
 const rejected=assert.rejects(channel.request('test'),error=>error.reason==='remote'&&!error.message.includes('secret'));
 channel.receive(JSON.stringify({jsonrpc:'2.0',id:sent.id,error:{code:42,message:'secret'}}));await rejected;
 const bad=assert.rejects(channel.request('test'),{reason:'protocol'});channel.receive('{broken');await bad;
 assert.equal(channel.isClosed,true);assert.equal(channel.pendingCount,0);
});
test('send failure and synchronous response both clean pending requests',async()=>{
 const broken=new RpcChannel(()=>{throw new Error('transport')},()=>{});
 await assert.rejects(broken.request('test'),{reason:'send'});assert.equal(broken.pendingCount,0);
 const sync=new RpcChannel(text=>sync.receive(JSON.stringify({jsonrpc:'2.0',id:JSON.parse(text).id,result:true})),()=>{});
 assert.equal(await sync.request('test'),true);assert.equal(sync.pendingCount,0);sync.close();
});
test('session decoder keeps runtime and durable identities separate',()=>{
 assert.deepEqual(decodeSession({session_id:'runtime',stored_session_id:'durable',info:{cwd:'/tmp/demo',desktop_contract:6}}),{runtimeId:'runtime',storedId:'durable',cwd:'/tmp/demo',contract:6});
 assert.throws(()=>decodeSession({session_id:'runtime',info:{desktop_contract:6}}));
});
test('interrupt acknowledgement is not proof of rollback or terminal completion',()=>{
 assert.equal(decodeInterrupt({status:'interrupted'}),'acknowledged');
 assert.equal(decodeInterrupt({status:'not_interrupted',interrupted:false}),'not-interrupted');
 assert.throws(()=>decodeInterrupt({status:'interrupted',interrupted:false}));
 assert.throws(()=>decodeInterrupt({closed:true}));
});
class FakeSocket extends EventTarget {
 sent=[];closes=0;
 send(text){this.sent.push(JSON.parse(text));}
 close(){this.closes++;}
 receive(value){this.dispatchEvent(new MessageEvent('message',{data:typeof value==='string'?value:JSON.stringify(value)}));}
 ready(){this.receive({jsonrpc:'2.0',method:'event',params:{type:'gateway.ready',payload:{}}});}
}
const connection=(socket,states=[],extra={})=>connectHermes({endpoint:'ws://127.0.0.1:9120/api/ws',createSocket:()=>socket,onState:s=>states.push(s),onEvent:()=>{},...extra});
test('socket open alone never enables requests; gateway.ready enables RPC',async()=>{
 const socket=new FakeSocket(),states=[];const client=connection(socket,states);
 socket.dispatchEvent(new Event('open'));
 await assert.rejects(client.request('test'),{reason:'disconnected'});assert.equal(socket.sent.length,0);
 socket.ready();const promise=client.request('test');
 socket.receive({jsonrpc:'2.0',id:socket.sent[0].id,result:42});assert.equal(await promise,42);
 client.close();assert.deepEqual(states,['connecting','ready','closed']);assert.equal(socket.closes,1);
});
test('transport disconnect rejects pending requests and ignores later events',async()=>{
 const socket=new FakeSocket(),states=[];const client=connection(socket,states);socket.ready();
 const rejected=assert.rejects(client.request('test'),{reason:'disconnected'});
 socket.dispatchEvent(new Event('close'));await rejected;socket.ready();client.close();
 assert.deepEqual(states,['connecting','ready','closed']);assert.equal(socket.sent.length,1);
});
test('malformed data and handshake timeout close their transport',async()=>{
 const socket=new FakeSocket();const client=connection(socket);socket.receive('invalid');
 assert.equal(client.state,'failed');assert.equal(socket.closes,1);
 const slow=new FakeSocket(),waiting=connection(slow,[],{timeoutMs:5});
 await new Promise(resolve=>setTimeout(resolve,15));assert.equal(waiting.state,'failed');assert.equal(slow.closes,1);
});
test('reject remote endpoints before opening a socket',()=>{
 for(const endpoint of ['ws://example.com/api/ws','ws://127.0.0.1/wrong','ws://user:pass@127.0.0.1/api/ws']){
  assert.throws(()=>connectHermes({endpoint,createSocket:()=>{assert.fail('must not create socket')},onState:()=>{},onEvent:()=>{}}));
 }
});
