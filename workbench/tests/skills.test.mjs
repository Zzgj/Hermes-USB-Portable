import {readFile} from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
const source=await readFile(new URL('../src/domain/skills.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {decodeAvailableSkills}=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
test('availability snapshot projects categories and names without inventing trust or version',()=>{
 assert.deepEqual(decodeAvailableSkills({skills:{office:['excel']},token:'secret'}),[{name:'excel',category:'office'}]);
 assert.deepEqual(decodeAvailableSkills({skills:{}}),[]);
});
test('reject malformed, duplicate and unbounded availability responses',()=>{
 for(const value of [null,{}, {skills:[]},{skills:{a:['x'],b:['x']}},{skills:{a:[4]}},{skills:{a:['']}},{skills:{a:Array.from({length:1001},(_,i)=>String(i))}}])assert.throws(()=>decodeAvailableSkills(value));
});
