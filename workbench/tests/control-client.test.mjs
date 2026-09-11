import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import test from 'node:test';
import ts from 'typescript';
const source=await readFile(new URL('../src/domain/control.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {controlRequest}=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const signal=new AbortController().signal;
test('management requests remain same-origin, without body, cookies or redirects',async()=>{
 const calls=[];
 const send=async(url,options)=>{calls.push({url,options});return new Response(JSON.stringify({state:'idle'}));};
 await controlRequest('stop','fixture',signal,send);
 assert.equal(calls[0].url,'/api/stop');assert.equal(calls[0].options.method,'POST');assert.equal(calls[0].options.body,undefined);
 assert.equal(calls[0].options.credentials,'omit');assert.equal(calls[0].options.redirect,'error');assert.strictEqual(calls[0].options.signal,signal);
});
test('connection response requires valid local port and nonempty secret',async()=>{
 for(const value of [{state:'ready'}, {state:'ready',connection:{port:0,token:'long-enough-token'}},{state:'ready',connection:{port:12345,token:'x'}},{state:'unknown'}]){
  await assert.rejects(controlRequest('connection','fixture',signal,async()=>new Response(JSON.stringify(value))));
 }
 const valid={state:'ready',connection:{port:12345,token:'long-enough-token'}};
 assert.deepEqual(await controlRequest('start','fixture',signal,async()=>new Response(JSON.stringify(valid))),valid);
});
test('error response is generic and never automatically retried',async()=>{
 let count=0;
 await assert.rejects(controlRequest('start','fixture',signal,async()=>{count++;return new Response('secret service traceback',{status:500});}),{message:'CONTROL_FAILED'});
 assert.equal(count,1);
});
test('status projection discards unexpected credential fields',async()=>{
 const result=await controlRequest('status','fixture',signal,async()=>new Response(JSON.stringify({state:'ready',connection:{token:'private'}})));
 assert.deepEqual(result,{state:'ready'});
});
