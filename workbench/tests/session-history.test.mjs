import {readFile} from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
const source=await readFile(new URL('../src/domain/session-history.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {decodeTranscript,readTranscript}=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
test('history projects plain user/assistant content, excludes hidden and tool messages',()=>{
 const result=decodeTranscript({session_id:'resolved',messages:[{role:'user',content:'<script>literal</script>',secret:'drop'},{role:'tool',content:'private'},{role:'assistant',content:'hidden',display_kind:'hidden'},{role:'assistant',content:'scaffold',display_content:'display'},{role:'assistant',content:[]}],token:'drop'});
 assert.deepEqual(result,{sessionId:'resolved',messages:[{role:'user',text:'<script>literal</script>'},{role:'assistant',text:'display'}],omitted:true});
});
test('history bounds message count and displayed text',()=>{
 assert.throws(()=>decodeTranscript({session_id:'id',messages:Array(51).fill({})}));
 const result=decodeTranscript({session_id:'id',messages:Array(10).fill({role:'assistant',content:'x'.repeat(25000)})});
 assert.equal(result.messages.reduce((n,row)=>n+row.text.length,0),100000);assert.equal(result.omitted,true);
});
test('history request is GET with fixed paging, encoded identity, no cookie or query token',async()=>{
 const signal=new AbortController().signal;let calls=0;
 const result=await readTranscript({port:1234,token:'test-token'},'test-id_1',signal,async(url,options)=>{
  calls++;assert.equal(url,'http://127.0.0.1:1234/api/sessions/test-id_1/messages?limit=50&offset=0&order=latest');
  assert.equal(options.headers.Authorization,'Bearer test-token');assert.equal(options.method,'GET');assert.equal(options.credentials,'omit');assert.equal(options.redirect,'error');assert.equal(options.signal,signal);assert.equal(options.body,undefined);
  return new Response(JSON.stringify({session_id:'resolved',messages:[]}));
 });
 assert.equal(calls,1);assert.equal(result.sessionId,'resolved');
});
test('history rejects oversized responses and hides errors without retry',async()=>{
 for(const id of ['..','../config','a/b','%2e%2e','bad\n'])await assert.rejects(()=>readTranscript({port:1234,token:'test-token'},id,new AbortController().signal,async()=>{throw new Error('must not request');}),/^Error: HISTORY_INVALID$/);
 let calls=0;await assert.rejects(()=>readTranscript({port:1234,token:'test-token'},'id',new AbortController().signal,async()=>{calls++;return new Response('secret',{status:403});}),/^Error: HISTORY_FAILED$/);assert.equal(calls,1);
 await assert.rejects(()=>readTranscript({port:1234,token:'test-token'},'id',new AbortController().signal,async()=>new Response('x'.repeat(1048577))),/^Error: HISTORY_FAILED$/);
});
