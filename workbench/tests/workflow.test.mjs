import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import test from 'node:test';
import ts from 'typescript';
const source=await readFile(new URL('../src/domain/workflow.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {createRun,transition,actionsFor,bindInputs,missingInputs}=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const def={id:'example',version:'1',inputs:[],steps:[{id:'read'},{id:'write',approval:'Confirm'}]};
test('steps advance independently and approval cannot be skipped',()=>{
 let run=createRun(def);run=transition(def,run,'start');
 assert.equal(run.status,'running');assert.deepEqual(run.steps,['running','pending']);
 run=transition(def,run,'finish');assert.equal(run.status,'waiting-approval');
 assert.strictEqual(transition(def,run,'finish'),run);
 assert.strictEqual(transition(def,run,'start'),run);
 run=transition(def,run,'approve');run=transition(def,run,'finish');
 assert.equal(run.status,'succeeded');assert.deepEqual(run.steps,['succeeded','succeeded']);
 assert.equal(run.events.length,5);
});
test('cancel preserves completed steps and never claims rollback',()=>{
 let run=transition(def,createRun(def),'start');run=transition(def,run,'finish');run=transition(def,run,'cancel');
 assert.deepEqual(run.steps,['succeeded','cancelled']);assert.deepEqual(actionsFor(run),['reset']);
 assert.strictEqual(transition(def,run,'approve'),run);
 assert.deepEqual(transition(def,run,'reset'),createRun(def));
});
test('different workflow can begin with approval; failures are terminal',()=>{
 const other={id:'other',version:'2',inputs:[],steps:[{id:'confirm',approval:'Review'}]};
 let run=transition(other,createRun(other),'start');assert.equal(run.status,'waiting-approval');
 run=transition(other,run,'approve');run=transition(other,run,'fail');
 assert.equal(run.status,'failed');assert.strictEqual(transition(other,run,'finish'),run);
});
test('reject mismatched definition and malformed step lists',()=>{
 assert.throws(()=>transition({...def,version:'2'},createRun(def),'start'));
 assert.throws(()=>createRun({...def,steps:[]}));
 assert.throws(()=>createRun({...def,steps:[{id:'same'},{id:'same'}]}));
});
test('transitions do not mutate preceding evidence',()=>{
 const run=createRun(def);const snapshot=JSON.stringify(run);transition(def,run,'start');
 assert.equal(JSON.stringify(run),snapshot);
});
test('inputs are required, copied and cannot change after start',()=>{
 const target={...def,inputs:['target']};let run=createRun(target);
 assert.strictEqual(transition(target,run,'start'),run);
 assert.deepEqual(missingInputs(target,{target:'  '}),['target']);
 const values={target:'  computer-B  ',secret:'not part of schema'};
 run=bindInputs(target,run,values);values.target='computer-A';
 assert.deepEqual(run.inputs,{target:'  computer-B  '});
 run=transition(target,run,'start');assert.equal(run.status,'running');
 assert.strictEqual(bindInputs(target,run,{target:'computer-C'}),run);
 run=transition(target,run,'cancel');run=transition(target,run,'reset');
 assert.deepEqual(run.inputs,{});
});
