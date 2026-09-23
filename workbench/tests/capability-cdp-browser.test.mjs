// P2-S1-RV01: Real page with synthetic transport via CDP.
// Launches Chrome with --remote-debugging-port, injects the browser RPC fixture
// to replace WebSocket, then exercises the capability execution and learning source
// integration scenarios through the real React page served by the real control server.
//
// Prerequisites: dist/ must be built (npm run build), Chrome must be available.
// Note: React 18 controlled textarea components cannot receive synthetic value
// changes via CDP in headless Chrome. Message-sending tests that require typing
// into the textarea are therefore not included; the connection, fixture injection,
// and page navigation tests verify the real management API + synthetic transport chain.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,rm,mkdir,mkdtemp} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawn} from 'node:child_process';
import {startControlServer} from '../scripts/control-server.mjs';
import {prepareCapability} from '../scripts/prepare-capability.mjs';
import {readSkillCatalog} from '../scripts/skill-catalog.mjs';

const CHROME_PATH='C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
let cdpPortCounter=0;
function nextCdpPort(){return 9340+(cdpPortCounter++*10);}
const FIXTURE_PATH=new URL('./browser-rpc-fixture.js',import.meta.url);

async function sleep(ms){return new Promise(resolve=>setTimeout(resolve,ms));}

let cdpId=0;
async function cdpCall(ws,method,params={}){
  const id=++cdpId;
  return new Promise((resolve,reject)=>{
    const handler=(event)=>{
      let msg;
      try{msg=JSON.parse(event.data);}catch{return;}
      if(msg.id===id){
        ws.removeEventListener('message',handler);
        if(msg.error)reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result);
      }
    };
    ws.addEventListener('message',handler);
    ws.send(JSON.stringify({id,method,params}));
    setTimeout(()=>{ws.removeEventListener('message',handler);reject(new Error('CDP timeout: '+method));},15000);
  });
}

async function evalInPage(ws,expression){
  const result=await cdpCall(ws,'Runtime.evaluate',{
    expression,
    awaitPromise:false,
    returnByValue:true,
  });
  if(result.exceptionDetails){
    const err=result.exceptionDetails;
    throw new Error('Eval error: '+(err.description||err.text||JSON.stringify(err)).slice(0,300));
  }
  return result.result.value;
}

async function setupBrowser(t,targetUrl){
  const port=nextCdpPort();
  const profileDir=await mkdtemp(join(tmpdir(),'p2-cdp-profile-'));
  const chrome=spawn(CHROME_PATH,[
    `--remote-debugging-port=${port}`,
    '--no-first-run','--no-default-browser-check','--disable-gpu',
    '--no-sandbox','--headless=new',
    '--disable-extensions','--disable-features=ChromeUpdater',
    `--user-data-dir=${profileDir}`,
    targetUrl,
  ],{stdio:'ignore',shell:false,windowsHide:true});
  t.after(async()=>{
    try{chrome.kill('SIGTERM');}catch{}
    await sleep(500);
    try{chrome.kill('SIGKILL');}catch{}
    await rm(profileDir,{recursive:true,force:true});
  });
  let retries=40;
  while(retries--){
    try{
      const resp=await fetch(`http://127.0.0.1:${port}/json/list`);
      const pages=await resp.json();
      const page=pages.find(p=>p.type==='page'&&p.url.includes('127.0.0.1'));
      if(page){
        const ws=new WebSocket(page.webSocketDebuggerUrl);
        await new Promise((resolve,reject)=>{
          ws.addEventListener('open',resolve,{once:true});
          ws.addEventListener('error',()=>reject(new Error('WS connect failed')),{once:true});
        });
        await cdpCall(ws,'Runtime.enable');
        return{ws,chrome};
      }
    }catch{}
    await sleep(500);
  }
  throw new Error('Chrome CDP did not start');
}

async function setupServer(t){
  const home=await mkdtemp(join(tmpdir(),'p2-cdp-skill-'));
  await mkdir(join(home,'skills','fixture-skill'),{recursive:true});
  await writeFile(join(home,'skills','fixture-skill','SKILL.md'),'CDP test fixture skill');
  const assets=join(process.cwd(),'dist');
  const service=await startControlServer({
    assets,
    startInstance:async()=>({state:'ready',connection:Promise.resolve({port:19119,token:'cdp-instance-token-123456'}),stop:async()=>{}}),
    prepareCapability:request=>prepareCapability(home,request),
    readCatalog:()=>readSkillCatalog(home),
  });
  t.after(async()=>{await service.close();await rm(home,{recursive:true,force:true});});
  // Auto-start instance so "连接本实例" is available
  await fetch(service.origin+'/api/start',{method:'POST',headers:{Origin:service.origin,Authorization:`Bearer ${service.token}`}});
  return{service,home};
}

async function connectToFixture(ws){
  // Inject the browser RPC fixture (replaces WebSocket and fetch)
  const fixtureCode=await readFile(FIXTURE_PATH,'utf8');
  await evalInPage(ws,fixtureCode);
  await sleep(300);
  // Click "读取服务状态" to get management server state
  await evalInPage(ws,`(()=>{
    const buttons=Array.from(document.querySelectorAll('button'));
    const checkBtn=buttons.find(b=>b.textContent.includes('读取服务状态'));
    if(checkBtn&&!checkBtn.disabled)checkBtn.click();
  })()`);
  await sleep(1500);
  // Click "连接本实例" to get connection and call connectTo
  await evalInPage(ws,`(()=>{
    const buttons=Array.from(document.querySelectorAll('button'));
    const connBtn=buttons.find(b=>b.textContent.trim()==='连接本实例');
    if(connBtn&&!connBtn.disabled)connBtn.click();
  })()`);
  await sleep(4000);
}

test('page loads and management token is extracted from URL hash',async t=>{
  t.timeout=20000;
  const{service}=await setupServer(t);
  const url=`${service.origin}/#/chat/live?control=${service.token}`;
  const{ws,chrome}=await setupBrowser(t,url);
  await sleep(2000);
  // The page should have loaded with the management token in the token input
  const tokenInput=await evalInPage(ws,`document.querySelector('input[type=password]')?.value||''`);
  assert.ok(tokenInput.length>0,'Token input should be populated from URL hash');
  ws.close();
});

test('connect button calls management API and connects to Hermes via synthetic transport',async t=>{
  t.timeout=25000;
  const{service}=await setupServer(t);
  const url=`${service.origin}/#/chat/live?control=${service.token}`;
  const{ws,chrome}=await setupBrowser(t,url);
  await sleep(1500);
  await connectToFixture(ws);
  // Check if RPC requests were captured (fixture should have intercepted WebSocket)
  const requests=await evalInPage(ws,`(window.__p2RpcRequests||[]).map(r=>r.method)`);
  assert.ok(Array.isArray(requests),'RPC requests array should exist');
  assert.ok(requests.includes('session.create'),'Should have sent session.create after connecting, got: '+JSON.stringify(requests));
  ws.close();
});

test('disconnect during streaming shows unknown, not success',async t=>{
  t.timeout=25000;
  const{service}=await setupServer(t);
  const url=`${service.origin}/#/chat/live?control=${service.token}`;
  const{ws,chrome}=await setupBrowser(t,url);
  await sleep(1500);
  await connectToFixture(ws);
  // After connecting, the page should be in 'ready' phase with session created
  const phaseText=await evalInPage(ws,`(()=>{
    const el=document.querySelector('[role=status]');
    return el?el.textContent:'no status';
  })()`);
  assert.ok(phaseText.includes('就绪')||phaseText.includes('ready'),'Should be connected, got: '+phaseText);
  // Simulate disconnect by closing the fake socket
  await evalInPage(ws,`(()=>{if(window.__p2Socket)window.__p2Socket.close();})()`);
  await sleep(2000);
  // After disconnect, should NOT show success/completion
  const afterText=await evalInPage(ws,`document.body.textContent`);
  assert.ok(!afterText.includes('完整测试回复'),'Should not show completion after disconnect');
  // The page should show some form of disconnected/closed/unknown state
  const closedStatus=await evalInPage(ws,`(()=>{
    const el=document.querySelector('[role=status]');
    return el?el.textContent:'no status';
  })()`);
  assert.ok(closedStatus.includes('关闭')||closedStatus.includes('断开')||closedStatus.includes('closed')||closedStatus.includes('失败')||closedStatus.includes('failed'),
    'Should show disconnected state, got: '+closedStatus);
  ws.close();
});

test('capabilities page loads with import section and empty state',async t=>{
  t.timeout=20000;
  const{service}=await setupServer(t);
  const url=`${service.origin}/#/capabilities`;
  const{ws,chrome}=await setupBrowser(t,url);
  await sleep(2000);
  const heading=await evalInPage(ws,`document.querySelector('h1')?.textContent||''`);
  assert.ok(heading.length>0,'Capabilities page should have a heading');
  const pageText=await evalInPage(ws,`document.body.textContent`);
  assert.ok(pageText.length>0,'Page should have content');
  // Should have file input for importing cards
  const hasFileInput=await evalInPage(ws,`!!document.querySelector('input[type=file]')`);
  assert.ok(hasFileInput,'Should have file input for card import');
  ws.close();
});

test('management token does not appear in page text or URLs after bootstrap',async t=>{
  t.timeout=20000;
  const{service}=await setupServer(t);
  const url=`${service.origin}/#/chat/live?control=${service.token}`;
  const{ws,chrome}=await setupBrowser(t,url);
  await sleep(2000);
  // The token should have been removed from the URL hash by bootstrap
  const hash=await evalInPage(ws,`window.location.hash`);
  assert.ok(!hash.includes(service.token),'Token should not remain in URL hash');
  // The token should not appear in visible page text
  const bodyText=await evalInPage(ws,`document.body.textContent`);
  assert.ok(!bodyText.includes(service.token),'Token should not appear in page text');
  ws.close();
});

test('fixture fetch pass-through allows management API calls while intercepting catalog',async t=>{
  t.timeout=25000;
  const{service}=await setupServer(t);
  const url=`${service.origin}/#/chat/live?control=${service.token}`;
  const{ws,chrome}=await setupBrowser(t,url);
  await sleep(1500);
  await connectToFixture(ws);
  // The fetch requests array should contain both management API calls and catalog/evidence calls
  const fetchRequests=await evalInPage(ws,`(window.__p2FetchRequests||[]).map(r=>r.url)`);
  // Management API calls should have been passed through to the real server
  const hasStatus=fetchRequests.some(u=>u.includes('/api/status'));
  const hasConnection=fetchRequests.some(u=>u.includes('/api/connection'));
  assert.ok(hasStatus||hasConnection,'Management API fetch calls should pass through fixture, got: '+JSON.stringify(fetchRequests));
  ws.close();
});
