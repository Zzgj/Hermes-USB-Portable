import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm,symlink,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {readSkillCatalog} from '../scripts/skill-catalog.mjs';
async function fixture(t){const root=await mkdtemp(join(tmpdir(),'p2-catalog-'));t.after(()=>rm(root,{recursive:true,force:true}));return root;}
test('catalog exports draft metadata only and hashes scripts as well as the definition',async t=>{
 const root=await fixture(t),skill=join(root,'skills','support','demo');await mkdir(join(skill,'scripts'),{recursive:true});
 await writeFile(join(skill,'SKILL.md'),'private instruction fixture');await writeFile(join(skill,'scripts','check.ps1'),'first');
 const first=await readSkillCatalog(root);assert.equal(first.cards.length,1);assert.equal(first.cards[0].state,'draft');assert.equal(first.cards[0].method.name,'support/demo');assert.equal(JSON.stringify(first).includes('private instruction'),false);
 assert.deepEqual(await readSkillCatalog(root),first);
 await writeFile(join(skill,'scripts','check.ps1'),'second');const second=await readSkillCatalog(root);assert.notEqual(second.cards[0].method.fingerprint,first.cards[0].method.fingerprint);assert.equal(second.cards[0].id,first.cards[0].id);
 assert.equal(await readFile(join(skill,'SKILL.md'),'utf8'),'private instruction fixture');
});
test('catalog rejects links and case collisions, and missing skills is an empty inventory',async t=>{
 const root=await fixture(t);assert.deepEqual(await readSkillCatalog(root),{cards:[],availability:'unknown'});
 await mkdir(join(root,'skills'));await symlink(root,join(root,'skills','outside'));await assert.rejects(readSkillCatalog(root),/UNSAFE/);
 await rm(join(root,'skills','outside'));
 // NFC/NFD collision: verified on the delivery Windows filesystem and Linux.
 // This fixture requires distinct normalization forms; it is not a claim about every filesystem.
 await mkdir(join(root,'skills','café'));
 await mkdir(join(root,'skills','cafe\u0301'));
 await assert.rejects(readSkillCatalog(root),/COLLISION/);
 await rm(join(root,'skills','café'),{recursive:true,force:true});
 await rm(join(root,'skills','cafe\u0301'),{recursive:true,force:true});
 // Keep a separate pure-case collision assertion wherever both names can exist.
 // EEXIST means this fixture did not exercise the pure-case rejection branch.
 await mkdir(join(root,'skills','Case'));
 let caseDistinct=false;
 try{await mkdir(join(root,'skills','case'));caseDistinct=true;}catch(error){if(error.code!=='EEXIST')throw error;}
 if(caseDistinct){
   await assert.rejects(readSkillCatalog(root),/COLLISION/);
 }else{
   const catalog=await readSkillCatalog(root);
   assert.equal(catalog.cards.length,0);
 }
});
test('oversized skill files fail without partial results',async t=>{
 const root=await fixture(t),skill=join(root,'skills','demo');await mkdir(skill,{recursive:true});await writeFile(join(skill,'SKILL.md'),'x'.repeat(1048577));await assert.rejects(readSkillCatalog(root),/LIMIT/);
});
