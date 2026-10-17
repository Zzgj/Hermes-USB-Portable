import test from 'node:test';
import assert from 'node:assert/strict';
import {createNativeProcessProtocol} from '../scripts/native-process-protocol.mjs';

function fixture(){
 const events=[];
 const protocol=createNativeProcessProtocol(value=>events.push(value));
 return {protocol,events};
}
test('native host protocol accepts split frames, not business output',()=>{
 const {protocol,events}=fixture();
 protocol.push(Buffer.from('{"event":"sta'));
 protocol.push(Buffer.from('rted"}\n{"event":"port","port":12345}\n'));
 assert.deepEqual(events,[{event:'started'},{event:'port',port:12345}]);
 assert.equal(protocol.finish(0),false);
});
test('only a complete host tree confirmation plus clean host exit releases ownership',()=>{
 for(const code of [null,1,103]){
  const {protocol}=fixture();protocol.push(Buffer.from('{"event":"closed","treeExited":true}\n'));
  assert.equal(protocol.finish(code),false);
 }
 const {protocol}=fixture();protocol.push(Buffer.from('{"event":"closed","treeExited":true}\n'));
 assert.equal(protocol.finish(0),true);
});
test('invalid, truncated, duplicated and oversized protocol fails closed',()=>{
 for(const text of [
  '{"event":"closed","treeExited":true}',
  '{"event":"closed","treeExited":true}\nsecret\n',
  '{"event":"closed","treeExited":true}\n{"event":"started"}\n',
  '{"event":"port","port":0}\n',
  '{"event":"port","port":70000}\n',
  '{"event":"started","secret":"hidden"}\n',
  'x'.repeat(4097),
 ]){
  const {protocol}=fixture();
  try{protocol.push(Buffer.from(text));}catch{}
  assert.equal(protocol.finish(0),false);
 }
});
test('host failure reports no raw diagnostic and cannot become ready later',()=>{
 const {protocol,events}=fixture();
 protocol.push(Buffer.from('{"event":"failed"}\n{"event":"closed","treeExited":true}\n'));
 assert.deepEqual(events,[{event:'failed'},{event:'closed',treeExited:true}]);
 assert.equal(protocol.finish(0),true);
 const second=fixture();
 second.protocol.push(Buffer.from('{"event":"failed"}\n'));
 assert.throws(()=>second.protocol.push(Buffer.from('{"event":"started"}\n')),/PROTOCOL/);
});

test('native direct exit code is preserved only in a valid completion frame',()=>{
 const {protocol,events}=fixture();
 protocol.push(Buffer.from('{"event":"closed","treeExited":true,"exitCode":42}\n'));
 assert.equal(protocol.finish(0),true);assert.equal(events[0].exitCode,42);
 for(const exitCode of [-1,0x100000000,'0',null]){
  const invalid=fixture();
  assert.throws(()=>invalid.protocol.push(Buffer.from(JSON.stringify({event:'closed',treeExited:true,exitCode})+'\n')),/PROTOCOL/);
  assert.equal(invalid.protocol.finish(0),false);
 }
});
