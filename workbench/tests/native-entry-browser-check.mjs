// Opt-in built-page regression: real HTTP/browser, synthetic native adapters.
// Never launches Hermes, a native console, an external browser URL or a model.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {startControlServer} from '../scripts/control-server.mjs';
import {createNativeEntryManager} from '../scripts/native-entry-manager.mjs';
import {createCdpClient,closeOwnedBrowser,waitUntil,chromeEnvironment,createChromeTempRoot} from './s1-browser-driver.mjs';
let root,temp,service,chrome,client,session,stage='setup',failure=null,cleaned=true;
let starts=0,stops=0,opens=0,managedStarts=0,releaseReady,failPrepare=false,denyOpen=false;
const checks=[],controller=new AbortController();
const timer=setTimeout(()=>{controller.abort();client?.close('BROWSER_TIMEOUT');},60000);
const send=(method,params={},sid=session)=>client.send(method,params,sid);
const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw new Error('PAGE_FAILED');return r.result.value;};
const wait=expression=>waitUntil(()=>evaluate(expression),{signal:controller.signal});
const button=text=>`[...document.querySelectorAll('button')].find(b=>b.getClientRects().length&&b.textContent===${JSON.stringify(text)})`;
async function click(text){await wait(`!!(${button(text)})&&!(${button(text)}).disabled`);await evaluate(`(${button(text)}).click()`);}
async function navigate(path){await evaluate(`location.hash=${JSON.stringify('#'+path)}`);await wait(`location.hash===${JSON.stringify('#'+path)}`);}
async function confirm(){await evaluate(`[...document.querySelectorAll('label')].find(l=>l.textContent.includes('我确认本次启动或停止')).querySelector('input').click()`);}
try{
 root=await mkdtemp(join(tmpdir(),'native-browser-'));const home=join(root,'data'),profile=join(root,'profile');
 temp=await createChromeTempRoot();
 for(const path of [home,profile])await mkdir(path);
 const adapter={prepare:async()=>{
  if(failPrepare)throw new Error(typeof failPrepare==='string'?failPrepare:'synthetic preparation failure');
  return {start:()=>{starts++;let closed;
   return {ready:new Promise(resolve=>{releaseReady=resolve;}),closed:new Promise(resolve=>{closed=resolve;}),stop:async()=>{stops++;const result={treeExited:true};closed(result);return result;},open:async()=>{if(denyOpen)throw new Error('DASHBOARD_NOT_READY');opens++;}};
  }};
 }};
 const nativeEntries=await createNativeEntryManager({home,adapters:{cli:adapter,dashboard:adapter}});
 service=await startControlServer({assets:fileURLToPath(new URL('../dist',import.meta.url)),nativeEntries,startInstance:async()=>{managedStarts++;throw new Error('forbidden synthetic managed start');}});
 chrome=spawn(process.env.CHROME_BIN??'/usr/bin/google-chrome',['--headless=new','--remote-debugging-pipe','--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-component-update','--disable-sync','--disable-extensions','--disable-default-apps','--disable-breakpad','--no-proxy-server','--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1',`--user-data-dir=${profile}`,'about:blank'],{env:chromeEnvironment(profile,temp),stdio:['ignore','ignore','ignore','pipe','pipe']});
 client=createCdpClient(chrome.stdio[3],chrome.stdio[4]);
 chrome.once('error',()=>client.close('BROWSER_FAILED'));chrome.once('close',()=>client.close('BROWSER_CLOSED'));
 const target=await send('Target.createTarget',{url:'about:blank'},null);session=(await send('Target.attachToTarget',{targetId:target.targetId,flatten:true},null)).sessionId;
 await send('Page.enable');await send('Runtime.enable');
 await send('Page.addScriptToEvaluateOnNewDocument',{source:'window.__nativeOriginalFetch=window.fetch;'});
 await send('Page.navigate',{url:service.origin+'/#/chat/live?control='+encodeURIComponent(service.token)});
 await wait(`!!(${button('读取服务状态')})`);
 stage='unauthenticated';await navigate('/settings');await wait(`!!(${button('读取原生入口状态')})`);
 assert.equal(await evaluate(`(${button('读取原生入口状态')}).disabled`),true);assert.equal(starts,0);checks.push('no-unauthenticated-or-automatic-start');
 await navigate('/chat/live');await click('读取服务状态');await wait(`document.body.innerText.includes('本管理器没有运行实例')`);
 await navigate('/settings');await click('读取原生入口状态');await wait(`document.body.innerText.includes('本管理器没有持有原生入口')`);
 stage='explicit-start';assert.equal(await evaluate(`(${button('启动原生 Dashboard')}).disabled`),true);await confirm();await click('启动原生 Dashboard');
 await waitUntil(()=>starts===1,{signal:controller.signal});await wait(`document.body.innerText.includes('原生入口正在启动')`);
 assert.equal(await evaluate(`(${button('启动 CLI')}).disabled&&(${button('打开已运行的 Dashboard')}).disabled`),true);checks.push('confirmation-and-starting-state');
 releaseReady({port:12345});await click('读取原生入口状态');await wait(`!(${button('打开已运行的 Dashboard')}).disabled`);
 stage='open';await click('打开已运行的 Dashboard');await waitUntil(()=>opens===1,{signal:controller.signal});await wait(`!(${button('读取原生入口状态')}).disabled`);
 assert.equal(starts,1);assert.equal(managedStarts,0);checks.push('open-owned-dashboard-without-managed-start');
 stage='open-failure';denyOpen=true;await click('打开已运行的 Dashboard');
 await wait(`document.body.innerText.includes('Dashboard 页面尚未通过就绪检查')`);
 assert.equal(opens,1);assert.equal(stops,0);assert.equal(starts,1);
 assert.equal(await evaluate(`(${button('打开已运行的 Dashboard')}).disabled&&(${button('启动 CLI')}).disabled`),true);
 await click('读取原生入口状态');await wait(`!(${button('打开已运行的 Dashboard')}).disabled`);
 assert.equal(await evaluate(`document.body.innerText.includes('Dashboard 页面尚未通过就绪检查')`),false);
 denyOpen=false;checks.push('open-failure-diagnosis-no-restart-and-explicit-refresh');
 stage='stop';await confirm();await click('停止本管理器的原生入口');await wait(`document.body.innerText.includes('本管理器没有持有原生入口')`);assert.equal(stops,1);checks.push('explicit-stop-and-idle-after-lock-release');
 stage='failure';failPrepare=true;await confirm();await click('启动 CLI');await wait(`document.body.innerText.includes('请求失败或结果未知')`);
 assert.equal(await evaluate(`(${button('启动 CLI')}).disabled`),true);assert.equal(starts,1);checks.push('failed-start-unknown-no-retry');
 await click('读取原生入口状态');await wait(`document.body.innerText.includes('本管理器没有持有原生入口')`);
 stage='known-prepare-failure';failPrepare='NATIVE_BASELINE_UNSUPPORTED';await confirm();await click('启动原生 Dashboard');
 await wait(`document.body.innerText.includes('Hermes 源码版本不在本入口已审范围')`);
 assert.equal(starts,1);assert.equal(await evaluate(`(${button('启动原生 Dashboard')}).disabled`),true);
 await click('读取原生入口状态');await wait(`document.body.innerText.includes('本管理器没有持有原生入口')`);
 assert.equal(await evaluate(`document.body.innerText.includes('Hermes 源码版本不在本入口已审范围')`),false);
 checks.push('prepare-refusal-diagnosis-cleared-by-explicit-refresh');
 // Recreate an active diagnosis before revoking the identity; a previously
 // cleared alert cannot prove that revocation hides stale diagnostics.
 await confirm();await click('启动原生 Dashboard');
 await wait(`document.body.innerText.includes('Hermes 源码版本不在本入口已审范围')`);
 stage='identity-revocation';await navigate('/chat/live');
 await evaluate(`(()=>{const input=[...document.querySelectorAll('label')].find(l=>l.textContent.includes('临时管理令牌')).querySelector('input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'synthetic-wrong-token');input.dispatchEvent(new Event('input',{bubbles:true}));})()`);
 await click('读取服务状态');await wait(`document.body.innerText.includes('管理认证或来源校验被拒绝')`);await navigate('/settings');await wait(`!!(${button('读取原生入口状态')})`);
 assert.equal(await evaluate(`(${button('读取原生入口状态')}).disabled&&(${button('启动 CLI')}).disabled`),true);checks.push('revoked-identity-cannot-control-native-entry');
 assert.equal(await evaluate(`document.body.innerText.includes('Hermes 源码版本不在本入口已审范围')`),false);
 assert.equal(starts,1);checks.push('revoked-identity-hides-existing-diagnosis');
 assert.equal(await evaluate('window.fetch===window.__nativeOriginalFetch'),true);checks.push('production-page-native-fetch');
}catch{failure=stage;}
finally{
 clearTimeout(timer);releaseReady?.({port:12345});
 try{await closeOwnedBrowser(chrome,()=>send('Browser.close',{},null));}catch{cleaned=false;}client?.close();
 try{await service?.close();if(service){try{await fetch(service.origin+'/',{signal:AbortSignal.timeout(1000)});cleaned=false;}catch(error){if(error.name==='TimeoutError')cleaned=false;}}}catch{cleaned=false;}
 if(cleaned)for(const path of [root,temp])if(path)try{await rm(path,{recursive:true,force:true});}catch{cleaned=false;}
}
console.log(JSON.stringify({methodVersion:2,status:failure||!cleaned?'failed':'passed',failure,checks,starts,stops,opens,managedStarts,cleaned,hermesModelExecuted:false}));
process.exitCode=failure||!cleaned?1:0;
