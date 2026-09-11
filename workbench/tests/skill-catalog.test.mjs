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
 await rm(join(root,'skills','outside'));await writeFile(join(root,'skills','Case'),'a');await writeFile(join(root,'skills','case'),'b');await assert.rejects(readSkillCatalog(root),/COLLISION/);
});
test('oversized skill files fail without partial results',async t=>{
 const root=await fixture(t),skill=join(root,'skills','demo');await mkdir(skill,{recursive:true});await writeFile(join(skill,'SKILL.md'),'x'.repeat(1048577));await assert.rejects(readSkillCatalog(root),/LIMIT/);
});
