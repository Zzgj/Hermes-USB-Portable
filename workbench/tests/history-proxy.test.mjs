// Failing tests for P2-S1-HISTORY-02: management service proxy for transcript reading.
// Verifies that the control server proxies /api/sessions/:id/messages to the Hermes backend,
// with proper auth isolation, size limits, and error handling.
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
const source=await readFile(new URL('../src/domain/session-history.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {readTranscript}=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
// Test 1: readTranscript uses same-origin management endpoint, not direct Hermes port
test('readTranscript requests same-origin /api/sessions/:id/messages via management token',async()=>{
  let calledUrl=null,calledAuth=null;
  const result=await readTranscript({port:0,token:'mgmt-token'},'test-id_1',new AbortController().signal,async(url,opts)=>{
    calledUrl=url;calledAuth=opts.headers.Authorization;
    return new Response(JSON.stringify({sessionId:'test-id_1',messages:[{role:'user',text:'hello'}],omitted:false}),{status:200,headers:{'Content-Type':'application/json'}});
  });
  // Should use relative same-origin URL, not http://127.0.0.1:{port}/...
  assert.ok(calledUrl.startsWith('/api/sessions/'),'URL should be same-origin relative path: '+calledUrl);
  assert.equal(calledAuth,'Bearer mgmt-token','should use management token');
  assert.equal(result.messages.length,1);
  assert.equal(result.messages[0].text,'hello');
});
// Test 2: readTranscript with port=0 means "use same-origin management service"
test('readTranscript with port 0 uses relative URL (same-origin management proxy)',async()=>{
  let calledUrl=null;
  await readTranscript({port:0,token:'mgmt-token'},'test-id_2',new AbortController().signal,async(url)=>{
    calledUrl=url;
    return new Response(JSON.stringify({sessionId:'test-id_2',messages:[],omitted:false}),{status:200});
  });
  assert.ok(!calledUrl.includes('127.0.0.1'),'should not include host when port=0: '+calledUrl);
  assert.ok(calledUrl.startsWith('/api/sessions/'),'should be relative path');
});
// Test 3: readTranscript still rejects invalid session IDs
test('readTranscript rejects path traversal in session ID via proxy',async()=>{
  for(const id of ['..','../config','a/b','%2e%2e','bad\n']){
    await assert.rejects(()=>readTranscript({port:0,token:'mgmt-token'},id,new AbortController().signal,async()=>{throw new Error('must not request');}),/^Error: HISTORY_INVALID$/);
  }
});
// Test 4: readTranscript returns HISTORY_FORBIDDEN when management proxy returns 403
test('readTranscript returns HISTORY_FORBIDDEN for proxy 403',async()=>{
  await assert.rejects(()=>readTranscript({port:0,token:'mgmt-token'},'valid-id_4',new AbortController().signal,async()=>{
    return new Response('forbidden',{status:403});
  }),(error)=>{assert.equal(error.message,'HISTORY_FORBIDDEN');return true;});
});
// Test 5: readTranscript returns HISTORY_HTTP_ERROR for proxy 500
test('readTranscript returns HISTORY_HTTP_ERROR for proxy 500',async()=>{
  await assert.rejects(()=>readTranscript({port:0,token:'mgmt-token'},'valid-id_5',new AbortController().signal,async()=>{
    return new Response('error',{status:500});
  }),(error)=>{assert.equal(error.message,'HISTORY_HTTP_ERROR');return true;});
});
// Test 6: readTranscript returns HISTORY_EMPTY for proxy empty body
test('readTranscript returns HISTORY_EMPTY for proxy empty response',async()=>{
  await assert.rejects(()=>readTranscript({port:0,token:'mgmt-token'},'valid-id_6',new AbortController().signal,async()=>{
    return new Response('',{status:200});
  }),(error)=>{assert.equal(error.message,'HISTORY_EMPTY');return true;});
});
