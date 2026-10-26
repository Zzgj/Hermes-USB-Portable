import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createNativeEntryAdapters,NATIVE_BASELINE} from '../scripts/native-entry-adapters.mjs';

async function fixture(t){
 const root=await mkdtemp(join(tmpdir(),'native-adapter-'));
 t.after(()=>rm(root,{recursive:true,force:true}));
 const source=join(root,'source'),home=join(root,'data'),python=join(root,'python');
 await mkdir(join(source,'hermes_cli','web_dist'),{recursive:true});await mkdir(home);
 await writeFile(join(source,'hermes_cli','main.py'),'fixture only');
 await writeFile(join(source,'hermes_cli','web_dist','index.html'),'fixture only');await writeFile(python,'fixture only');
 let current=NATIVE_BASELINE,dirty=false,launches=[],opened=[],finish,ready,probeResult=true,pageResult=true;
 const adapters=createNativeEntryAdapters({python,source,environment:{PATH:'synthetic'},git:'synthetic',openBrowser:async url=>{opened.push(url);}}, {
  platform:'win32',inspect:()=>({commit:current,tracked_changes:dirty}),
  start:options=>{launches.push(options);return {ready:new Promise(resolve=>{ready=resolve;}),closed:new Promise(resolve=>{finish=resolve;}),stop:async()=>{finish({treeExited:true});}};},
  probe:async()=>probeResult,
  probePage:async options=>typeof pageResult==='function'?pageResult(options):pageResult,
 });
 return {adapters,source,home,launches,opened,setBaseline:value=>{current=value;},setDirty:()=>{dirty=true;},setProbe:value=>{probeResult=value;},setPage:value=>{pageResult=value;},ready:value=>ready(value),finish:()=>finish({treeExited:true})};
}
test('fixed CLI command is prepared under caller home without launching',async t=>{
 const f=await fixture(t);const prepared=await f.adapters.cli.prepare({home:f.home});
 assert.equal(f.launches.length,0);
 const child=prepared.start();f.ready({});await child.ready;
 assert.deepEqual(f.launches[0].args,['-m','hermes_cli.main','--cli']);
 assert.equal(f.launches[0].environment.HERMES_HOME,f.home);
 f.finish();await child.closed;
});
test('unreviewed baseline and dirty source fail before launch',async t=>{
 const f=await fixture(t);f.setBaseline('0'.repeat(40));
 await assert.rejects(f.adapters.cli.prepare({home:f.home}),/NATIVE_BASELINE_UNSUPPORTED/);
 f.setBaseline(NATIVE_BASELINE);f.setDirty();
 await assert.rejects(f.adapters.dashboard.prepare({home:f.home}),/SOURCE_REVIEW_REQUIRED/);
 assert.equal(f.launches.length,0);
});
test('Dashboard requires reviewed prebuilt assets and disables automatic build/open',async t=>{
 const f=await fixture(t);const prepared=await f.adapters.dashboard.prepare({home:f.home});
 const child=prepared.start();
 assert.deepEqual(f.launches[0].args,['-m','hermes_cli.main','dashboard','--isolated','--host','127.0.0.1','--port','0','--no-open','--skip-build']);
 assert.equal(f.launches[0].environment.HERMES_WEB_DIST,join(f.source,'hermes_cli','web_dist'));
 assert.equal(f.opened.length,0);
 await assert.rejects(child.open(),/DASHBOARD_NOT_READY/);
 f.ready({port:12345});await child.ready;await child.open();
 assert.deepEqual(f.opened,['http://127.0.0.1:12345/']);
 f.setProbe(false);await assert.rejects(child.open(),/DASHBOARD_NOT_READY/);
 f.finish();await child.closed;await assert.rejects(child.open(),/DASHBOARD_NOT_READY/);
});
test('missing assets or source env are rejected without spawning',async t=>{
 const f=await fixture(t);await rm(join(f.source,'hermes_cli','web_dist','index.html'));
 await assert.rejects(f.adapters.dashboard.prepare({home:f.home}),{message:'NATIVE_ASSET_INVALID'});
 await writeFile(join(f.source,'.env'),'synthetic fixture, not a credential');
 await assert.rejects(f.adapters.cli.prepare({home:f.home}),/SOURCE_ENV_REQUIRES_REVIEW/);
 assert.equal(f.launches.length,0);
});

test('missing asset directories and directory-as-page return a fixed reason before spawn',async t=>{
 for(const scenario of ['missing-directory','directory-as-page']){
  const f=await fixture(t),dist=join(f.source,'hermes_cli','web_dist');
  if(scenario==='missing-directory')await rm(dist,{recursive:true});
  else{await rm(join(dist,'index.html'));await mkdir(join(dist,'index.html'));}
  await assert.rejects(f.adapters.dashboard.prepare({home:f.home}),{message:'NATIVE_ASSET_INVALID'});
  assert.equal(f.launches.length,0);assert.deepEqual(f.opened,[]);
 }
});

test('healthy RPC alone cannot mark an unavailable Dashboard page ready or open it',async t=>{
 const f=await fixture(t);f.setPage(false);
 const prepared=await f.adapters.dashboard.prepare({home:f.home}),child=prepared.start();
 assert.equal(await f.launches[0].probe(12345,new AbortController().signal),false);
 f.ready({port:12345});await child.ready;
 await assert.rejects(child.open(),/DASHBOARD_NOT_READY/);assert.deepEqual(f.opened,[]);
 f.finish();await child.closed;
});

test('stopping while the page check is held cannot open a late Dashboard result',async t=>{
 const f=await fixture(t);const child=(await f.adapters.dashboard.prepare({home:f.home})).start();
 f.ready({port:12345});await child.ready;
 let entered,release,signal;const barrier=new Promise(resolve=>{entered=resolve;});
 f.setPage(options=>{signal=options.signal;entered();return new Promise(resolve=>{release=resolve;});});
 const opening=child.open();await barrier;await child.stop();assert.equal(signal.aborted,true);
 release(true);await assert.rejects(opening,/DASHBOARD_NOT_READY/);assert.deepEqual(f.opened,[]);
});

test('failed authenticated RPC never probes or opens the Dashboard page',async t=>{
 const f=await fixture(t);f.setProbe(false);f.setPage(()=>assert.fail('page must not be requested'));
 const child=(await f.adapters.dashboard.prepare({home:f.home})).start();
 assert.equal(await f.launches[0].probe(12345,new AbortController().signal),false);
 f.ready({port:12345});await child.ready;await assert.rejects(child.open(),/DASHBOARD_NOT_READY/);
 assert.deepEqual(f.opened,[]);f.finish();await child.closed;
});
