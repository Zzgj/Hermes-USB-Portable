import {readFile} from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
const source=await readFile(new URL('../src/domain/task-summary.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {summarizeTask,exportTaskObservations}=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const turn={sessionId:'test',status:'streaming',text:'private reply',seq:1,truncated:false,tools:[{id:'t',name:'terminal',status:'running'}],toolsTruncated:false};
const state={connected:true,approval:false,stopping:false};
test('task reports link cards without conferring trust or retaining sensitive extra fields',()=>{
 const summary=summarizeTask({...turn,status:'complete',capability:{cardId:'card',methodFingerprint:'a'.repeat(64),token:'private'}},state);
 assert.deepEqual(summary.capability,{cardId:'card',methodFingerprint:'a'.repeat(64)});
 const raw=exportTaskObservations([{...summary,text:'private reply',token:'private',tools:[{...summary.tools[0],args:'private',result:'private'}]}]);
 const report=JSON.parse(raw);assert.equal(report.trusted_verification,false);assert.equal(report.tasks[0].businessVerification,'unverified');assert.equal(report.tasks[0].status,'complete');assert.equal(raw.includes('private'),false);
});
test('task report is a bounded snapshot and does not mutate or silently drop records',()=>{
 const summary=summarizeTask(turn,{...state,connected:false});const before=JSON.stringify(summary);
 const report=JSON.parse(exportTaskObservations([summary]));assert.equal(report.tasks[0].status,'unknown');assert.equal(report.tasks[0].tools[0].status,'unknown');assert.equal(JSON.stringify(summary),before);
 assert.throws(()=>exportTaskObservations([]));assert.throws(()=>exportTaskObservations(Array(101).fill(summary)));
 assert.throws(()=>exportTaskObservations([{...summary,sessionId:'中'.repeat(100000)}]));
});
test('task view distinguishes approval, stop request and disconnected unknown',()=>{
 assert.equal(summarizeTask(turn,state).status,'running');
 assert.equal(summarizeTask(turn,{...state,approval:true}).status,'waiting-approval');
 assert.equal(summarizeTask(turn,{...state,approval:true,stopping:true}).status,'stopping');
 const unknown=summarizeTask(turn,{connected:false,approval:true,stopping:true});
 assert.equal(unknown.status,'unknown');assert.equal(unknown.tools[0].status,'unknown');
 assert.equal(turn.tools[0].status,'running');assert.equal('text' in unknown,false);
});
test('observed terminal state wins over connection state and leaves unfinished tools unknown',()=>{
 for(const status of ['complete','failed','interrupted']){
  const summary=summarizeTask({...turn,status},{connected:false,approval:true,stopping:true});
  assert.equal(summary.status,status);assert.equal(summary.tools[0].status,'unknown');
  assert.equal('verified' in summary,false);
 }
 const summary=summarizeTask({...turn,tools:[{id:'t',name:'terminal',status:'finished'}]},state);
 assert.equal(summary.tools[0].status,'finished');
});
