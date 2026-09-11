import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import test from 'node:test';
import ts from 'typescript';
const source=await readFile(new URL('../src/domain/approval.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {decodeApproval,approvalParams,approvalResolved}=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const payload={request_id:'request-1',command:'echo test',reason:'Explicit permission',choices:['once','session','always','deny']};
test('approval only exposes once and deny, never persistent permissions',()=>{
 const request=decodeApproval(payload);
 assert.deepEqual(request.choices,['once','deny']);
 assert.deepEqual(approvalParams('runtime-1',request,'once'),{session_id:'runtime-1',request_id:'request-1',choice:'once',all:false});
 assert.throws(()=>approvalParams('runtime-1',request,'always'));
});
test('missing identity, command or choices cannot produce an approval',()=>{
 for(const value of [null,{}, {...payload,request_id:''},{...payload,command:''},{...payload,choices:['always']},{...payload,choices:null},{...payload,command:'x'.repeat(16001)}])assert.throws(()=>decodeApproval(value));
});
test('respect deny-only request and require explicit resolved true',()=>{
 const request=decodeApproval({...payload,choices:['deny']});
 assert.throws(()=>approvalParams('runtime-1',request,'once'));
 assert.equal(approvalParams('runtime-1',request,'deny').choice,'deny');
 for(const result of [null,{},true,{resolved:false},{resolved:'true'}])assert.equal(approvalResolved(result),false);
 assert.equal(approvalResolved({resolved:true}),true);
});
test('display text stays literal and optional reason is bounded',()=>{
 const request=decodeApproval({...payload,command:'<script>not HTML</script>',reason:'x'.repeat(5000)});
 assert.equal(request.command,'<script>not HTML</script>');
 assert.equal(request.reason.length,4000);
});
