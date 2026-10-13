// Opt-in: actual built React, native fetch, real management HTTP; synthetic files/start failure.
// No Hermes process, RPC or model is started. Only owned browser/profile/listener are cleaned.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {startControlServer} from '../scripts/control-server.mjs';
import {detectEntries} from '../scripts/entry-detect.mjs';
import {createCdpClient,closeOwnedBrowser,waitUntil,chromeEnvironment} from './s1-browser-driver.mjs';
const checks=[],network=[];let root,profile,temp,service,chrome,client,session,stage='setup',failure=null,cleaned=true;
let starts=0,stops=0,entryFailure=false,readinessFailure=false;
let holdStart=false,releaseStart;
const controller=new AbortController(),timer=setTimeout(()=>{controller.abort();client?.close('BROWSER_TIMEOUT');},60000);
const send=(method,params={},sid=session)=>client.send(method,params,sid);
const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw new Error('PAGE_FAILED');return r.result.value;};
const wait=expression=>waitUntil(()=>evaluate(expression),{signal:controller.signal});
const button=text=>`[...document.querySelectorAll('button')].find(b=>b.getClientRects().length&&b.textContent===${JSON.stringify(text)})`;
async function click(text){await wait(`!!(${button(text)})&&!(${button(text)}).disabled`);await evaluate(`(${button(text)}).click()`);}
async function navigate(path){await evaluate(`location.hash=${JSON.stringify('#'+path)}`);await wait(`location.hash===${JSON.stringify('#'+path)}`);}
try{
 root=await mkdtemp(join(tmpdir(),'entry-browser-'));profile=await mkdtemp(join(tmpdir(),'entry-chrome-'));temp=await mkdtemp(tmpdir()+'/');
 const source=join(root,'source');await mkdir(join(source,'hermes_cli'),{recursive:true});await writeFile(join(source,'hermes_cli','main.py'),'# synthetic; never executed');
 const assets=fileURLToPath(new URL('../dist',import.meta.url));
 service=await startControlServer({assets,startInstance:async()=>{starts++;if(holdStart)await new Promise(resolve=>{releaseStart=resolve;});if(!readinessFailure)throw new Error('INSTANCE_LOCKED');return {state:'exited',connection:Promise.reject(new Error('PROCESS_EXITED_BEFORE_READY')),stop:async()=>{stops++;}};},detectEntries:async()=>{if(entryFailure)throw new Error('private diagnostic must not appear');return detectEntries({source,assetsDir:assets});}});
 chrome=spawn(process.env.CHROME_BIN??'/usr/bin/google-chrome',['--headless=new','--remote-debugging-pipe','--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-component-update','--disable-sync','--disable-extensions','--disable-default-apps','--disable-breakpad','--no-proxy-server','--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1',`--user-data-dir=${profile}`,'about:blank'],{env:chromeEnvironment(profile,temp),stdio:['ignore','ignore','ignore','pipe','pipe']});
 client=createCdpClient(chrome.stdio[3],chrome.stdio[4],{onEvent:m=>{if(m.method==='Network.responseReceived'){const r=m.params.response,u=new URL(r.url);if(u.origin===service.origin&&['/api/start','/api/status','/api/entries','/api/stop'].includes(u.pathname))network.push({path:u.pathname,status:r.status});}}});
 chrome.once('error',()=>client.close('BROWSER_FAILED'));chrome.once('close',()=>client.close('BROWSER_CLOSED'));
 const target=await send('Target.createTarget',{url:'about:blank'},null);session=(await send('Target.attachToTarget',{targetId:target.targetId,flatten:true},null)).sessionId;
 await send('Page.enable');await send('Runtime.enable');await send('Network.enable');
 await send('Page.addScriptToEvaluateOnNewDocument',{source:'window.__entryNativeFetch=window.fetch;'});
 await send('Page.navigate',{url:service.origin+'/#/chat/live?control='+encodeURIComponent(service.token)});
 stage='idle-status';await click('读取服务状态');await wait(`document.body.innerText.includes('本管理器没有运行实例')`);
 stage='entry-before-start';await navigate('/settings');await click('检测入口');await wait(`document.body.innerText.includes('hermes_cli 入口文件存在')`);assert.equal(starts,0);checks.push('entry-detection-before-hermes-start');
 stage='entry-refresh-failure';entryFailure=true;await click('检测入口');await wait(`document.body.innerText.includes('检测失败，可重试')`);assert.equal(await evaluate(`document.body.innerText.includes('hermes_cli 入口文件存在')`),false);checks.push('failed-refresh-removes-stale-success');
 entryFailure=false;await click('检测入口');await wait(`document.body.innerText.includes('hermes_cli 入口文件存在')`);checks.push('entry-retry-recovers');
 stage='start-failure';holdStart=true;await navigate('/chat/live');await click('启动本实例并连接');await waitUntil(()=>!!releaseStart,{signal:controller.signal});
 await navigate('/settings');await click('检测入口');await wait(`document.body.innerText.includes('hermes_cli 入口文件存在')`);
 holdStart=false;releaseStart();await wait(`(${button('检测入口')}).disabled`);await wait(`!document.body.innerText.includes('hermes_cli 入口文件存在')`);checks.push('mounted-settings-invalidates-on-management-failure');
 await navigate('/chat/live');await wait(`document.body.innerText.includes('启动本实例失败')`);
 assert.equal(await evaluate(`document.body.innerText.includes('HTTP 500 / INSTANCE_LOCKED')`),true);
 assert.equal(await evaluate(`document.body.innerText.includes('上次管理操作未成功')`),true);
 assert.equal(await evaluate(`(${button('启动本实例并连接')}).disabled`),true);assert.equal(starts,1);checks.push('start-failure-explicit-no-auto-retry');
 stage='status-recovery';await click('读取服务状态');await wait(`!(${button('启动本实例并连接')}).disabled`);assert.equal(starts,1);checks.push('status-recheck-retains-local-credential');
 stage='readiness-failure';readinessFailure=true;await click('启动本实例并连接');await wait(`document.body.innerText.includes('PROCESS_EXITED_BEFORE_READY')`);await click('读取服务状态');await wait(`document.body.innerText.includes('服务已退出，请停止并清理')`);
 assert.equal(await evaluate(`(${button('启动本实例并连接')}).disabled`),true);assert.equal(stops,0);
 await evaluate(`[...document.querySelectorAll('label')].find(l=>l.textContent.includes('我确认停止此管理器')).querySelector('input').click()`);await click('停止本实例');await wait(`document.body.innerText.includes('本管理器没有运行实例')`);assert.equal(stops,1);checks.push('failed-owned-handle-explicit-stop-only');
 stage='forbidden';await evaluate(`(()=>{const input=[...document.querySelectorAll('label')].find(l=>l.textContent.includes('临时管理令牌')).querySelector('input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'synthetic-wrong-token');input.dispatchEvent(new Event('input',{bubbles:true}));})()`);
 await click('读取服务状态');await wait(`document.body.innerText.includes('管理认证或来源校验被拒绝')`);assert.equal(await evaluate(`(${button('读取服务状态')}).disabled`),true);checks.push('forbidden-clears-rejected-credential');
 await navigate('/settings');await wait(`!!(${button('检测入口')})`);assert.equal(await evaluate(`(${button('检测入口')}).disabled`),true);checks.push('settings-cannot-reuse-cleared-credential');
 assert.equal(await evaluate('window.fetch===window.__entryNativeFetch'),true);assert.equal(await evaluate(`document.body.innerText.includes('private diagnostic')`),false);checks.push('native-fetch-and-no-raw-diagnostics');
 assert.ok(network.some(n=>n.path==='/api/start'&&n.status===500));assert.ok(network.some(n=>n.path==='/api/entries'&&n.status===400));assert.ok(network.some(n=>n.path==='/api/status'&&n.status===403));
}catch{failure=stage;}
finally{
 clearTimeout(timer);
 releaseStart?.();
 try{await closeOwnedBrowser(chrome,()=>send('Browser.close',{},null));}catch{cleaned=false;}client?.close();
 try{await service?.close();if(service){try{await fetch(service.origin+'/',{signal:AbortSignal.timeout(1000)});cleaned=false;}catch(e){if(e.name==='TimeoutError')cleaned=false;}}}catch{cleaned=false;}
 for(const p of [root,profile,temp])if(p)try{await rm(p,{recursive:true,force:true});}catch{cleaned=false;}
}
console.log(JSON.stringify({methodVersion:1,status:failure||!cleaned?'failed':'passed',failure,checks,network,starts,stops,cleaned,hermesModelExecuted:false}));
process.exitCode=failure||!cleaned?1:0;
