import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {packageFiles,stageP2Package} from '../scripts/build-p2-package.mjs';

// Fixed source tree this test reads from: workbench/tests -> repository root.
const sourceRoot=fileURLToPath(new URL('../..',import.meta.url));
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
// P0 shell files are deliberately NOT part of the P2 increment package.
const p0Files=['launch.bat','scripts/open-hermes.ps1','scripts/start-web-workbench.ps1'];
const legacyModule='workbench/scripts/legacy-hermes-entry.mjs';
const nativeModules=['native-entry-host.py','native-entry-session.mjs','native-entry-manager.mjs','native-entry-adapters.mjs','native-owned-process.mjs','native-console-process.mjs','native-process-protocol.mjs','portable-native-entries.mjs','portable-entry-guard.mjs','portable-entry-guard.json','legacy-hermes-entry.mjs','open-local-browser.mjs'];

// Stages the real whitelisted sources into a private temporary repo. Only workbench/dist is synthetic
// (a build artifact this batch must not produce), and it is labelled as such in its own content.
async function stageFixture(t){
 const root=await mkdtemp(join(tmpdir(),'hermes-p2-native-'));
 t.after(()=>rm(root,{recursive:true,force:true}));
 const repo=join(root,'repo');await mkdir(repo);
 const sources=new Map();
 for(const relative of packageFiles){
  const bytes=await readFile(join(sourceRoot,relative));
  await mkdir(dirname(join(repo,relative)),{recursive:true});
  await writeFile(join(repo,relative),bytes);
  sources.set(relative,bytes);
 }
 await mkdir(join(repo,'workbench','dist','assets'),{recursive:true});
 const index=Buffer.from('<!doctype html><meta charset="utf-8"><title>synthetic dist fixture (not a build)</title>\n');
 const asset=Buffer.from('export const syntheticDistFixture=true;\n');
 await writeFile(join(repo,'workbench','dist','index.html'),index);
 await writeFile(join(repo,'workbench','dist','assets','index-synthetic.js'),asset);
 sources.set('workbench/dist/index.html',index);
 sources.set('workbench/dist/assets/index-synthetic.js',asset);
 const output=join(root,'output');
 const manifest=await stageP2Package(repo,output);
 return {root,repo,output,manifest,sources};
}

// A temporary portable root plus the staged package, used to exercise the real guard from the output.
async function guardFixture(t,{launchers=true,legacy=true}={}){
 const staged=await stageFixture(t);
 const target=join(staged.root,'target');
 await mkdir(join(target,'data'),{recursive:true});
 for(const relative of launchers?p0Files:[]){
  const bytes=await readFile(join(sourceRoot,relative));
  await mkdir(dirname(join(target,relative)),{recursive:true});
  await writeFile(join(target,relative),bytes);
 }
 if(legacy){
  const bytes=await readFile(join(sourceRoot,legacyModule));
  await mkdir(dirname(join(target,legacyModule)),{recursive:true});
  await writeFile(join(target,legacyModule),bytes);
 }
 const guard=await import(pathToFileURL(join(staged.output,'workbench','scripts','portable-entry-guard.mjs')).href);
 return {...staged,target,home:join(target,'data'),guard};
}

test('staging copies real whitelisted sources byte for byte and stays non-releasable',async t=>{
 const {output,manifest,sources}=await stageFixture(t);
 assert.equal(manifest.schema,1);
 assert.equal(manifest.package,'Hermes-Portable-P2');
 assert.equal(manifest.status,'development-snapshot');
 assert.equal(manifest.release_ready,false,'a development snapshot must never claim release_ready');
 const paths=manifest.files.map(file=>file.path);
 assert.equal(new Set(paths).size,paths.length,'manifest must not repeat a path');
 assert.equal(paths.length,sources.size);
 for(const [relative,bytes] of sources){
  const staged=await readFile(join(output,relative));
  assert.ok(staged.equals(bytes),relative+' must be copied without modification');
  const entry=manifest.files.find(file=>file.path===relative);
  assert.ok(entry,relative+' must appear in the manifest');
  assert.equal(entry.size,bytes.length,relative+' size');
  assert.equal(entry.sha256,digest(bytes),relative+' sha256 must describe the real source');
  assert.equal(digest(staged),entry.sha256,relative+' staged bytes must match the manifest');
 }
 for(const name of nativeModules){
  const relative='workbench/scripts/'+name;
  assert.ok(paths.includes(relative),relative+' must ship inside the increment');
  assert.ok((await readFile(join(output,relative))).length>0,relative+' must not be empty');
 }
 // The guard manifest travels with the package and is byte-identical to the source that staged it.
 assert.ok((await readFile(join(output,'workbench','scripts','portable-entry-guard.json'),'utf8')).includes('launch.bat'));
 for(const relative of p0Files)assert.equal(paths.includes(relative),false,relative+' belongs to the P0 shell, not this increment');
});

test('the staged guard accepts a matching P0 launcher set',async t=>{
 const {guard,target,home,output}=await guardFixture(t);
 await guard.assertPortableEntryGuard(target,home);
 assert.equal(await readFile(join(output,'workbench','scripts','portable-entry-guard.json'),'utf8'),await readFile(join(sourceRoot,'workbench','scripts','portable-entry-guard.json'),'utf8'));
});

test('the guard rejects a P2-only root without the P0 launchers',async t=>{
 const {guard,target,home}=await guardFixture(t,{launchers:false,legacy:false});
 await assert.rejects(guard.assertPortableEntryGuard(target,home));
});

test('the guard rejects a stale or tampered launcher',async t=>{
 const {guard,target,home}=await guardFixture(t);
 await writeFile(join(target,'launch.bat'),'@echo off\r\nrem outdated P0 launcher\r\n');
 await assert.rejects(guard.assertPortableEntryGuard(target,home),/ENTRY_COORDINATION_UNCONFIRMED/);
});

test('the guard rejects a missing legacy coordination module',async t=>{
 const {guard,target,home}=await guardFixture(t,{legacy:false});
 await assert.rejects(guard.assertPortableEntryGuard(target,home));
});

test('the guard refuses interrupted-install markers and leaves both markers untouched',async t=>{
 const {guard,target,home}=await guardFixture(t);
 const installMarker=join(target,'logs','diagnostics','p2-install-active.json');
 const restoreMarker=join(target,'updates','hermes-restore-active.json');
 const install=Buffer.from('{"sentinel":"install-in-progress"}\n');
 const restore=Buffer.from('{"sentinel":"restore-in-progress"}\n');
 await mkdir(dirname(installMarker),{recursive:true});await writeFile(installMarker,install);
 await mkdir(dirname(restoreMarker),{recursive:true});await writeFile(restoreMarker,restore);
 await assert.rejects(guard.assertPortableEntryGuard(target,home),/INTERRUPTED_INSTALL_REQUIRES_RECOVERY/);
 assert.ok((await readFile(installMarker)).equals(install),'install marker must be preserved verbatim');
 assert.ok((await readFile(restoreMarker)).equals(restore),'restore marker must be preserved verbatim');
});

test('an external gateway receipt is refused without clearing the receipt or an existing lock',async t=>{
 const {guard,target,home}=await guardFixture(t);
 const receipt=Buffer.from('12345\n');
 const lockOwner=Buffer.from('{"schema":1,"nonce":"sentinel","pid":12345}\n');
 await writeFile(join(home,'gateway.pid'),receipt);
 await mkdir(join(home,'.p2-manager-lock'),{mode:0o700});
 await writeFile(join(home,'.p2-manager-lock','owner.json'),lockOwner);
 await assert.rejects(guard.assertPortableEntryGuard(target,home),/EXTERNAL_ENTRY_REQUIRES_REVIEW/);
 assert.ok((await readFile(join(home,'gateway.pid'))).equals(receipt),'gateway receipt must not be removed or rewritten');
 assert.ok((await readFile(join(home,'.p2-manager-lock','owner.json'))).equals(lockOwner),'an existing instance lock must not be released');
});

test('a home that is not the portable data directory is refused',async t=>{
 const {guard,target}=await guardFixture(t);
 const other=join(target,'other-home');await mkdir(other);
 await assert.rejects(guard.assertPortableEntryGuard(target,other),/PORTABLE_ENTRY_HOME_MISMATCH/);
});
