import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,readdir,lstat,rm} from 'node:fs/promises';
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
const coordinatedFiles=[...p0Files,legacyModule];
const nativeModules=['native-entry-host.py','native-entry-session.mjs','native-entry-manager.mjs','native-entry-adapters.mjs','native-owned-process.mjs','native-console-process.mjs','native-process-protocol.mjs','portable-native-entries.mjs','portable-entry-guard.mjs','portable-entry-guard.json','legacy-hermes-entry.mjs','open-local-browser.mjs'];
// Same lock shape the production acquireInstanceLock/release pair creates and validates.
const lockDirectory='.p2-manager-lock';
const lockOwner=Buffer.from('{"schema":1,"nonce":"sentinel","pid":12345,"created":"2000-01-01T00:00:00.000Z"}\n');

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

// The guard is an admission check, not a lock manager: it must never create a lock on an accepted
// root and never release, rewrite or truncate an existing one on any refusal. The snapshot captures
// the whole lock directory so an extra or removed entry is a failure too.
async function lockSnapshot(home){
 const directory=join(home,lockDirectory);
 try{
  const metadata=await lstat(directory);
  const names=(await readdir(directory)).sort();
  const entries=[];
  for(const name of names)entries.push([name,(await readFile(join(directory,name))).toString('base64')]);
  return {present:true,symbolicLink:metadata.isSymbolicLink(),entries};
 }catch(error){if(error.code==='ENOENT')return {present:false};throw error;}
}

async function seedInstanceLock(home){
 await mkdir(join(home,lockDirectory),{mode:0o700});
 await writeFile(join(home,lockDirectory,'owner.json'),lockOwner);
 const snapshot=await lockSnapshot(home);
 assert.equal(snapshot.present,true,'the seeded lock must exist');
 assert.equal(snapshot.symbolicLink,false);
 assert.equal(snapshot.entries.length,1,'the seeded lock carries exactly one owner record');
 return snapshot;
}

// Every scenario runs twice: once on a lock-free home (the guard must not create a lock) and once
// with a pre-existing lock (the guard must leave it byte for byte). `run` performs the guard call
// and asserts the expected outcome.
async function bothLockStates(home,run){
 assert.equal((await lockSnapshot(home)).present,false,'the lock-free phase must start without an instance lock');
 await run();
 assert.equal((await lockSnapshot(home)).present,false,'the guard must not create an instance lock');
 const seeded=await seedInstanceLock(home);
 await run();
 assert.deepEqual(await lockSnapshot(home),seeded,'the guard must not release or rewrite an existing lock');
}

const installMarker=target=>join(target,'logs','diagnostics','p2-install-active.json');
const restoreMarker=target=>join(target,'updates','hermes-restore-active.json');
const installBytes=Buffer.from('{"sentinel":"install-in-progress"}\n');
const restoreBytes=Buffer.from('{"sentinel":"restore-in-progress"}\n');

async function writeMarker(path,bytes){
 await mkdir(dirname(path),{recursive:true});
 await writeFile(path,bytes);
}

async function assertPreserved(path,bytes,label){
 assert.ok((await readFile(path)).equals(bytes),label+' must be preserved verbatim');
}

async function assertAbsent(path,label){
 await assert.rejects(lstat(path),{code:'ENOENT'},label+' must not be created');
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

test('the staged guard accepts a matching P0 launcher set and never takes the instance lock',async t=>{
 const {guard,target,home,output}=await guardFixture(t);
 await bothLockStates(home,async()=>{await guard.assertPortableEntryGuard(target,home);});
 assert.equal(await readFile(join(output,'workbench','scripts','portable-entry-guard.json'),'utf8'),await readFile(join(sourceRoot,'workbench','scripts','portable-entry-guard.json'),'utf8'));
});

// The package manifest stores LF-normalized hashes, so the same coordination set must be accepted
// whether the checked-out bytes are LF or CRLF. Both variants are written to disk and read back
// before the guard runs, so this covers real files rather than the fixture's original bytes.
test('the staged guard accepts LF and CRLF copies of the coordination files',async t=>{
 const {guard,target,home}=await guardFixture(t);
 const logical=new Map();
 for(const relative of coordinatedFiles)logical.set(relative,(await readFile(join(sourceRoot,relative),'utf8')).replace(/\r\n/g,'\n'));
 const writeAll=async convert=>{
  for(const [relative,text] of logical)await writeFile(join(target,relative),convert(text));
 };
 await bothLockStates(home,async()=>{
  for(const [variant,convert] of [['LF',text=>text],['CRLF',text=>text.replace(/\n/g,'\r\n')]]){
   await writeAll(convert);
   for(const [relative,text] of logical){
    const onDisk=await readFile(join(target,relative),'utf8');
    assert.equal(onDisk.includes('\r\n'),variant==='CRLF',relative+' must actually carry '+variant+' bytes before the guard runs');
    assert.equal(onDisk.replace(/\r\n/g,'\n'),text,relative+' must differ from the LF form only by line endings');
   }
   await guard.assertPortableEntryGuard(target,home);
  }
 });
});

// Only CRLF is normalized. A file whose line endings are bare carriage returns has different bytes
// and must still be refused, otherwise the LF/CRLF acceptance would be a broad whitespace tolerance.
test('the guard rejects coordination files whose line endings are neither LF nor CRLF',async t=>{
 const {guard,target,home}=await guardFixture(t);
 for(const relative of coordinatedFiles){
  const text=(await readFile(join(sourceRoot,relative),'utf8')).replace(/\r\n/g,'\n');
  await writeFile(join(target,relative),text.replace(/\n/g,'\r'));
 }
 await bothLockStates(home,async()=>{
  await assert.rejects(guard.assertPortableEntryGuard(target,home),/ENTRY_COORDINATION_UNCONFIRMED/);
 });
});

test('the guard rejects a P2-only root without the P0 launchers and leaves the lock untouched',async t=>{
 const {guard,target,home}=await guardFixture(t,{launchers:false,legacy:false});
 await bothLockStates(home,async()=>{await assert.rejects(guard.assertPortableEntryGuard(target,home));});
});

test('the guard rejects a stale or tampered launcher and leaves the lock untouched',async t=>{
 const {guard,target,home}=await guardFixture(t);
 await writeFile(join(target,'launch.bat'),'@echo off\r\nrem outdated P0 launcher\r\n');
 await bothLockStates(home,async()=>{
  await assert.rejects(guard.assertPortableEntryGuard(target,home),/ENTRY_COORDINATION_UNCONFIRMED/);
 });
});

test('the guard rejects a missing legacy coordination module and leaves the lock untouched',async t=>{
 const {guard,target,home}=await guardFixture(t,{legacy:false});
 await bothLockStates(home,async()=>{await assert.rejects(guard.assertPortableEntryGuard(target,home));});
});

// The two markers are checked in one loop that throws on the first hit, so each marker is exercised
// on its own before the combined case: a restore-only root proves the second check is reachable.
test('an install marker alone refuses entry, preserves the marker and leaves the lock untouched',async t=>{
 const {guard,target,home}=await guardFixture(t);
 const marker=installMarker(target);
 await writeMarker(marker,installBytes);
 await bothLockStates(home,async()=>{
  await assert.rejects(guard.assertPortableEntryGuard(target,home),/INTERRUPTED_INSTALL_REQUIRES_RECOVERY/);
  await assertPreserved(marker,installBytes,'the install marker');
  await assertAbsent(restoreMarker(target),'a restore marker');
 });
});

test('a restore marker alone refuses entry, preserves the marker and leaves the lock untouched',async t=>{
 const {guard,target,home}=await guardFixture(t);
 const marker=restoreMarker(target);
 await writeMarker(marker,restoreBytes);
 await bothLockStates(home,async()=>{
  await assert.rejects(guard.assertPortableEntryGuard(target,home),/INTERRUPTED_INSTALL_REQUIRES_RECOVERY/);
  await assertPreserved(marker,restoreBytes,'the restore marker');
  await assertAbsent(installMarker(target),'an install marker');
 });
});

test('both markers together refuse entry and both are preserved verbatim',async t=>{
 const {guard,target,home}=await guardFixture(t);
 const install=installMarker(target),restore=restoreMarker(target);
 await writeMarker(install,installBytes);
 await writeMarker(restore,restoreBytes);
 await bothLockStates(home,async()=>{
  await assert.rejects(guard.assertPortableEntryGuard(target,home),/INTERRUPTED_INSTALL_REQUIRES_RECOVERY/);
  await assertPreserved(install,installBytes,'the install marker');
  await assertPreserved(restore,restoreBytes,'the restore marker');
 });
});

test('an external gateway receipt is refused without clearing the receipt or an existing lock',async t=>{
 const {guard,target,home}=await guardFixture(t);
 const receipt=Buffer.from('12345\n');
 await writeFile(join(home,'gateway.pid'),receipt);
 await bothLockStates(home,async()=>{
  await assert.rejects(guard.assertPortableEntryGuard(target,home),/EXTERNAL_ENTRY_REQUIRES_REVIEW/);
  assert.ok((await readFile(join(home,'gateway.pid'))).equals(receipt),'gateway receipt must not be removed or rewritten');
 });
});

test('a home that is not the portable data directory is refused and never takes its lock',async t=>{
 const {guard,target}=await guardFixture(t);
 const other=join(target,'other-home');await mkdir(other);
 await bothLockStates(other,async()=>{
  await assert.rejects(guard.assertPortableEntryGuard(target,other),/PORTABLE_ENTRY_HOME_MISMATCH/);
 });
});
