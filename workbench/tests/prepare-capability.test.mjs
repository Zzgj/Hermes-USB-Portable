import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {prepareCapability} from '../scripts/prepare-capability.mjs';
import {readSkillCatalog} from '../scripts/skill-catalog.mjs';
async function fixture(t){
 const home=await mkdtemp(join(tmpdir(),'p2-capability-'));t.after(()=>rm(home,{recursive:true,force:true}));
 const path=join(home,'skills','fixture','SKILL.md');await mkdir(join(home,'skills','fixture'),{recursive:true});await writeFile(path,'Fixture instructions, not executed.');
 const card=(await readSkillCatalog(home)).cards[0];return {home,path,card:{...card,inputs:[{id:'target',label:'Target',required:true}]}};
}
test('preparation binds exact current skill and declared parameters without loading code',async t=>{
 const {home,path,card}=await fixture(t);const result=await prepareCapability(home,{card,values:{target:'disposable files'}});
 assert.equal(result.kind,'capability');assert.equal(result.method.fingerprint,card.method.fingerprint);assert.equal(result.availability,'unknown');assert.match(result.prompt,/disposable files/);assert.doesNotMatch(result.prompt,/Fixture instructions/);assert.equal(await readFile(path,'utf8'),'Fixture instructions, not executed.');
});
test('missing or changed method never produces a prepared task',async t=>{
 const {home,path,card}=await fixture(t);await writeFile(path,'changed');await assert.rejects(prepareCapability(home,{card,values:{target:'x'}}),/CHANGED/);
 await assert.rejects(prepareCapability(home,{card:{...card,method:{...card.method,name:'../outside'}},values:{target:'x'}}),/CHANGED/);
});
test('Bundle, missing inputs, unknown fields and duplicate declarations are rejected',async t=>{
 const {home,card}=await fixture(t);
 for(const input of [{card:{...card,method:{...card.method,kind:'bundle'}},values:{target:'x'}},{card,values:{}},{card,values:{target:'x',secret:'unexpected'}},{card:{...card,inputs:[...card.inputs,...card.inputs]},values:{target:'x'}},{card,values:{target:'x'},path:'/outside'}])await assert.rejects(prepareCapability(home,input),/INVALID/);
});
test('preparing twice does not change files or imply submission',async t=>{
 const {home,card}=await fixture(t);const input={card,values:{target:'x'}};assert.deepEqual(await prepareCapability(home,input),await prepareCapability(home,input));assert.equal((await readSkillCatalog(home)).cards[0].method.fingerprint,card.method.fingerprint);
});
