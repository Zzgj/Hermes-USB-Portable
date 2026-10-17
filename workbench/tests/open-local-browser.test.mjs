import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {openLocalBrowser} from '../scripts/open-local-browser.mjs';

test('browser opener rejects remote, credentialed and non-HTTP URLs before spawn',()=>{
 let calls=0;const options={spawnBrowser:()=>{calls++;}};
 for(const value of ['https://127.0.0.1:12345/','http://localhost:12345/','http://127.0.0.1/','http://user:pass@127.0.0.1:12345/','file:///tmp/not-an-entry']){
  assert.throws(()=>openLocalBrowser(value,options),/INVALID_LOCAL_BROWSER_URL/);
 }
 assert.equal(calls,0);
});
test('browser opener uses a fixed program without a shell and reports nonzero exit',async()=>{
 for(const code of [0,1]){
  const child=new EventEmitter();let command,args,settings;
  const opening=openLocalBrowser('http://127.0.0.1:12345/',{platform:'linux',spawnBrowser:(...values)=>{
   [command,args,settings]=values;return child;
  }});
  child.emit('exit',code);
  if(code===0)await opening;else await assert.rejects(opening,/BROWSER_OPEN_FAILED/);
  assert.equal(command,'xdg-open');assert.deepEqual(args,['http://127.0.0.1:12345/']);assert.equal(settings.shell,false);
 }
});
test('browser helper deadline terminates only the returned helper handle',async()=>{
 const child=new EventEmitter();let kills=0;child.kill=()=>{kills++;};
 await assert.rejects(openLocalBrowser('http://127.0.0.1:12345/',{platform:'linux',timeoutMs:1,spawnBrowser:()=>child}),/BROWSER_OPEN_FAILED/);
 assert.equal(kills,1);
});
