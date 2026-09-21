import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const compile=source=>ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const url=js=>'data:text/javascript;base64,'+Buffer.from(js).toString('base64');
const dependency=url(compile(await readFile(new URL('../src/domain/capability.ts',import.meta.url),'utf8')));
const code=compile(await readFile(new URL('../src/domain/capability-run.ts',import.meta.url),'utf8')).replace(/(['"])\.\/capability\1/,JSON.stringify(dependency));
const {prepareCapabilityRun}=await import(url(code));
const card={id:'fixture',name:'Fixture',goal:'Synthetic goal',method:{kind:'skill',name:'fixture',fingerprint:'a'.repeat(64)},inputs:[{id:'target',label:'Target',required:true}],state:'draft'};
const reply={prepared:{kind:'capability',cardId:card.id,prompt:'Synthetic request',method:card.method,availability:'unknown'},connection:{port:12345,token:'fixture-token'}};
test('client uses fixed authenticated endpoint and projects inputs without credential persistence',async t=>{
 const original=globalThis.fetch;t.after(()=>{globalThis.fetch=original;});const controller=new AbortController();
 globalThis.fetch=async(path,options)=>{assert.equal(path,'/api/capabilities/prepare');assert.equal(options.credentials,'omit');assert.equal(options.redirect,'error');assert.equal(options.cache,'no-store');assert.equal(options.signal,controller.signal);assert.deepEqual(JSON.parse(options.body).values,{target:'only'});return new Response(JSON.stringify(reply));};
 const result=await prepareCapabilityRun('manager',card,{target:'only',private:'discard'},7,controller.signal);assert.equal(result.epoch,7);assert.equal(result.token,'fixture-token');assert.equal(result.cardId,'fixture');
});
test('invalid input fails before sending, including Bundle and oversized UTF8',async t=>{
 const original=globalThis.fetch;t.after(()=>{globalThis.fetch=original;});let calls=0;globalThis.fetch=async()=>{calls++;throw new Error();};
 for(const [c,v] of [[card,{}],[{...card,method:{...card.method,kind:'bundle'}},{target:'x'}],[{...card,goal:'中'.repeat(4000)},{target:'中'.repeat(4000)}]])await assert.rejects(prepareCapabilityRun('manager',c,v,1,new AbortController().signal));assert.equal(calls,0);
});
test('mismatched method or card, invalid connection and wrong response kinds are rejected',async t=>{
 const original=globalThis.fetch;t.after(()=>{globalThis.fetch=original;});
 for(const value of [{...reply,prepared:{...reply.prepared,cardId:'other'}},{...reply,prepared:{...reply.prepared,method:{...card.method,fingerprint:'b'.repeat(64)}}},{...reply,prepared:{...reply.prepared,kind:'exec'}},{...reply,connection:{port:0,token:'fixture'}},{...reply,prepared:{...reply.prepared,availability:'verified'}}]){globalThis.fetch=async()=>new Response(JSON.stringify(value));await assert.rejects(prepareCapabilityRun('manager',card,{target:'x'},1,new AbortController().signal));}
});
test('oversized and malformed byte streams fail without a prepared request',async t=>{
 const original=globalThis.fetch;t.after(()=>{globalThis.fetch=original;});
 for(const bytes of [new Uint8Array(70001),new Uint8Array([255])]){globalThis.fetch=async()=>new Response(bytes);await assert.rejects(prepareCapabilityRun('manager',card,{target:'x'},1,new AbortController().signal));}
});
