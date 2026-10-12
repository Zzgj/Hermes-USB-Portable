// Explicit opt-in browser regression. Real management HTTP, synthetic RPC, no Hermes/model.
import {spawn} from 'node:child_process';
import {mkdtemp,readFile,rm,access,stat} from 'node:fs/promises';
import {constants} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,isAbsolute,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {startS1Harness} from './s1-browser-launch.mjs';
import {createCdpClient,closeOwnedBrowser,waitUntil,projectNetwork,chromeEnvironment} from './s1-browser-driver.mjs';

const CASES=Object.freeze([
 'native-fetch-xhr-and-bootstrap-scrub','real-http-connection-reconnect',
 'browser-catalog-export-real-http','real-http-prepare-no-submit-before-confirmation',
 'double-click-one-submit-real-second-prepare','changed-skill-real-http-rejection-no-submit',
 'cancel-reimport-held-prepare-no-stale-review',
 'disconnect-during-real-second-prepare-no-replay','explicit-reconnect-no-replay',
 'observed-real-http-network-statuses',
 'transcript-view-persists-and-reopens','transcript-error-visible-and-retryable',
 'transcript-switch-session','transcript-main-chat-still-works',
 'transcript-close-blocks-late-success','transcript-close-blocks-late-error',
 'transcript-disconnect-blocks-late-response','transcript-reconnect-new-request-isolates-old'
]);
const failures=new Set(['BROWSER_UNAVAILABLE','BUILD_REQUIRED','BROWSER_INTERRUPTED','BROWSER_TIMEOUT','CDP_CLOSED','CDP_PROTOCOL','CDP_REJECTED','CDP_TIMEOUT','PAGE_EVALUATION_FAILED','UI_WAIT_TIMEOUT','CHECK_FAILED']);
async function findChrome(explicit){
 const candidates=explicit!==undefined?[explicit]:['/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser'];
 for(const candidate of candidates){
  if(!isAbsolute(candidate))continue;
  try{await access(candidate,constants.X_OK);if((await stat(candidate)).isFile())return candidate;}catch{}
 }
 throw new Error('BROWSER_UNAVAILABLE');
}
async function absent(path){try{await access(path);return false;}catch(error){return error.code==='ENOENT';}}

export async function runS1BrowserCheck({chromePath=process.env.CHROME_BIN,signal}={}){
 const results=[],network=[];let chrome,h,profile,browserTemp,session,client,failure=null,cleaned=true;
 const controller=new AbortController();
 const interrupt=()=>{controller.abort();client?.close('BROWSER_INTERRUPTED');};
 signal?.addEventListener('abort',interrupt,{once:true});if(signal?.aborted)interrupt();
 const timer=setTimeout(()=>{controller.abort();client?.close('BROWSER_TIMEOUT');},120000);
 const send=(method,params={},sid=session)=>client.send(method,params,sid);
async function evaluate(expression){const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw new Error('PAGE_EVALUATION_FAILED');return r.result.value;}
async function wait(expression){await waitUntil(()=>evaluate(expression),{signal:controller.signal});}
async function click(text){await wait(`!![...document.querySelectorAll('button')].find(b=>b.textContent===${JSON.stringify(text)}&&!b.disabled)`);await evaluate(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent===${JSON.stringify(text)});if(!b||b.disabled)throw Error();b.click();})()`);}
let importGeneration=0;
async function importCard(c){c={...c,name:c.name+' import '+(++importGeneration)};await evaluate(`(()=>{const input=document.querySelector('input[type=file]'),dt=new DataTransfer();dt.items.add(new File([${JSON.stringify(JSON.stringify([c]))}],'draft.json',{type:'application/json'}));input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));})()`);await wait(`!![...document.querySelectorAll('button')].find(b=>b.textContent===${JSON.stringify(c.name)}&&!b.disabled)`);await click('核对本次参数');await wait(`!![...document.querySelectorAll('button')].find(b=>b.textContent==='核对实例方法并审阅请求')`);}
async function prepareReview(){await click('核对实例方法并审阅请求');await wait(`!![...document.querySelectorAll('button')].find(b=>b.textContent==='重新核验并发送一次')`);}
const submissions=()=>evaluate(`window.__p2RpcRequests.filter(r=>r.method==='prompt.submit').length`);
function record(name){if(name!==CASES[results.length])throw new Error('CHECK_FAILED');results.push({name,passed:true});}
try{
 if(controller.signal.aborted)throw new Error('BROWSER_INTERRUPTED');
 const executable=await findChrome(chromePath);
 try{await access(new URL('../dist/index.html',import.meta.url));}catch{throw new Error('BUILD_REQUIRED');}
 h=await startS1Harness();profile=await mkdtemp(join(tmpdir(),'p2-s1-browser-'));
 browserTemp=await mkdtemp(tmpdir()+sep);
 chrome=spawn(executable,['--headless=new','--remote-debugging-pipe','--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-component-update','--disable-sync','--disable-extensions','--disable-default-apps','--disable-breakpad','--no-proxy-server','--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1',`--user-data-dir=${profile}`,'about:blank'],{env:chromeEnvironment(profile,browserTemp),stdio:['ignore','ignore','ignore','pipe','pipe']});
 client=createCdpClient(chrome.stdio[3],chrome.stdio[4],{onEvent:message=>{
  if(message.method==='Network.responseReceived'){
   const item=projectNetwork(message.params?.response,h.origin);if(item&&network.length<100)network.push(item);
  }
 }});
 chrome.once('error',()=>client.close('CDP_CLOSED'));chrome.once('close',()=>client.close('CDP_CLOSED'));
 if(controller.signal.aborted)interrupt();
 const target=await send('Target.createTarget',{url:'about:blank'},null);session=(await send('Target.attachToTarget',{targetId:target.targetId,flatten:true},null)).sessionId;
 await send('Page.enable');await send('Runtime.enable');await send('Network.enable');
 const fixture=await readFile(new URL('./s1-rpc-only-fixture.js',import.meta.url),'utf8');
 await send('Page.addScriptToEvaluateOnNewDocument',{source:'window.__nativeFetch=window.fetch;window.__nativeXHR=window.XMLHttpRequest;\n'+fixture});
 await send('Page.navigate',{url:h.origin+'/#/chat/live?control='+encodeURIComponent(h.token)});
 await wait(`!![...document.querySelectorAll('button')].find(b=>b.textContent==='读取服务状态'&&!b.disabled)`);
 assert.equal(await evaluate(`window.fetch===window.__nativeFetch&&window.XMLHttpRequest===window.__nativeXHR`),true);
 assert.equal(await evaluate(`location.hash.includes('control=')`),false);record('native-fetch-xhr-and-bootstrap-scrub');
 await click('读取服务状态');await wait(`!![...document.querySelectorAll('button')].find(b=>b.textContent==='启动本实例并连接'&&!b.disabled)`);
 await click('启动本实例并连接');await wait(`window.__p2RpcRequests.some(r=>r.method==='session.create')`);
 await click('断开测试会话');await wait(`!![...document.querySelectorAll('button')].find(b=>b.textContent==='连接本实例'&&!b.disabled)`);
 await click('连接本实例');await wait(`window.__p2RpcRequests.filter(r=>r.method==='session.create').length===2`);record('real-http-connection-reconnect');
 await evaluate(`(()=>{const native=URL.createObjectURL;URL.createObjectURL=function(blob){window.__catalogBlob=blob;return native.call(this,blob);};})()`);
 await click('读取并导出未验证草稿');await wait(`!!window.__catalogBlob`);
 const c=JSON.parse(await evaluate(`window.__catalogBlob.text()`))[0];record('browser-catalog-export-real-http');
 await evaluate(`document.querySelector('a[href="#/capabilities"]').click()`);await wait(`!!document.querySelector('input[type=file]')`);
 await importCard(c);await prepareReview();assert.equal(await submissions(),0);
 assert.equal(await evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent==='重新核验并发送一次').disabled`),true);record('real-http-prepare-no-submit-before-confirmation');
 await evaluate(`[...document.querySelectorAll('label')].find(x=>x.textContent.includes('我确认发送本次请求')).querySelector('input').click()`);
 // Count actual synthetic RPC calls, never infer submission from a response field.
 await evaluate(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent==='重新核验并发送一次');b.click();b.click();})()`);
 await wait(`document.body.innerText.includes('请求已交给当前会话')`);assert.equal(await submissions(),1);assert.equal(h.stats.prepareCalls,2);record('double-click-one-submit-real-second-prepare');
 await importCard(c);await prepareReview();await h.changeSkill();await evaluate(`[...document.querySelectorAll('label')].find(x=>x.textContent.includes('我确认发送本次请求')).querySelector('input').click()`);await click('重新核验并发送一次');
 await wait(`!!document.querySelector('[role=alert]')`);assert.equal(await submissions(),1);assert.equal(h.stats.changedRejections,1);record('changed-skill-real-http-rejection-no-submit');
 const changed=(await(await fetch(h.origin+'/api/capabilities/catalog',{signal:AbortSignal.timeout(5000),headers:{Authorization:`Bearer ${h.token}`}})).json()).cards[0];
 await importCard(changed);h.holdNextPrepare();await click('核对实例方法并审阅请求');await waitUntil(()=>h.stats.held,{signal:controller.signal});
 assert.equal(await evaluate(`document.querySelector('input[type=file]').disabled`),true);
 // Selecting the current card is the real UI cancellation path, not a private handler.
 await evaluate(`document.querySelector('button[aria-pressed="true"]').click()`);
 await wait(`!document.querySelector('input[type=file]').disabled`);
 await importCard(changed);h.releasePrepare();await waitUntil(()=>!h.stats.held,{signal:controller.signal});
 await new Promise(r=>setTimeout(r,100));
 assert.equal(await evaluate(`[...document.querySelectorAll('button')].some(b=>b.textContent==='重新核验并发送一次')`),false);
 assert.equal(await submissions(),1);record('cancel-reimport-held-prepare-no-stale-review');
 await prepareReview();await evaluate(`[...document.querySelectorAll('label')].find(x=>x.textContent.includes('我确认发送本次请求')).querySelector('input').click()`);h.holdNextPrepare();await click('重新核验并发送一次');await waitUntil(()=>h.stats.held,{signal:controller.signal});
 await evaluate(`window.__p2Socket.close()`);h.releasePrepare();await wait(`![...document.querySelectorAll('button')].some(b=>b.textContent==='重新核验并发送一次')`);
 await new Promise(r=>setTimeout(r,100));assert.equal(await submissions(),1);record('disconnect-during-real-second-prepare-no-replay');
 const sessionsBeforeReconnect=await evaluate(`window.__p2RpcRequests.filter(r=>r.method==='session.create').length`);
 await evaluate(`document.querySelector('a[href="#/chat/live"]').click()`);
 await click('连接本实例');await wait(`window.__p2RpcRequests.filter(r=>r.method==='session.create').length===${sessionsBeforeReconnect+1}`);
 await evaluate(`document.querySelector('a[href="#/capabilities"]').click()`);
 await wait(`!!document.querySelector('input[type=file]')`);
 await new Promise(r=>setTimeout(r,100));assert.equal(await submissions(),1);
 assert.equal(await evaluate(`[...document.querySelectorAll('button')].some(b=>b.textContent==='重新核验并发送一次')`),false);
 record('explicit-reconnect-no-replay');
 assert.equal(await evaluate(`window.fetch===window.__nativeFetch&&window.XMLHttpRequest===window.__nativeXHR`),true);
 for(const path of ['/','/api/status','/api/start','/api/connection','/api/capabilities/catalog','/api/capabilities/prepare'])assert.ok(network.some(r=>r.path===path&&r.status===200));
 assert.ok(network.some(r=>r.path==='/api/capabilities/prepare'&&r.status===400));record('observed-real-http-network-statuses');
 // --- Transcript view lifecycle tests ---
 // LiveChatPage stays mounted in a hidden div; interact with its buttons directly
 await wait(`!![...document.querySelectorAll('button')].find(b=>b.textContent==='读取最近 50 条会话')`);
 // If button is disabled, reconnect to clear streaming state
 const listDisabled=await evaluate(`!![...document.querySelectorAll('button')].find(b=>b.textContent==='读取最近 50 条会话'&&b.disabled)`);
 if(listDisabled){
  // Navigate to /chat/live via the Shell nav to make the page visible
  await evaluate(`(()=>{const link=[...document.querySelectorAll('a')].find(a=>a.getAttribute('href')==='#/chat');if(link)link.click();})()`);
  await new Promise(r=>setTimeout(r,300));
  // Disconnect and reconnect
  await evaluate(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent==='断开测试会话');if(b&&!b.disabled)b.click();})()`);
  await new Promise(r=>setTimeout(r,300));
  await wait(`!![...document.querySelectorAll('button')].find(b=>b.textContent==='连接本实例'&&!b.disabled)`);
  await click('连接本实例');
  await wait(`window.__p2RpcRequests.some(r=>r.method==='session.create')`);
 }
 await wait(`!![...document.querySelectorAll('button')].find(b=>b.textContent==='读取最近 50 条会话'&&!b.disabled)`);
 h.setTranscript('hist-1',{session_id:'hist-1',messages:[{role:'user',content:'Hello history'},{role:'assistant',content:'Hi from history'}]});
 h.setTranscript('hist-2',{session_id:'hist-2',messages:[]});
 await click('读取最近 50 条会话');
 await wait(`!![...document.querySelectorAll('button')].some(b=>b.textContent==='只读查看最近 50 条')`);
 const clickView=async(idx=0)=>{await wait(`(()=>{const bs=[...document.querySelectorAll('button')].filter(b=>b.textContent==='只读查看最近 50 条');return bs[${idx}]&&!bs[${idx}].disabled;})()`);await evaluate(`(()=>{const bs=[...document.querySelectorAll('button')].filter(b=>b.textContent==='只读查看最近 50 条');bs[${idx}].click();})()`);};
 // Case: transcript-view-persists-and-reopens — content persists, close, reopen
 await clickView(0);
 await wait(`document.body.innerText.includes('Hello history')`);
 await new Promise(r=>setTimeout(r,300));
 assert.equal(await evaluate(`document.body.innerText.includes('Hello history')`),true,'content must persist after delay');
 await click('关闭历史正文');
 await wait(`!document.body.innerText.includes('Hello history')`);
 await clickView(0);
 await wait(`document.body.innerText.includes('Hello history')`);
 record('transcript-view-persists-and-reopens');
 // Case: transcript-error-visible-and-retryable — error shows, retry succeeds
 await click('关闭历史正文');
 h.setTranscriptMode('forbidden');
 await clickView(0);
 await wait(`!!document.querySelector('[role=alert]')`);
 assert.equal(await evaluate(`document.body.innerText.includes('Hello history')`),false,'no content on error');
 h.setTranscriptMode('normal');
 await clickView(0);
 await wait(`document.body.innerText.includes('Hello history')`);
 record('transcript-error-visible-and-retryable');
 // Case: transcript-switch-session — switch to empty session
 await click('关闭历史正文');
 await clickView(1);
 await wait(`document.body.innerText.includes('本页没有可显示的纯文本消息')`);
 record('transcript-switch-session');
 // Case: transcript-main-chat-still-works — actually send a message and verify display
 await click('关闭历史正文');
 const subBefore=await submissions();
 await evaluate(`(()=>{const ta=document.querySelector('#live-message');ta.value='test after transcript';ta.dispatchEvent(new Event('input',{bubbles:true}));})()`);
 await click('发送真实消息');
 await wait(`document.body.innerText.includes('test after transcript')`);
 assert.equal(await submissions(),subBefore+1,'main chat must send after transcript viewing');
 await wait(`document.body.innerText.includes('Synthetic RPC reply')`);
 record('transcript-main-chat-still-works');
 // Case: transcript-close-blocks-late-success — close while loading, late success must not appear
 await click('关闭历史正文');
 h.setTranscriptMode('normal');
 h.holdNextTranscript(); // hold the HTTP response so it arrives after close
 await clickView(0);
 await new Promise(r=>setTimeout(r,200)); // ensure fetch is in-flight
 await click('关闭历史正文');
 h.releaseHeldTranscript(); // release the held response now — it must not update the closed view
 await new Promise(r=>setTimeout(r,300));
 assert.equal(await evaluate(`document.body.innerText.includes('Hello history')`),false,'late success must not appear after close');
 record('transcript-close-blocks-late-success');
 // Case: transcript-close-blocks-late-error — close while loading, late error must not appear
 h.setTranscriptMode('forbidden');
 h.holdNextTranscript(); // hold the HTTP error response
 await clickView(0);
 await new Promise(r=>setTimeout(r,200));
 await click('关闭历史正文');
 h.releaseHeldTranscript(); // release the held error response
 await new Promise(r=>setTimeout(r,300));
 assert.equal(await evaluate(`!!document.querySelector('[role=alert]')`),false,'late error must not appear after close');
 h.setTranscriptMode('normal');
 record('transcript-close-blocks-late-error');
 // Case: transcript-disconnect-blocks-late-response — disconnect during loading, late response must not show
 await clickView(0);
 await evaluate(`window.__p2Socket.close()`); // simulate disconnect
 await new Promise(r=>setTimeout(r,300));
 await wait(`!document.body.innerText.includes('Hello history')`);
 assert.equal(await evaluate(`!!document.querySelector('[role=alert]')`),false,'no transcript error after disconnect (phase changed)');
 record('transcript-disconnect-blocks-late-response');
 // Case: transcript-reconnect-new-request-isolates-old — reconnect, new view, old late response must not interfere
 // After disconnect we're still on /chat/live; ServiceControls shows connect button
 await wait(`!![...document.querySelectorAll('button')].find(b=>b.textContent==='连接本实例'&&!b.disabled)`);
 await click('连接本实例');
 await wait(`!![...document.querySelectorAll('button')].find(b=>b.textContent==='读取最近 50 条会话'&&!b.disabled)`);
 await click('读取最近 50 条会话');
 await wait(`!![...document.querySelectorAll('button')].find(b=>b.textContent==='只读查看最近 50 条')`);
 h.setTranscript('hist-1',{session_id:'hist-1',messages:[{role:'user',content:'New session content'}]});
 await clickView(0);
 await wait(`document.body.innerText.includes('New session content')`);
 assert.equal(await evaluate(`document.body.innerText.includes('Hello history')`),false,'old content must not appear');
 record('transcript-reconnect-new-request-isolates-old');
 assert.equal(results.length,CASES.length);
}catch(error){failure=failures.has(error.message)?error.message:'CHECK_FAILED';}
finally{
 clearTimeout(timer);signal?.removeEventListener('abort',interrupt);
 // Attempt all cleanup steps even if one fails. Do not print raw errors or runtime URLs.
 try{await closeOwnedBrowser(chrome,()=>send('Browser.close',{},null));}catch{cleaned=false;}
 client?.close();
 if(h){
  try{
   await h.close();if(!await absent(h.home))cleaned=false;
   try{await fetch(h.origin+'/',{signal:AbortSignal.timeout(1500)});cleaned=false;}
   catch(error){if(error.name==='TimeoutError')cleaned=false;}
  }catch{cleaned=false;}
 }
 if(profile){try{await rm(profile,{recursive:true,force:true});if(!await absent(profile))cleaned=false;}catch{cleaned=false;}}
 if(browserTemp){try{await rm(browserTemp,{recursive:true,force:true});if(!await absent(browserTemp))cleaned=false;}catch{cleaned=false;}}
}
 if(!cleaned)failure='BROWSER_CLEANUP_FAILED';
 return {methodVersion:2,status:failure?'failed':'passed',failure,results,network,cleaned,rpc:'synthetic',hermesModelExecuted:false};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const controller=new AbortController(),interrupt=()=>controller.abort();
 process.once('SIGINT',interrupt);process.once('SIGTERM',interrupt);
 try{
  const report=await runS1BrowserCheck({signal:controller.signal});
  process.stdout.write(JSON.stringify(report)+'\n');process.exitCode=report.status==='passed'?0:1;
 }finally{process.removeListener('SIGINT',interrupt);process.removeListener('SIGTERM',interrupt);}
}
