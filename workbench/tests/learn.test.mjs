import {readFile} from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
const source=await readFile(new URL('../src/domain/learn.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {prepareLearning,learningMatches}=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const reply={prepared:{kind:'learn',prompt:'upstream fixture prompt',builderFingerprint:'a'.repeat(64)},connection:{port:1234,token:'backend-fixture'}};
test('learning preparation uses only same-origin fixed POST, no cookie or redirects',async()=>{
 let calls=0;const draft=await prepareLearning('control-fixture','source','scope',new AbortController().signal,async(url,options)=>{
  calls++;assert.equal(url,'/api/learn/prepare');assert.equal(options.method,'POST');assert.equal(options.credentials,'omit');assert.equal(options.redirect,'error');assert.deepEqual(JSON.parse(options.body),{source:'source',scope:'scope'});return new Response(JSON.stringify(reply));
 });
 assert.equal(calls,1);assert.equal(draft.prompt,'upstream fixture prompt');
 assert.equal(learningMatches(draft,reply.connection),true);assert.equal(learningMatches(draft,{...reply.connection,token:'other'}),false);assert.equal(learningMatches(draft,{...reply.connection,port:1235}),false);assert.equal(learningMatches(draft,null),false);
});
test('learning preparation rejects invalid or oversized input and mismatched response',async()=>{
 for(const [source,scope] of [['','scope'],['source',''],['x'.repeat(4001),'scope'],['中'.repeat(4000),'中'.repeat(4000)]])await assert.rejects(()=>prepareLearning('t',source,scope,new AbortController().signal,async()=>{throw new Error('should not send');}),/^Error: LEARN_INVALID$/);
 for(const value of [{}, {...reply,prepared:{...reply.prepared,kind:'exec'}},{...reply,connection:{port:0,token:'t'}}])await assert.rejects(()=>prepareLearning('t','source','scope',new AbortController().signal,async()=>new Response(JSON.stringify(value))),/^Error: LEARN_FAILED$/);
});
