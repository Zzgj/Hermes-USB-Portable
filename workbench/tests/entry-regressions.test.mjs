import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {detectEntries} from '../scripts/entry-detect.mjs';
test('production detector rejects directories named as entry files',async t=>{
 const root=await mkdtemp(join(tmpdir(),'entry-regression-'));t.after(()=>rm(root,{recursive:true,force:true}));
 await mkdir(join(root,'hermes_cli','main.py'),{recursive:true});await mkdir(join(root,'index.html'));
 const entries=await detectEntries({source:root,assetsDir:root});
 assert.equal(entries.find(e=>e.kind==='cli').available,false);
 assert.equal(entries.find(e=>e.kind==='web').available,false);
});
function harness(){
 const slots=[],reads=[],cleanups=[];let cursor=0;
 const react={useState(initial){const i=cursor++;if(!(i in slots))slots[i]=initial;return [slots[i],v=>slots[i]=v];},useRef(initial){const i=cursor++;return slots[i]??(slots[i]={current:initial});},useCallback(fn){return fn;},useEffect(fn){const i=cursor++;if(!(i in slots)){slots[i]=true;cleanups.push(fn());}}};
 const module={exports:{}};
 const source=ts.transpileModule(readFileSync(new URL('../src/hooks/useEntryDetect.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 new Function('require','module','exports','fetch',source)(s=>s==='react'?react:{decodeEntryList:v=>v},module,module.exports,(_url,options)=>new Promise((resolve,reject)=>reads.push({resolve,reject,options})));
 return {render(){cursor=0;return module.exports.useEntryDetect();},reads,unmount(){cleanups.forEach(f=>f?.());}};
}
for(const result of ['success','error','http'])test(`old ${result} cannot change a newer entry request`,async()=>{
 const h=harness(),a=h.render().detect('first'),b=h.render().detect('second');
 if(result==='error')h.reads[0].reject(new Error('old'));else h.reads[0].resolve({ok:result==='success',status:403,json:async()=>['old']});
 await a;assert.equal(h.render().loading,true);assert.equal(h.render().error,null);assert.equal(h.render().entries,null);
 h.reads[1].resolve({ok:true,json:async()=>['new']});await b;assert.deepEqual(h.render().entries,['new']);h.unmount();
});
test('failed refresh cannot retain apparently current success',async()=>{
 const h=harness();let p=h.render().detect('token');h.reads[0].resolve({ok:true,json:async()=>['old']});await p;
 p=h.render().detect('token');h.reads[1].resolve({ok:false,status:403});await p;
 assert.equal(h.render().entries,null);assert.equal(h.render().error,'FORBIDDEN');h.unmount();
});
test('unmount aborts an entry read',async()=>{
 const h=harness(),p=h.render().detect('token');h.unmount();assert.equal(h.reads[0].options.signal.aborted,true);
 h.reads[0].resolve({ok:true,json:async()=>['late']});await p;assert.equal(h.render().entries,null);
});
// Hook scheduler is synthetic; decoder is stubbed here, not in the browser regression.
for(const outcome of ['success','error'])test(`late body ${outcome} cannot overwrite completed newer results`,async()=>{
 const h=harness(),old=h.render().detect('first');let release,reject,entered;
 const barrier=new Promise(resolve=>{entered=resolve;});
 h.reads[0].resolve({ok:true,json:()=>{entered();return new Promise((yes,no)=>{release=yes;reject=no;});}});
 await barrier;
 const current=h.render().detect('second');h.reads[1].resolve({ok:true,json:async()=>['current']});await current;
 if(outcome==='success')release(['stale']);else reject(new Error('late body'));
 await old;assert.deepEqual(h.render().entries,['current']);assert.equal(h.render().error,null);assert.equal(h.render().loading,false);h.unmount();
});
