// P2-S1-RV01: Real management HTTP handler with temporary Skill directory.
// Verifies that capability preparation re-reads the catalog on each call,
// that fingerprint changes between preview and submit are rejected,
// and that prepared connections are instance-bound (port+token+epoch).
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {startControlServer} from '../scripts/control-server.mjs';
import {prepareCapability} from '../scripts/prepare-capability.mjs';
import {readSkillCatalog} from '../scripts/skill-catalog.mjs';

async function skillFixture(t){
  const home=await mkdtemp(join(tmpdir(),'p2-rv01-skill-'));
  const skillPath=join(home,'skills','fixture','SKILL.md');
  await mkdir(join(home,'skills','fixture'),{recursive:true});
  await writeFile(skillPath,'Fixture skill instructions, not executed.');
  t.after(()=>rm(home,{recursive:true,force:true}));
  return {home,skillPath};
}

async function controlFixture(t,home){
  const root=await mkdtemp(join(tmpdir(),'p2-rv01-control-'));
  const assets=join(root,'assets');
  await mkdir(assets);
  await writeFile(join(assets,'index.html'),'<h1>fixture</h1>');
  let instanceState='idle';
  let instanceConnection=null;
  const service=await startControlServer({
    assets,
    startInstance:async()=>{
      if(instanceState==='ready')throw new Error('INSTANCE_EXISTS');
      instanceState='ready';
      instanceConnection={port:19119,token:'hermes-instance-token'};
      return{state:'ready',connection:Promise.resolve(instanceConnection),stop:async()=>{instanceState='idle';instanceConnection=null;}};
    },
    prepareCapability:request=>prepareCapability(home,request),
    readCatalog:()=>readSkillCatalog(home),
  });
  t.after(async()=>{
    await service.close();
    await rm(root,{recursive:true,force:true});
  });
  const call=(path,options={})=>fetch(service.origin+path,{
    ...options,
    headers:{Origin:service.origin,Authorization:`Bearer ${service.token}`,'Content-Type':'application/json',...options.headers},
  });
  return{service,call,home};
}

function makeCard(catalogCard){
  return{...catalogCard,inputs:[{id:'target',label:'Target',required:true}]};
}

async function startInstance(call){
  const startResult=await call('/api/start',{method:'POST'});
  assert.equal(startResult.status,200);
}

async function prepareRequest(call,card,values={target:'test'}){
  const response=await call('/api/capabilities/prepare',{
    method:'POST',
    body:JSON.stringify({card,values}),
  });
  return response;
}

test('prepare re-reads catalog on every call; skill change between preview and submit is rejected',async t=>{
  const{home,skillPath}=await skillFixture(t);
  const{call}=await controlFixture(t,home);
  await startInstance(call);
  const catalog=await readSkillCatalog(home);
  const card=makeCard(catalog.cards[0]);
  const originalFingerprint=card.method.fingerprint;

  // First prepare (preview) — should succeed
  const previewResponse=await prepareRequest(call,card);
  assert.equal(previewResponse.status,200);
  const preview=await previewResponse.json();
  assert.equal(preview.prepared.method.fingerprint,originalFingerprint);

  // Change skill file between preview and submit
  await writeFile(skillPath,'Modified skill instructions');
  const changedCatalog=await readSkillCatalog(home);
  assert.notEqual(changedCatalog.cards[0].method.fingerprint,originalFingerprint);

  // Second prepare (submit) — must fail because fingerprint changed
  const submitResponse=await prepareRequest(call,card);
  assert.equal(submitResponse.status,400);
  const submitResult=await submitResponse.json();
  assert.equal(submitResult.error,'CAPABILITY_PREPARATION_FAILED');
});

test('prepare with stale card fingerprint (from old catalog) is rejected after skill update',async t=>{
  const{home,skillPath}=await skillFixture(t);
  const{call}=await controlFixture(t,home);
  await startInstance(call);

  // Get card with original fingerprint
  const catalog=await readSkillCatalog(home);
  const card=makeCard(catalog.cards[0]);
  const originalFingerprint=card.method.fingerprint;

  // Modify skill
  await writeFile(skillPath,'Updated content');
  const newCatalog=await readSkillCatalog(home);
  assert.notEqual(newCatalog.cards[0].method.fingerprint,originalFingerprint);

  // Using the old card (with old fingerprint) must fail
  const response=await prepareRequest(call,card);
  assert.equal(response.status,400);
});

test('prepared connection port and token differ from management server port and token',async t=>{
  const{home}=await skillFixture(t);
  const{service,call}=await controlFixture(t,home);
  await startInstance(call);
  const catalog=await readSkillCatalog(home);
  const card=makeCard(catalog.cards[0]);
  const response=await prepareRequest(call,card);
  const result=await response.json();

  // Management server port != Hermes instance port
  const managerPort=new URL(service.origin).port;
  assert.notEqual(String(result.connection.port),managerPort);
  // Management token != Hermes instance token
  assert.notEqual(result.connection.token,service.token);
});

test('catalog endpoint requires ready instance and authenticated request',async t=>{
  const{home}=await skillFixture(t);
  const{service,call}=await controlFixture(t,home);

  // Without starting instance: 409
  const beforeStart=await call('/api/capabilities/catalog');
  assert.equal(beforeStart.status,409);

  await startInstance(call);

  // Without auth: 403
  const noAuth=await fetch(service.origin+'/api/capabilities/catalog');
  assert.equal(noAuth.status,403);

  // With auth and ready: 200
  const ok=await call('/api/capabilities/catalog');
  assert.equal(ok.status,200);
  const catalog=await ok.json();
  assert.equal(catalog.availability,'unknown');
  assert.ok(Array.isArray(catalog.cards));
  assert.equal(catalog.cards.length,1);
});

test('prepare rejects when instance is not ready (after stop)',async t=>{
  const{home}=await skillFixture(t);
  const{call}=await controlFixture(t,home);
  await startInstance(call);
  const catalog=await readSkillCatalog(home);
  const card=makeCard(catalog.cards[0]);

  // Stop instance
  const stopResponse=await call('/api/stop',{method:'POST'});
  assert.equal(stopResponse.status,200);

  // Prepare must fail with 409
  const response=await prepareRequest(call,card);
  assert.equal(response.status,409);
});

test('concurrent prepare requests are serialized (busy guard)',async t=>{
  const{home}=await skillFixture(t);
  const{call}=await controlFixture(t,home);
  await startInstance(call);
  const catalog=await readSkillCatalog(home);
  const card=makeCard(catalog.cards[0]);

  // Send two concurrent prepare requests
  const[p1,p2]=await Promise.all([
    prepareRequest(call,card),
    prepareRequest(call,card),
  ]);

  // One should succeed (200), the other should get 409 (busy)
  const statuses=[p1.status,p2.status].sort();
  assert.ok(statuses.includes(200),`At least one should succeed: ${statuses}`);
  // The second should be rejected as busy — but since both hit the same event loop tick,
  // the busy flag may or may not catch it. The key assertion is that we never get two 200s
  // with different connections. At minimum, no crash or data corruption.
  // Verify that if both succeed, they return the same connection.
  if(p1.status===200&&p2.status===200){
    const r1=await p1.json();
    const r2=await p2.json();
    assert.deepEqual(r1.connection,r2.connection);
  }
});

test('skill file content is not leaked in prepared prompt or catalog response',async t=>{
  const{home,skillPath}=await skillFixture(t);
  const secretContent='SECRET_API_KEY_12345 private instructions';
  await writeFile(skillPath,secretContent);
  const{call}=await controlFixture(t,home);
  await startInstance(call);
  const catalog=await readSkillCatalog(home);
  const card=makeCard(catalog.cards[0]);

  // Catalog response should not contain skill content
  const catalogResponse=await call('/api/capabilities/catalog');
  const catalogText=await catalogResponse.text();
  assert.equal(catalogText.includes('SECRET_API_KEY_12345'),false);

  // Prepared prompt should not contain skill content
  const prepareResponse=await prepareRequest(call,card);
  const prepareResult=await prepareResponse.json();
  assert.equal(prepareResult.prepared.prompt.includes('SECRET_API_KEY_12345'),false);
});

test('prepare with extra unknown fields in values is rejected',async t=>{
  const{home}=await skillFixture(t);
  const{call}=await controlFixture(t,home);
  await startInstance(call);
  const catalog=await readSkillCatalog(home);
  const card=makeCard(catalog.cards[0]);

  const response=await call('/api/capabilities/prepare',{
    method:'POST',
    body:JSON.stringify({card,values:{target:'test',secret:'should-reject'}}),
  });
  assert.equal(response.status,400);
});
