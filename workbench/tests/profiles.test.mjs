import {readFile} from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
const source=await readFile(new URL('../src/domain/profiles.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {decodeProfiles,profileListRequest}=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const row={name:'default',display_name:'Test',is_default:true,model:'test-model',provider:'test-provider',skill_count:3};
test('profile inventory explicitly disables session discovery and projects minimum fields',()=>{
 assert.deepEqual(profileListRequest(),{include_sessions:false});
 const result=decodeProfiles({profiles:[{...row,path:'private-path',last_session:{preview:'secret'},ui_meta:{token:'secret'},description:'private-prompt'}]});
 assert.deepEqual(result,[{name:'default',displayName:'Test',isDefault:true,model:'test-model',provider:'test-provider',skillCount:3}]);
 assert.deepEqual(decodeProfiles({profiles:[]}),[]);
 assert.equal(decodeProfiles({profiles:[{...row,model:null,provider:null}]})[0].model,'');
 assert.equal(decodeProfiles({profiles:[{...row,model:null,provider:null}]})[0].provider,'');
});
test('profile inventory rejects duplicate identities, malformed fields and oversized lists',()=>{
 for(const value of [null,{}, {profiles:[row,row]}, {profiles:[{...row,name:''}]}, {profiles:[{...row,skill_count:-1}]}, {profiles:[{...row,skill_count:0.5}]}, {profiles:[{...row,model:'x'.repeat(257)}]}, {profiles:[{...row,is_default:'true'}]}, {profiles:Array.from({length:101},(_,i)=>({...row,name:String(i)}))}])assert.throws(()=>decodeProfiles(value));
});
