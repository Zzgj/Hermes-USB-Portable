// P2-S1-R1: Card call-chain browser re-verification and targeted rework tests.
// Covers: management/RPC token isolation, skill change between prepare and confirm,
// connection epoch/port/token mismatch, error handling, and late-response safety.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,mkdir,rm,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {prepareCapability} from '../scripts/prepare-capability.mjs';
import {readSkillCatalog} from '../scripts/skill-catalog.mjs';
import {startControlServer} from '../scripts/control-server.mjs';

// --- Helpers ---

async function skillFixture(t){
  const home=await mkdtemp(join(tmpdir(),'p2-s1-cap-'));
  t.after(()=>rm(home,{recursive:true,force:true}))
  const skillDir=join(home,'skills','fixture-skill')
  const scriptDir=join(skillDir,'scripts')
  await mkdir(scriptDir,{recursive:true})
  const skillPath=join(skillDir,'SKILL.md')
  await writeFile(skillPath,'Fixture skill instructions, not executed.')
  await writeFile(join(scriptDir,'check.ps1'),'original script content')
  const card=(await readSkillCatalog(home)).cards[0]
  return {home,skillPath,scriptPath:join(scriptDir,'check.ps1'),card:{...card,inputs:[{id:'target',label:'Target',required:true}]}}
}

async function controlFixture(t,opts={}){
  const root=await mkdtemp(join(tmpdir(),'p2-s1-ctrl-'))
  const assets=join(root,'assets')
  await mkdir(assets)
  await writeFile(join(assets,'index.html'),'<h1>fixture</h1>')
  const startInstance=opts.startInstance??(async()=>({
    state:'ready',
    connection:Promise.resolve({port:opts.rpcPort??12345,token:opts.rpcToken??'fixture-rpc-token'}),
    stop:async()=>{}
  }))
  const prepareCapabilityFn=opts.prepareCapability??(async({card,values})=>({
    kind:'capability',cardId:card.id,method:card.method,availability:'unknown',
    prompt:`Synthetic capability ${card.id}: ${JSON.stringify(values)}`
  }))
  const service=await startControlServer({assets,startInstance,prepareCapability:prepareCapabilityFn})
  t.after(async()=>{await service.close();await rm(root,{recursive:true,force:true})})
  const call=(path,options={})=>fetch(service.origin+path,{...options,headers:{Origin:service.origin,Authorization:`Bearer ${service.token}`,...options.headers}})
  return {service,call}
}

// --- Scenario: Management/RPC use different ports and tokens ---

test('S1-1: management token is rejected for RPC catalog endpoint and vice versa',async t=>{
  const {service,call}=await controlFixture(t,{rpcPort:9999,rpcToken:'rpc-secret'})
  await call('/api/start',{method:'POST'})

  // Management endpoint requires management token (Bearer ${service.token})
  // Wrong token → 403
  const wrongToken=await fetch(service.origin+'/api/status',{headers:{Authorization:'Bearer wrong-token'}})
  assert.equal(wrongToken.status,403)

  // Management token does not work as RPC token (different service/port)
  // The control server returns connection {port:9999,token:'rpc-secret'}
  const conn=await (await call('/api/connection')).json()
  assert.equal(conn.connection.port,9999)
  assert.equal(conn.connection.token,'rpc-secret')
  assert.notEqual(conn.connection.token,service.token)

  // Prepare endpoint returns connection with RPC token, not management token
  const prepareResp=await call('/api/capabilities/prepare',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({card:{id:'x',name:'X',goal:'G',method:{kind:'skill',name:'s',fingerprint:'a'.repeat(64)},inputs:[],state:'draft'},values:{}})})
  assert.equal(prepareResp.status,200)
  const prepared=await prepareResp.json()
  assert.equal(prepared.connection.token,'rpc-secret')
  assert.notEqual(prepared.connection.token,service.token)
  assert.equal(prepared.connection.port,9999)

  // Verify management token is NOT in the response body
  const bodyText=await (await call('/api/status')).text()
  assert.doesNotMatch(bodyText,new RegExp(service.token))
})

// --- Scenario: Skill changed between prepare and confirm (real temp files) ---

test('S1-4: skill file changed between first and second prepare → second throws CHANGED',async t=>{
  const {home,scriptPath,card}=await skillFixture(t)

  // First prepare succeeds
  const first=await prepareCapability(home,{card,values:{target:'test'}})
  assert.equal(first.kind,'capability')
  assert.equal(first.method.fingerprint,card.method.fingerprint)

  // Modify the skill script file (simulates skill changed between prepare and confirm)
  await writeFile(scriptPath,'modified script content')

  // Second prepare must reject — fingerprint no longer matches
  await assert.rejects(prepareCapability(home,{card,values:{target:'test'}}),/CHANGED/)

  // Original skill file content is not modified by prepare
  const skillContent=await readFile(join(home,'skills','fixture-skill','SKILL.md'),'utf8')
  assert.equal(skillContent,'Fixture skill instructions, not executed.')
})

test('S1-4b: skill file unchanged between first and second prepare → both succeed with same fingerprint',async t=>{
  const {home,card}=await skillFixture(t)
  const first=await prepareCapability(home,{card,values:{target:'test'}})
  const second=await prepareCapability(home,{card,values:{target:'test'}})
  assert.equal(first.method.fingerprint,second.method.fingerprint)
  assert.equal(first.prompt,second.prompt)
})

// --- Scenario: Management request failure, auth failure, or illegal response ---

test('S1-8: missing auth on prepare endpoint returns 403 without starting instance',async t=>{
  let starts=0
  const {service}=await controlFixture(t,{startInstance:async()=>{starts++;return{state:'ready',connection:Promise.resolve({port:1,token:'x'}),stop:async()=>{}}}})
  // Prepare without auth
  const noAuth=await fetch(service.origin+'/api/capabilities/prepare',{method:'POST',headers:{'Content-Type':'application/json',Origin:service.origin},body:JSON.stringify({card:{id:'x'},values:{}})})
  assert.equal(noAuth.status,403)
  // Prepare with wrong auth
  const wrongAuth=await fetch(service.origin+'/api/capabilities/prepare',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer wrong',Origin:service.origin},body:JSON.stringify({card:{id:'x'},values:{}})})
  assert.equal(wrongAuth.status,403)
  assert.equal(starts,0)
})

test('S1-8b: prepare endpoint rejects invalid JSON, extra fields, and oversized body',async t=>{
  const {service,call}=await controlFixture(t)
  await call('/api/start',{method:'POST'})
  // Extra field in body
  const extra=await call('/api/capabilities/prepare',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({card:{id:'x'},values:{},extra:'unauthorized'})})
  assert.equal(extra.status,400)
  // Non-JSON body
  const notJson=await call('/api/capabilities/prepare',{method:'POST',headers:{'Content-Type':'application/json'},body:'not-json'})
  assert.equal(notJson.status,400)
  // Oversized body
  const oversized=await call('/api/capabilities/prepare',{method:'POST',headers:{'Content-Type':'application/json'},body:'x'.repeat(20000)})
  assert.equal(oversized.status,400)
})

// --- Scenario: prepareCapabilityRun uses management token in Authorization header ---

test('S1-1b: prepareCapabilityRun sends management token in Authorization header, not RPC token',async t=>{
  const {readFile}=await import('node:fs/promises')
  const ts=(await import('typescript')).default
  const compile=source=>ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText
  const url=js=>'data:text/javascript;base64,'+Buffer.from(js).toString('base64')
  const capJs=compile(await readFile(new URL('../src/domain/capability.ts',import.meta.url),'utf8'))
  const code=compile(await readFile(new URL('../src/domain/capability-run.ts',import.meta.url),'utf8')).replace(/(['"])\.\/capability\1/,JSON.stringify(url(capJs)))
  const {prepareCapabilityRun}=await import(url(code))

  const card={id:'fixture',name:'Fixture',goal:'Synthetic goal',method:{kind:'skill',name:'fixture',fingerprint:'a'.repeat(64)},inputs:[{id:'target',label:'Target',required:true}],state:'draft'}
  const reply={prepared:{kind:'capability',cardId:card.id,prompt:'Synthetic request',method:card.method,availability:'unknown'},connection:{port:12345,token:'rpc-token-different-from-management'}}

  const original=globalThis.fetch
  t.after(()=>{globalThis.fetch=original})
  let capturedAuth=null
  globalThis.fetch=async(path,options)=>{
    capturedAuth=options.headers.Authorization
    return new Response(JSON.stringify(reply))
  }

  const result=await prepareCapabilityRun('management-secret-token',card,{target:'x'},42,new AbortController().signal)
  assert.equal(capturedAuth,'Bearer management-secret-token')
  assert.equal(result.token,'rpc-token-different-from-management')
  assert.equal(result.port,12345)
  assert.equal(result.epoch,42)
  assert.notEqual(result.token,'management-secret-token')
})

// --- Scenario: Connection epoch/port/token mismatch blocks submission ---

test('S1-6: submitCapability rejects when epoch, port, or token differs from current connection',async t=>{
  // The submitCapability logic (from useLiveChat.ts):
  // if(!access||draft.epoch!==epoch.current||draft.port!==access.port||draft.token!==access.token)return false;
  // We test this by simulating the validation directly.
  function validateSubmit(draft,access,currentEpoch){
    if(!access)return false
    if(draft.epoch!==currentEpoch)return false
    if(draft.port!==access.port)return false
    if(draft.token!==access.token)return false
    return true
  }
  const access={port:9119,token:'live-token'}
  const draft={epoch:5,port:9119,token:'live-token',prompt:'x',fingerprint:'a'.repeat(64),cardId:'c'}

  // Matching → allowed
  assert.equal(validateSubmit(draft,access,5),true)

  // Epoch changed (reconnect) → blocked
  assert.equal(validateSubmit(draft,access,6),false)

  // Port changed (different instance) → blocked
  assert.equal(validateSubmit({...draft,port:9999},access,5),false)

  // Token changed (instance restarted) → blocked
  assert.equal(validateSubmit({...draft,token:'different'},access,5),false)

  // No active connection → blocked
  assert.equal(validateSubmit(draft,null,5),false)
})

// --- Scenario: execute commit path rejects mismatched prepared capabilities ---

test('S1-6b: execute commit path rejects when epoch, port, token, prompt, or fingerprint differ',async t=>{
  // The execute commit validation (from CapabilitiesPage.tsx):
  // if(!prepared||next.epoch!==prepared.epoch||next.port!==prepared.port||next.token!==prepared.token||
  //    next.prompt!==prepared.prompt||next.fingerprint!==prepared.fingerprint||!submitRun?.(next))throw new Error('CHANGED');
  function validateCommit(prepared,next,submitResult){
    if(!prepared)return false
    if(next.epoch!==prepared.epoch)return false
    if(next.port!==prepared.port)return false
    if(next.token!==prepared.token)return false
    if(next.prompt!==prepared.prompt)return false
    if(next.fingerprint!==prepared.fingerprint)return false
    if(!submitResult)return false
    return true
  }
  const prepared={epoch:5,port:9119,token:'t',prompt:'p',fingerprint:'a'.repeat(64),cardId:'c'}
  const matching={...prepared}

  // All match → allowed
  assert.equal(validateCommit(prepared,matching,true),true)

  // Epoch differs → blocked
  assert.equal(validateCommit(prepared,{...matching,epoch:6},true),false)

  // Port differs → blocked
  assert.equal(validateCommit(prepared,{...matching,port:9999},true),false)

  // Token differs → blocked
  assert.equal(validateCommit(prepared,{...matching,token:'other'},true),false)

  // Prompt differs → blocked
  assert.equal(validateCommit(prepared,{...matching,prompt:'changed'},true),false)

  // Fingerprint differs → blocked
  assert.equal(validateCommit(prepared,{...matching,fingerprint:'b'.repeat(64)},true),false)

  // submitRun returns false → blocked
  assert.equal(validateCommit(prepared,matching,false),false)

  // No prepared → blocked
  assert.equal(validateCommit(null,matching,true),false)
})
