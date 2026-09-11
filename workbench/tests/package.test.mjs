import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,symlink} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {packageFiles,stageP2Package} from '../scripts/build-p2-package.mjs';
async function fixture(t){
 const root=await mkdtemp(join(tmpdir(),'hermes-p2-package-'));t.after(()=>rm(root,{recursive:true,force:true}));const repo=join(root,'repo');await mkdir(repo);
 for(const name of [...packageFiles,'workbench/dist/index.html','workbench/dist/assets/main.js','data/.env']){await mkdir(dirname(join(repo,name)),{recursive:true});await writeFile(join(repo,name),name==='data/.env'?'PRIVATE':'fixture');}
 return {root,repo};
}
test('package is allowlisted, checksummed and explicitly not release-qualified',async t=>{
 const {root,repo}=await fixture(t),output=join(root,'output');const result=await stageP2Package(repo,output);
 assert.equal(result.release_ready,false);assert.equal(result.files.some(file=>file.path.startsWith('data/')),false);
 assert.ok(result.files.every(file=>/^[a-f0-9]{64}$/.test(file.sha256)));
 assert.equal((await readFile(join(output,'p2-package.json'),'utf8')).includes('PRIVATE'),false);
 await assert.rejects(stageP2Package(repo,output),{code:'EEXIST'});
});
test('unexpected build files are rejected instead of silently packaged',async t=>{
 const {root,repo}=await fixture(t);await writeFile(join(repo,'workbench/dist/.env'),'PRIVATE');
 await assert.rejects(stageP2Package(repo,join(root,'output')),/UNEXPECTED_BUILD_ASSET/);
});
test('linked build assets are rejected',async t=>{
 const {root,repo}=await fixture(t);await symlink(join(repo,'data/.env'),join(repo,'workbench/dist/private.js'));
 await assert.rejects(stageP2Package(repo,join(root,'output')),/PACKAGE_LINK_REJECTED/);
});
