import {readFile} from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
const source=await readFile(new URL('../src/domain/capability.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {decodeCapability,decodeVerification,capabilityStatus,bindCapabilityInputs,importCapabilityDrafts,exportCapabilityDrafts,fetchCapabilityDrafts}=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const hash='a'.repeat(64),env='b'.repeat(64);
const card=decodeCapability({id:'files',name:'Test files',goal:'Organize disposable files',method:{kind:'skill',name:'file-sort',fingerprint:hash},state:'published',inputs:[{id:'source',label:'Source',required:true}]});
const evidence=decodeVerification({capabilityId:'files',methodFingerprint:hash,environmentFingerprint:env,sessionId:'test-session',verifiedAt:'2026-09-09T00:00:00Z',outcome:'passed',checks:[{id:'expected-files',passed:true}]});
test('catalog client projects drafts, bounds responses and never sends a filesystem path',async t=>{
 const original=globalThis.fetch;t.after(()=>{globalThis.fetch=original;});
 globalThis.fetch=async(url,options)=>{assert.equal(url,'/api/capabilities/catalog');assert.equal(options.credentials,'omit');assert.equal(options.redirect,'error');assert.equal(options.body,undefined);return new Response(JSON.stringify({availability:'unknown',cards:[{...card,secret:'discard'}]}));};
 const result=JSON.parse(await fetchCapabilityDrafts('fixture'));assert.equal(result[0].state,'draft');assert.equal(result[0].secret,undefined);
 globalThis.fetch=async()=>new Response('x'.repeat(70001));await assert.rejects(fetchCapabilityDrafts('fixture'));
 globalThis.fetch=async()=>new Response(JSON.stringify({availability:'verified',cards:[card]}));await assert.rejects(fetchCapabilityDrafts('fixture'));
});
test('publication alone is not verification; draft stays draft',()=>{
 assert.equal(capabilityStatus(card,[],env),'unverified');
 assert.equal(capabilityStatus({...card,state:'draft'},[evidence],env),'draft');
 assert.equal(capabilityStatus(card,[evidence],env),'verified');
});
test('imported cards become drafts and cannot carry forged verification or extra fields',()=>{
 const imported=importCapabilityDrafts(JSON.stringify([{...card,evidence:[evidence],secret:'discard'}]));
 assert.equal(imported[0].state,'draft');assert.equal(imported[0].evidence,undefined);assert.equal(imported[0].secret,undefined);
 assert.throws(()=>importCapabilityDrafts(JSON.stringify([card,card])));
 assert.throws(()=>importCapabilityDrafts(' '.repeat(65537)));
 assert.throws(()=>importCapabilityDrafts('{}'));assert.throws(()=>importCapabilityDrafts('[]'));
});
test('changed method or environment requires new verification and preserves old evidence',()=>{
 assert.equal(capabilityStatus({...card,method:{...card.method,fingerprint:'c'.repeat(64)}},[evidence],env),'reverify');
 assert.equal(capabilityStatus(card,[evidence],'d'.repeat(64)),'reverify');
 assert.equal(evidence.methodFingerprint,hash);
});
test('later failure and conflicting same-time evidence cannot be hidden by an earlier success',()=>{
 const failed={...evidence,outcome:'failed'};
 assert.equal(capabilityStatus(card,[evidence,failed],env),'reverify');
 assert.equal(capabilityStatus(card,[evidence,{...failed,verifiedAt:'2026-09-10T00:00:00Z'}],env),'reverify');
 assert.equal(capabilityStatus(card,[{...evidence,checks:[{id:'check',passed:false}]}],env),'reverify');
});
test('parameters are bounded and only declared fields are retained',()=>{
 assert.deepEqual(bindCapabilityInputs(card,{source:'test-dir',secret:'do not carry'}),{source:'test-dir'});
 assert.throws(()=>bindCapabilityInputs(card,{}));assert.throws(()=>bindCapabilityInputs(card,{source:'x'.repeat(4001)}));
});
test('invalid cards and evidence are rejected',()=>{
 assert.throws(()=>decodeCapability({...card,method:{...card.method,fingerprint:'v1'}}));
 assert.throws(()=>decodeCapability({...card,inputs:[...card.inputs,...card.inputs]}));
 assert.throws(()=>decodeVerification({...evidence,checks:[]}));
 assert.throws(()=>decodeVerification({...evidence,verifiedAt:'bad date'}));
});
test('export is a reimportable draft definition without runtime data or trust',()=>{
 const original={...card,values:{source:'private-path'},evidence:[evidence],approval:'once',secret:'private-key'};
 const raw=exportCapabilityDrafts([original]);
 assert.deepEqual(importCapabilityDrafts(raw),[{...card,state:'draft'}]);
 for(const privateText of ['private-path','private-key','approval','evidence'])assert.equal(raw.includes(privateText),false);
 assert.equal(original.state,'published');assert.equal(original.values.source,'private-path');
});
test('draft import and export enforce UTF-8 bytes, counts and unique identities',()=>{
 const cards=Array.from({length:8},(_,index)=>({...card,id:`card-${index}`,goal:'中'.repeat(4000)}));
 const raw=JSON.stringify(cards);
 assert.ok(raw.length<65536);assert.ok(Buffer.byteLength(raw)>65536);
 assert.throws(()=>importCapabilityDrafts(raw));assert.throws(()=>exportCapabilityDrafts(cards));
 assert.throws(()=>exportCapabilityDrafts([]));assert.throws(()=>exportCapabilityDrafts([card,card]));
 assert.throws(()=>exportCapabilityDrafts(Array.from({length:101},(_,i)=>({...card,id:`c${i}`}))));
});
