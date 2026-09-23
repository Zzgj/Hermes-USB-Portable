// Debug test to check fixture injection and button states
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
const CDP_PORT=9335;
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
    awaitPromise:true,
    returnByValue:true,
  });
  if(result.exceptionDetails){
    const err=result.exceptionDetails;
    throw new Error('Eval error: '+(err.description||err.text||JSON.stringify(err)));
  }
  return result.result.value;
}

async function setupBrowser(t,targetUrl){
  const profileDir=await mkdtemp(join(tmpdir(),'p2-debug-cdp-'));
  const chrome=spawn(CHROME_PATH,[
    `--remote-debugging-port=${CDP_PORT}`,
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
      const resp=await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`);
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
  const home=await mkdtemp(join(tmpdir(),'p2-debug-skill-'));
  await mkdir(join(home,'skills','fixture-skill'),{recursive:true});
  await writeFile(join(home,'skills','fixture-skill','SKILL.md'),'Debug test fixture skill');
  const assets=join(process.cwd(),'dist');
  const service=await startControlServer({
    assets,
    startInstance:async()=>({state:'ready',connection:Promise.resolve({port:19119,token:'debug-instance-token-123456'}),stop:async()=>{}}),
    prepareCapability:request=>prepareCapability(home,request),
    readCatalog:()=>readSkillCatalog(home),
  });
  t.after(async()=>{await service.close();await rm(home,{recursive:true,force:true});});
  await fetch(service.origin+'/api/start',{method:'POST',headers:{Origin:service.origin,Authorization:`Bearer ${service.token}`}});
  return{service,home};
}

test('debug: check page state and button availability',async t=>{
  t.timeout=30000;
  const{service}=await setupServer(t);
  const url=`${service.origin}/#/chat/live?control=${service.token}`;
  const{ws,chrome}=await setupBrowser(t,url);
  await sleep(2000);
  
  // Check token input
  const tokenInput=await evalInPage(ws,`document.querySelector('input[type=password]')?.value||''`);
  console.log('Token input:',tokenInput?'[has value]':'[empty]');
  
  // List all buttons and their states
  const buttons=await evalInPage(ws,`(()=>{
    return Array.from(document.querySelectorAll('button')).map(b=>({
      text:b.textContent.trim().slice(0,30),
      disabled:b.disabled
    }));
  })()`);
  console.log('Buttons:',JSON.stringify(buttons,null,2));
  
  // Check status text
  const statusText=await evalInPage(ws,`document.querySelector('[role=status]')?.textContent||''`);
  console.log('Status text:',statusText);
  
  // Inject fixture
  const fixtureCode=await readFile(FIXTURE_PATH,'utf8');
  const injectResult=await evalInPage(ws,fixtureCode);
  console.log('Fixture inject result:',injectResult);
  
  // After injection, check if WebSocket was replaced
  const wsCheck=await evalInPage(ws,`typeof window.__p2RpcRequests`);
  console.log('__p2RpcRequests type:',wsCheck);
  
  // Click "读取服务状态" (check status)
  const clickResult=await evalInPage(ws,`(()=>{
    const buttons=Array.from(document.querySelectorAll('button'));
    const checkBtn=buttons.find(b=>b.textContent.includes('读取服务状态'));
    if(checkBtn){if(!checkBtn.disabled)checkBtn.click();return{found:true,disabled:checkBtn.disabled,text:checkBtn.textContent.trim()};}
    return{found:false};
  })()`);
  console.log('Check button click:',JSON.stringify(clickResult));
  
  await sleep(2000);
  
  // Check status after click
  const statusAfter=await evalInPage(ws,`(()=>{
    const el=document.querySelector('[role=status]');
    return el?el.textContent:'no status element';
  })()`);
  console.log('Status after check:',statusAfter);
  
  // Check buttons again
  const buttonsAfter=await evalInPage(ws,`(()=>{
    return Array.from(document.querySelectorAll('button')).map(b=>({
      text:b.textContent.trim().slice(0,30),
      disabled:b.disabled
    }));
  })()`);
  console.log('Buttons after check:',JSON.stringify(buttonsAfter,null,2));
  
  // Try clicking start
  const startResult=await evalInPage(ws,`(()=>{
    const buttons=Array.from(document.querySelectorAll('button'));
    const startBtn=buttons.find(b=>b.textContent.includes('启动本实例'));
    if(startBtn){if(!startBtn.disabled)startBtn.click();return{found:true,disabled:startBtn.disabled};}
    return{found:false};
  })()`);
  console.log('Start button:',JSON.stringify(startResult));
  
  await sleep(3000);
  
  // Check RPC requests
  const requests=await evalInPage(ws,`(window.__p2RpcRequests||[]).map(r=>r.method)`);
  console.log('RPC requests:',JSON.stringify(requests));
  
  // Check phase
  const phaseText=await evalInPage(ws,`(()=>{
    const el=document.querySelector('[role=status]');
    return el?el.textContent:'no status';
  })()`);
  console.log('Phase after start:',phaseText);
  
  ws.close();
});
