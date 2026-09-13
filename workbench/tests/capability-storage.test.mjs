import {readFile} from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';

const capSource=await readFile(new URL('../src/domain/capability.ts',import.meta.url),'utf8');
const capJs=ts.transpileModule(capSource,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;

const storeSource=await readFile(new URL('../src/domain/capability-storage.ts',import.meta.url),'utf8');
const storeJsRaw=ts.transpileModule(storeSource,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const storeJs=storeJsRaw.replace(/^import\s*\{[^}]*\}\s*from\s*['"]\.\/capability['"];?\s*$/gm,'');

const combinedJs=capJs+'\n'+storeJs;
const combinedUrl=`data:text/javascript;base64,${Buffer.from(combinedJs).toString('base64')}`;
const mod=await import(combinedUrl);

const hash='a'.repeat(64),env='b'.repeat(64);
const card=mod.decodeCapability({id:'files',name:'Test files',goal:'Organize disposable files',method:{kind:'skill',name:'file-sort',fingerprint:hash},state:'published',inputs:[{id:'source',label:'Source',required:true}]});
const evidenceRecord=mod.decodeVerification({capabilityId:'files',methodFingerprint:hash,environmentFingerprint:env,sessionId:'test-session',verifiedAt:'2026-09-09T00:00:00Z',outcome:'passed',checks:[{id:'expected-files',passed:true}]});
const {saveDrafts,loadDrafts,clearDrafts,saveEvidence,loadEvidence,clearEvidence}=mod;

function makeBackend(){
 const map=new Map();
 return {
  getItem:key=>map.has(key)?map.get(key):null,
  setItem:(key,value)=>{map.set(key,value);},
  removeItem:key=>{map.delete(key);},
 };
}

test('saveDrafts and loadDrafts round-trip preserves card definitions as drafts',t=>{
 const backend=makeBackend();
 const original=globalThis.localStorage;
 globalThis.localStorage=backend;
 t.after(()=>{globalThis.localStorage=original;clearDrafts();});
 saveDrafts([{...card,secret:'discard'}]);
 const loaded=loadDrafts();
 assert.equal(loaded.length,1);
 assert.equal(loaded[0].id,'files');
 assert.equal(loaded[0].state,'draft');
 assert.equal(loaded[0].secret,undefined);
});

test('loadDrafts returns empty array when storage is unavailable',t=>{
 const original=globalThis.localStorage;
 globalThis.localStorage=undefined;
 t.after(()=>{globalThis.localStorage=original;});
 assert.deepEqual(loadDrafts(),[]);
});

test('loadDrafts returns empty array when key is absent',t=>{
 const backend=makeBackend();
 const original=globalThis.localStorage;
 globalThis.localStorage=backend;
 t.after(()=>{globalThis.localStorage=original;});
 assert.deepEqual(loadDrafts(),[]);
});

test('loadDrafts returns empty array when payload is corrupted',t=>{
 const backend=makeBackend();
 backend.setItem('hermes-p2-capability-drafts-v1','not json');
 const original=globalThis.localStorage;
 globalThis.localStorage=backend;
 t.after(()=>{globalThis.localStorage=original;});
 assert.deepEqual(loadDrafts(),[]);
});

test('clearDrafts removes persisted cards',t=>{
 const backend=makeBackend();
 const original=globalThis.localStorage;
 globalThis.localStorage=backend;
 t.after(()=>{globalThis.localStorage=original;});
 saveDrafts([card]);
 clearDrafts();
 assert.deepEqual(loadDrafts(),[]);
 assert.equal(backend.getItem('hermes-p2-capability-drafts-v1'),null);
});

test('saveEvidence and loadEvidence round-trip preserves records but forces trusted:false',t=>{
 const backend=makeBackend();
 const original=globalThis.localStorage;
 globalThis.localStorage=backend;
 t.after(()=>{globalThis.localStorage=original;clearEvidence();});
 const imported=mod.importVerificationDrafts(JSON.stringify([evidenceRecord]));
 saveEvidence(imported);
 const loaded=loadEvidence();
 assert.equal(loaded.length,1);
 assert.equal(loaded[0].capabilityId,'files');
 assert.equal(loaded[0].trusted,false);
});

test('loadEvidence returns empty array when storage is unavailable',t=>{
 const original=globalThis.localStorage;
 globalThis.localStorage=undefined;
 t.after(()=>{globalThis.localStorage=original;});
 assert.deepEqual(loadEvidence(),[]);
});

test('clearEvidence removes persisted records',t=>{
 const backend=makeBackend();
 const original=globalThis.localStorage;
 globalThis.localStorage=backend;
 t.after(()=>{globalThis.localStorage=original;});
 saveEvidence(mod.importVerificationDrafts(JSON.stringify([evidenceRecord])));
 clearEvidence();
 assert.deepEqual(loadEvidence(),[]);
 assert.equal(backend.getItem('hermes-p2-capability-evidence-v1'),null);
});

test('saveEvidence rejects oversized arrays',t=>{
 const backend=makeBackend();
 const original=globalThis.localStorage;
 globalThis.localStorage=backend;
 t.after(()=>{globalThis.localStorage=original;});
 const single={...evidenceRecord,trusted:false};
 const tooMany=Array.from({length:501},()=>single);
 assert.throws(()=>saveEvidence(tooMany),/PERSIST_TOO_LARGE/);
});
