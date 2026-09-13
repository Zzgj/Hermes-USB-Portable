import {readFile} from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
const source=await readFile(new URL('../src/domain/capability.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {decodeCapability,decodeVerification,capabilityStatus,bindCapabilityInputs,importCapabilityDrafts,exportCapabilityDrafts,fetchCapabilityDrafts,readInstanceCatalogCards,readInstanceEvidence,importVerificationDrafts,environmentFingerprint}=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
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
test('readInstanceCatalogCards builds a loopback URL with port+token and forces drafts',async()=>{
 const send=async(url,options)=>{
  assert.equal(url,'http://127.0.0.1:9119/api/capabilities/catalog');
  assert.equal(options.credentials,'omit');assert.equal(options.redirect,'error');assert.equal(options.cache,'no-store');
  assert.equal(options.headers.Authorization,'Bearer fixture-token');
  return new Response(JSON.stringify({availability:'unknown',cards:[{...card,secret:'discard'}]}));
 };
 const result=await readInstanceCatalogCards({port:9119,token:'fixture-token'},new AbortController().signal,send);
 assert.equal(result.length,1);assert.equal(result[0].state,'draft');assert.equal(result[0].secret,undefined);
});
test('readInstanceCatalogCards rejects invalid port or empty token',async()=>{
 const ok=async()=>new Response(JSON.stringify({availability:'unknown',cards:[card]}));
 await assert.rejects(readInstanceCatalogCards({port:0,token:'x'},new AbortController().signal,ok));
 await assert.rejects(readInstanceCatalogCards({port:70000,token:'x'},new AbortController().signal,ok));
 await assert.rejects(readInstanceCatalogCards({port:9119,token:''},new AbortController().signal,ok));
 await assert.rejects(readInstanceCatalogCards({port:9119,token:'x'.repeat(4097)},new AbortController().signal,ok));
});
test('readInstanceCatalogCards bounds response size and rejects wrong availability',async()=>{
 const huge=async()=>new Response('x'.repeat(70001));
 await assert.rejects(readInstanceCatalogCards({port:9119,token:'x'},new AbortController().signal,huge));
 const wrong=async()=>new Response(JSON.stringify({availability:'verified',cards:[card]}));
 await assert.rejects(readInstanceCatalogCards({port:9119,token:'x'},new AbortController().signal,wrong));
 const nonArray=async()=>new Response(JSON.stringify({availability:'unknown',cards:'not-array'}));
 await assert.rejects(readInstanceCatalogCards({port:9119,token:'x'},new AbortController().signal,nonArray));
});
test('readInstanceCatalogCards surfaces abort and network failure as CATALOG_FAILED',async()=>{
 const controller=new AbortController();controller.abort();
 await assert.rejects(readInstanceCatalogCards({port:9119,token:'x'},controller.signal,async()=>{throw new Error('network');}));
});
test('importVerificationDrafts forces trusted:false and never accepts external trust',()=>{
 const imported=importVerificationDrafts(JSON.stringify([{...evidence,trusted:true,secret:'discard'}]));
 assert.equal(imported.length,1);assert.equal(imported[0].trusted,false);assert.equal(imported[0].secret,undefined);
 assert.equal(imported[0].capabilityId,'files');assert.equal(imported[0].methodFingerprint,hash);
});
test('importVerificationDrafts rejects oversized, non-array, or malformed records',()=>{
 assert.throws(()=>importVerificationDrafts('x'.repeat(131073)));
 assert.throws(()=>importVerificationDrafts('{}'));
 assert.throws(()=>importVerificationDrafts(JSON.stringify(Array.from({length:501},()=>evidence))));
 assert.throws(()=>importVerificationDrafts(JSON.stringify([{...evidence,checks:[]}])));assert.throws(()=>importVerificationDrafts(JSON.stringify([{...evidence,verifiedAt:'bad'}])));
});
test('readInstanceEvidence builds a loopback URL with port+token and returns untrusted records',async()=>{
 const send=async(url,options)=>{
  assert.equal(url,'http://127.0.0.1:9119/api/capabilities/evidence');
  assert.equal(options.credentials,'omit');assert.equal(options.redirect,'error');assert.equal(options.cache,'no-store');
  assert.equal(options.headers.Authorization,'Bearer fixture-token');
  return new Response(JSON.stringify([{...evidence,trusted:true,secret:'discard'}]));
 };
 const result=await readInstanceEvidence({port:9119,token:'fixture-token'},new AbortController().signal,send);
 assert.equal(result.length,1);assert.equal(result[0].trusted,false);assert.equal(result[0].secret,undefined);
});
test('readInstanceEvidence rejects invalid port or empty token and bounds response size',async()=>{
 const ok=async()=>new Response(JSON.stringify([evidence]));
 await assert.rejects(readInstanceEvidence({port:0,token:'x'},new AbortController().signal,ok));
 await assert.rejects(readInstanceEvidence({port:9119,token:''},new AbortController().signal,ok));
 const huge=async()=>new Response('x'.repeat(140001));
 await assert.rejects(readInstanceEvidence({port:9119,token:'x'},new AbortController().signal,huge));
});
test('readInstanceEvidence surfaces abort and network failure as EVIDENCE_FAILED',async()=>{
 const controller=new AbortController();controller.abort();
 await assert.rejects(readInstanceEvidence({port:9119,token:'x'},controller.signal,async()=>{throw new Error('network');}));
});
test('environmentFingerprint is deterministic and stable for the same catalog',async()=>{
 const card2=decodeCapability({id:'net',name:'Net check',goal:'Check network',method:{kind:'skill',name:'net-check',fingerprint:env},state:'published',inputs:[]});
 const catalog=[card,{...card,id:'unused'}];
 const fp1=await environmentFingerprint(catalog);const fp2=await environmentFingerprint(catalog);
 assert.equal(fp1,fp2);assert.match(fp1,/^[a-f0-9]{64}$/);
 const reordered=[{...card,id:'unused'},card];
 const fp3=await environmentFingerprint(reordered);
 assert.equal(fp1,fp3);
});
test('environmentFingerprint changes when a skill fingerprint changes',async()=>{
 const changed=decodeCapability({id:'files2',name:'Changed',goal:'Changed',method:{kind:'skill',name:'file-sort',fingerprint:env},state:'published',inputs:[]});
 const fp1=await environmentFingerprint([card]);const fp2=await environmentFingerprint([changed]);
 assert.notEqual(fp1,fp2);
});
test('environmentFingerprint rejects an empty catalog',async()=>{
 await assert.rejects(environmentFingerprint([]));
});
