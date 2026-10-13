// Failing tests for P2-S1-HISTORY-01: transcript view lifecycle bugs.
// Tests readTranscript error handling and decodeTranscript edge cases
// that the existing session-history.test.mjs does not cover.
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
const source=await readFile(new URL('../src/domain/session-history.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {decodeTranscript,readTranscript}=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
// Test 1: readTranscript should distinguish HTTP rejection from invalid data
test('readTranscript returns HISTORY_FORBIDDEN for HTTP 403',async()=>{
  let calls=0;
  await assert.rejects(()=>readTranscript({port:0,token:'test-token'},'valid-id_1',new AbortController().signal,async()=>{
    calls++;return new Response(JSON.stringify({error:'forbidden'}),{status:403});
  }),(error)=>{
    assert.equal(error.message,'HISTORY_FORBIDDEN');
    return true;
  });
  assert.equal(calls,1);
});
// Test 2: readTranscript should distinguish timeout/abort from HTTP failure
test('readTranscript returns HISTORY_ABORTED for fetch-level abort',async()=>{
  const controller=new AbortController();
  setTimeout(()=>controller.abort(),10);
  await assert.rejects(()=>readTranscript({port:0,token:'test-token'},'valid-id_2',controller.signal,async(url,opts)=>{
    return new Promise((_,reject)=>{opts.signal.addEventListener('abort',()=>reject(new DOMException('aborted','AbortError')));});
  }),(error)=>{
    assert.equal(error.message,'HISTORY_ABORTED');
    return true;
  });
});
// Test 3: readTranscript should distinguish invalid JSON from HTTP failure
test('readTranscript returns HISTORY_INVALID for non-JSON response',async()=>{
  await assert.rejects(()=>readTranscript({port:0,token:'test-token'},'valid-id_3',new AbortController().signal,async()=>{
    return new Response('not json at all',{status:200,headers:{'Content-Type':'text/plain'}});
  }),(error)=>{
    assert.equal(error.message,'HISTORY_INVALID');
    return true;
  });
});
// Test 4: readTranscript error should not expose response body but should preserve error category
test('readTranscript 401 error does not expose response body and returns HISTORY_FORBIDDEN',async()=>{
  await assert.rejects(()=>readTranscript({port:0,token:'test-token'},'valid-id_5',new AbortController().signal,async()=>{
    return new Response(JSON.stringify({detail:'authentication failed',secret_key:'leaked'}),{status:401});
  }),(error)=>{
    assert.ok(!error.message.includes('leaked'),'Error must not expose response body');
    assert.ok(!error.message.includes('authentication failed'),'Error must not expose response detail');
    assert.equal(error.message,'HISTORY_FORBIDDEN');
    return true;
  });
});
// Test 5: readTranscript should handle empty response body gracefully
test('readTranscript returns HISTORY_EMPTY for zero-length response body',async()=>{
  await assert.rejects(()=>readTranscript({port:0,token:'test-token'},'valid-id_6',new AbortController().signal,async()=>{
    return new Response('',{status:200});
  }),(error)=>{
    assert.equal(error.message,'HISTORY_EMPTY');
    return true;
  });
});
// Test 6: readTranscript should classify stream read abort as HISTORY_ABORTED
test('readTranscript returns HISTORY_ABORTED when stream read is aborted mid-body',async()=>{
  const controller=new AbortController();
  await assert.rejects(()=>readTranscript({port:0,token:'test-token'},'valid-id_7',controller.signal,async()=>{
    const body=new ReadableStream({start(controller_){controller_.enqueue(new Uint8Array([123]));setTimeout(()=>{controller_.error(new DOMException('aborted','AbortError'));},5);}});
    return new Response(body,{status:200,headers:{'Content-Type':'application/json'}});
  }),(error)=>{
    assert.equal(error.message,'HISTORY_ABORTED');
    return true;
  });
});
// Test 7: readTranscript should classify stream network error as HISTORY_NETWORK
test('readTranscript returns HISTORY_NETWORK for stream read network error',async()=>{
  await assert.rejects(()=>readTranscript({port:0,token:'test-token'},'valid-id_8',new AbortController().signal,async()=>{
    const body=new ReadableStream({start(controller_){controller_.error(new Error('connection reset'));}});
    return new Response(body,{status:200,headers:{'Content-Type':'application/json'}});
  }),(error)=>{
    assert.equal(error.message,'HISTORY_NETWORK');
    return true;
  });
});
// Test 8: readTranscript should classify non-403 HTTP error as HISTORY_HTTP_ERROR
test('readTranscript returns HISTORY_HTTP_ERROR for HTTP 500',async()=>{
  await assert.rejects(()=>readTranscript({port:0,token:'test-token'},'valid-id_9',new AbortController().signal,async()=>{
    return new Response('internal server error',{status:500});
  }),(error)=>{
    assert.equal(error.message,'HISTORY_HTTP_ERROR');
    return true;
  });
});
