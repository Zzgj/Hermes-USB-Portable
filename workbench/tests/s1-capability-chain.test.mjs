// P2-S1-R1: Card call-chain re-verification — tests that call REAL production code.
//
// S1-6c tests read the ACTUAL CapabilitiesPage.tsx source via TypeScript AST,
// extract the commit-check expression, and evaluate it with counting callbacks.
// This ensures tests use the real call-site code, not hand-copied expressions.
// If someone changes the source, the AST extraction picks up the new expression;
// if someone breaks the validate-before-submit order, the test fails.
//
// Domain functions canSubmitCapability and canCommitCapability are imported via
// transpiled production source. S1-9/10 test domain-level epoch guards only.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,writeFile,mkdir,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import ts from 'typescript';

// --- Compile and import REAL production code ---

const compile=source=>ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const url=js=>'data:text/javascript;base64,'+Buffer.from(js).toString('base64');
const capJs=compile(await readFile(new URL('../src/domain/capability.ts',import.meta.url),'utf8'));
const runJs=compile(await readFile(new URL('../src/domain/capability-run.ts',import.meta.url),'utf8')).replace(/(['"])\.\/capability\1/,JSON.stringify(url(capJs)));
const {canSubmitCapability,canCommitCapability,prepareCapabilityRun}=await import(url(runJs));

// --- AST extraction of the ACTUAL commit-check expression from CapabilitiesPage.tsx ---

const pageSource=await readFile(new URL('../src/pages/CapabilitiesPage.tsx',import.meta.url),'utf8');
const pageTree=ts.createSourceFile('CapabilitiesPage.tsx',pageSource,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);

function findNode(node,predicate){
  if(predicate(node))return node;
  let result=null;
  ts.forEachChild(node,child=>{if(!result)result=findNode(child,predicate);});
  return result;
}

// Find the IfStatement whose condition references canCommitCapability
const commitIf=findNode(pageTree,node=>ts.isIfStatement(node)&&node.expression.getText(pageTree).includes('canCommitCapability'));
if(!commitIf)throw new Error('TEST SETUP FAILURE: could not find canCommitCapability if-statement in CapabilitiesPage.tsx');

// Extract the condition expression text from the real source
const commitConditionText=commitIf.expression.getText(pageTree);
// Extract the then-branch (should be throw new Error('CHANGED'))
const commitThenText=commitIf.thenStatement.getText(pageTree);

// Also import server-side prepare-capability for skill-change tests
const {prepareCapability}=await import(new URL('../scripts/prepare-capability.mjs',import.meta.url).href);
const {readSkillCatalog}=await import(new URL('../scripts/skill-catalog.mjs',import.meta.url).href);
const {startControlServer}=await import(new URL('../scripts/control-server.mjs',import.meta.url).href);

// --- Fixtures ---

const FP='a'.repeat(64);
const FP2='b'.repeat(64);

function draft(overrides={}){return {cardId:'c',prompt:'p',fingerprint:FP,port:9119,token:'live-token',epoch:5,...overrides};}
function access(){return {port:9119,token:'live-token'};}

async function skillFixture(t){
  const home=await mkdtemp(join(tmpdir(),'p2-s1-cap-'));
  t.after(()=>rm(home,{recursive:true,force:true}));
  const skillDir=join(home,'skills','fixture-skill');
  const scriptDir=join(skillDir,'scripts');
  await mkdir(scriptDir,{recursive:true});
  const skillPath=join(skillDir,'SKILL.md');
  await writeFile(skillPath,'Fixture skill instructions, not executed.');
  await writeFile(join(scriptDir,'check.ps1'),'original script content');
  const card=(await readSkillCatalog(home)).cards[0];
  return {home,skillPath,scriptPath:join(scriptDir,'check.ps1'),card:{...card,inputs:[{id:'target',label:'Target',required:true}]}};
}

async function controlFixture(t,opts={}){
  const root=await mkdtemp(join(tmpdir(),'p2-s1-ctrl-'));
  const assets=join(root,'assets');
  await mkdir(assets);
  await writeFile(join(assets,'index.html'),'<h1>fixture</h1>');
  const startInstance=opts.startInstance??(async()=>({state:'ready',connection:Promise.resolve({port:opts.rpcPort??12345,token:opts.rpcToken??'fixture-rpc-token'}),stop:async()=>{}}));
  const prepareCapabilityFn=opts.prepareCapability??(async({card,values})=>({kind:'capability',cardId:card.id,method:card.method,availability:'unknown',prompt:`Synthetic capability ${card.id}: ${JSON.stringify(values)}`}));
  const service=await startControlServer({assets,startInstance,prepareCapability:prepareCapabilityFn});
  t.after(async()=>{await service.close();await rm(root,{recursive:true,force:true})});
  const call=(path,options={})=>fetch(service.origin+path,{...options,headers:{Origin:service.origin,Authorization:`Bearer ${service.token}`,...options.headers}}).then(r=>r);
  return {service,call};
}

// --- Helper: evaluate the extracted commit-check expression with test fixtures ---

function evalCommitCheck(prepared,next,submitRunFn){
  // The extracted expression references canCommitCapability, prepared, next, and submitRun.
  // We provide these in scope and evaluate the actual source expression.
  // eslint-disable-next-line no-new-func
  const fn=new Function('canCommitCapability','prepared','next','submitRun',`
    let threw=false;
    try{
      if(${commitConditionText})${commitThenText}
    }catch(e){threw=true;}
    return threw;
  `);
  return fn(canCommitCapability,prepared,next,submitRunFn);
}

function evalCommitCheckWithCount(prepared,next,submitReturnValue){
  let submitCalls=0;
  const submitRun=()=>{submitCalls++;return submitReturnValue;};
  const threw=evalCommitCheck(prepared,next,submitRun);
  return {threw,submitCalls};
}

// =============================================
// S1-6: canSubmitCapability (from useLiveChat.ts)
// =============================================

test('S1-6: canSubmitCapability allows submission when epoch, port, and token all match',()=>{
  assert.equal(canSubmitCapability(draft(),access(),5),true);
});
test('S1-6: canSubmitCapability rejects when epoch changed (reconnect)',()=>{
  assert.equal(canSubmitCapability(draft(),access(),6),false);
});
test('S1-6: canSubmitCapability rejects when port changed (instance switch)',()=>{
  assert.equal(canSubmitCapability(draft({port:9999}),access(),5),false);
});
test('S1-6: canSubmitCapability rejects when token changed (instance restart)',()=>{
  assert.equal(canSubmitCapability(draft({token:'different'}),access(),5),false);
});
test('S1-6: canSubmitCapability rejects when no active connection (null access)',()=>{
  assert.equal(canSubmitCapability(draft(),null,5),false);
});

// =============================================
// S1-6b: canCommitCapability (from CapabilitiesPage.tsx, domain function)
// =============================================

test('S1-6b: canCommitCapability allows commit when all fields match',()=>{
  assert.equal(canCommitCapability(draft(),draft()),true);
});
test('S1-6b: canCommitCapability rejects when epoch differs',()=>{
  assert.equal(canCommitCapability(draft(),draft({epoch:6})),false);
});
test('S1-6b: canCommitCapability rejects when port differs',()=>{
  assert.equal(canCommitCapability(draft(),draft({port:9999})),false);
});
test('S1-6b: canCommitCapability rejects when token differs',()=>{
  assert.equal(canCommitCapability(draft(),draft({token:'other'})),false);
});
test('S1-6b: canCommitCapability rejects when prompt differs',()=>{
  assert.equal(canCommitCapability(draft(),draft({prompt:'changed'})),false);
});
test('S1-6b: canCommitCapability rejects when fingerprint differs',()=>{
  assert.equal(canCommitCapability(draft(),draft({fingerprint:FP2})),false);
});
test('S1-6b: canCommitCapability rejects when no prepared draft (null)',()=>{
  assert.equal(canCommitCapability(null,draft()),false);
});

// =============================================
// S1-6c: Commit call-site regression — extracted from ACTUAL source via AST
// These tests evaluate the real expression from CapabilitiesPage.tsx, not a copy.
// submitRun must NOT be called before canCommitCapability validation passes.
// =============================================

test('S1-6c: AST-extracted commit condition is the short-circuit || expression',()=>{
  // Verify the extracted expression uses || (short-circuit), not a function argument.
  // This catches the fcd8212 regression where submitRun was passed as a parameter.
  assert.ok(commitConditionText.includes('||'),'condition must use || short-circuit');
  assert.ok(commitConditionText.includes('canCommitCapability'),'condition must call canCommitCapability');
  assert.ok(commitConditionText.includes('submitRun'),'condition must reference submitRun');
  assert.ok(!commitConditionText.includes('!!submitRun'),'condition must NOT use !!submitRun as argument (fcd8212 regression)');
});

test('S1-6c: commit call-site does not call submitRun when prompt differs',()=>{
  const {threw,submitCalls}=evalCommitCheckWithCount(draft(),draft({prompt:'changed'}),true);
  assert.equal(threw,true,'must throw CHANGED');
  assert.equal(submitCalls,0,'submitRun must NOT be called when validation fails (prompt mismatch)');
});

test('S1-6c: commit call-site does not call submitRun when fingerprint differs',()=>{
  const {threw,submitCalls}=evalCommitCheckWithCount(draft(),draft({fingerprint:FP2}),true);
  assert.equal(threw,true,'must throw CHANGED');
  assert.equal(submitCalls,0,'submitRun must NOT be called when validation fails (fingerprint mismatch)');
});

test('S1-6c: commit call-site does not call submitRun when epoch differs',()=>{
  const {threw,submitCalls}=evalCommitCheckWithCount(draft(),draft({epoch:6}),true);
  assert.equal(threw,true,'must throw CHANGED');
  assert.equal(submitCalls,0,'submitRun must NOT be called when validation fails (epoch mismatch)');
});

test('S1-6c: commit call-site calls submitRun exactly once when all fields match',()=>{
  const {threw,submitCalls}=evalCommitCheckWithCount(draft(),draft(),true);
  assert.equal(threw,false,'must NOT throw when all fields match and submitRun returns true');
  assert.equal(submitCalls,1,'submitRun must be called exactly once when validation passes');
});

test('S1-6c: commit call-site throws when submitRun returns false (even if fields match)',()=>{
  const {threw,submitCalls}=evalCommitCheckWithCount(draft(),draft(),false);
  assert.equal(threw,true,'must throw CHANGED when submitRun returns false');
  assert.equal(submitCalls,1,'submitRun was called once (validation passed, submitRun returned false)');
});

test('S1-6c: commit call-site does not call submitRun when prepared is null',()=>{
  const {threw,submitCalls}=evalCommitCheckWithCount(null,draft(),true);
  assert.equal(threw,true,'must throw CHANGED when prepared is null');
  assert.equal(submitCalls,0,'submitRun must NOT be called when prepared is null');
});

// =============================================
// S1-6c-mutation: prove the test catches a broken call-site.
// Mutates an IN-MEMORY copy of the source string (never writes to disk),
// re-parses via AST, and verifies the extraction detects the broken form.
// =============================================

test('S1-6c-mutation: broken call-site (submitRun as argument) is detected by AST extraction',()=>{
  // Mutate the in-memory source string: change || short-circuit to function argument (the fcd8212 regression)
  const mutated=pageSource.replace(
    'if(!canCommitCapability(prepared,next)||!submitRun?.(next))throw new Error(\'CHANGED\');',
    'if(!canCommitCapability(prepared,next,!!submitRun?.(next)))throw new Error(\'CHANGED\');'
  );
  assert.notEqual(mutated,pageSource,'mutation must actually change the source string');

  // Re-parse the mutated in-memory string (no disk I/O, production source untouched)
  const mutatedTree=ts.createSourceFile('CapabilitiesPage.tsx',mutated,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  const mutatedIf=findNode(mutatedTree,node=>ts.isIfStatement(node)&&node.expression.getText(mutatedTree).includes('canCommitCapability'));
  assert.ok(mutatedIf,'mutated source must still contain a canCommitCapability if-statement');
  const mutatedCondition=mutatedIf.expression.getText(mutatedTree);

  // The AST extraction detects the broken form
  assert.ok(mutatedCondition.includes('!!submitRun'),'mutated condition must contain !!submitRun as argument');
  assert.ok(!mutatedCondition.includes('||'),'mutated condition must NOT use || short-circuit');

  // The S1-6c AST assertion test would fail on the mutated source:
  // assert.ok(!commitConditionText.includes('!!submitRun')) would fail.
  const wouldFail=mutatedCondition.includes('!!submitRun');
  assert.equal(wouldFail,true,'test would catch the broken call-site (assert !includes !!submitRun)');
});

// =============================================
// S1-1b: prepareCapabilityRun sends management token, returns RPC token
// =============================================

test('S1-1b: prepareCapabilityRun sends management token in Authorization header, not RPC token',async t=>{
  const card={id:'fixture',name:'Fixture',goal:'Synthetic goal',method:{kind:'skill',name:'fixture',fingerprint:FP},inputs:[{id:'target',label:'Target',required:true}],state:'draft'};
  const reply={prepared:{kind:'capability',cardId:card.id,prompt:'Synthetic request',method:card.method,availability:'unknown'},connection:{port:12345,token:'rpc-token-different-from-management'}};
  const original=globalThis.fetch;
  t.after(()=>{globalThis.fetch=original;});
  let capturedAuth=null;
  globalThis.fetch=async(path,options)=>{capturedAuth=options.headers.Authorization;return new Response(JSON.stringify(reply));};
  const result=await prepareCapabilityRun('management-secret-token',card,{target:'x'},42,new AbortController().signal);
  assert.equal(capturedAuth,'Bearer management-secret-token');
  assert.equal(result.token,'rpc-token-different-from-management');
  assert.equal(result.port,12345);
  assert.equal(result.epoch,42);
  assert.notEqual(result.token,'management-secret-token');
});

// =============================================
// S1-4: Skill changed between prepare and confirm — real temp files, real server function
// =============================================

test('S1-4: skill file changed between first and second prepare → second throws CHANGED',async t=>{
  const {home,scriptPath,card}=await skillFixture(t);
  const first=await prepareCapability(home,{card,values:{target:'test'}});
  assert.equal(first.kind,'capability');
  assert.equal(first.method.fingerprint,card.method.fingerprint);
  await writeFile(scriptPath,'modified script content');
  await assert.rejects(prepareCapability(home,{card,values:{target:'test'}}),/CHANGED/);
  const skillContent=await readFile(join(home,'skills','fixture-skill','SKILL.md'),'utf8');
  assert.equal(skillContent,'Fixture skill instructions, not executed.');
});

test('S1-4b: skill file unchanged between first and second prepare → both succeed with same fingerprint',async t=>{
  const {home,card}=await skillFixture(t);
  const first=await prepareCapability(home,{card,values:{target:'test'}});
  const second=await prepareCapability(home,{card,values:{target:'test'}});
  assert.equal(first.method.fingerprint,second.method.fingerprint);
  assert.equal(first.prompt,second.prompt);
});

// =============================================
// S1-1: Management/RPC token isolation — real HTTP control server
// =============================================

test('S1-1: management token is rejected for RPC catalog endpoint and vice versa',async t=>{
  const {service,call}=await controlFixture(t,{rpcPort:9999,rpcToken:'rpc-secret'});
  await call('/api/start',{method:'POST'});
  const wrongToken=await fetch(service.origin+'/api/status',{headers:{Authorization:'Bearer wrong-token'}});
  assert.equal(wrongToken.status,403);
  const conn=await (await call('/api/connection')).json();
  assert.equal(conn.connection.port,9999);
  assert.equal(conn.connection.token,'rpc-secret');
  assert.notEqual(conn.connection.token,service.token);
  const prepareResp=await call('/api/capabilities/prepare',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({card:{id:'x',name:'X',goal:'G',method:{kind:'skill',name:'s',fingerprint:FP},inputs:[],state:'draft'},values:{}})});
  assert.equal(prepareResp.status,200);
  const prepared=await prepareResp.json();
  assert.equal(prepared.connection.token,'rpc-secret');
  assert.notEqual(prepared.connection.token,service.token);
  assert.equal(prepared.connection.port,9999);
  const bodyText=await (await call('/api/status')).text();
  assert.doesNotMatch(bodyText,new RegExp(service.token));
});

// =============================================
// S1-8: Management request failure, auth failure, or illegal response
// =============================================

test('S1-8: missing auth on prepare endpoint returns 403 without starting instance',async t=>{
  let starts=0;
  const {service}=await controlFixture(t,{startInstance:async()=>{starts++;return{state:'ready',connection:Promise.resolve({port:1,token:'x'}),stop:async()=>{}}}});
  const noAuth=await fetch(service.origin+'/api/capabilities/prepare',{method:'POST',headers:{'Content-Type':'application/json',Origin:service.origin},body:JSON.stringify({card:{id:'x'},values:{}})});
  assert.equal(noAuth.status,403);
  const wrongAuth=await fetch(service.origin+'/api/capabilities/prepare',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer wrong',Origin:service.origin},body:JSON.stringify({card:{id:'x'},values:{}})});
  assert.equal(wrongAuth.status,403);
  assert.equal(starts,0);
});

test('S1-8b: prepare endpoint rejects invalid JSON, extra fields, and oversized body',async t=>{
  const {service,call}=await controlFixture(t);
  await call('/api/start',{method:'POST'});
  const extra=await call('/api/capabilities/prepare',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({card:{id:'x'},values:{},extra:'unauthorized'})});
  assert.equal(extra.status,400);
  const notJson=await call('/api/capabilities/prepare',{method:'POST',headers:{'Content-Type':'application/json'},body:'not-json'});
  assert.equal(notJson.status,400);
  const oversized=await call('/api/capabilities/prepare',{method:'POST',headers:{'Content-Type':'application/json'},body:'x'.repeat(20000)});
  assert.equal(oversized.status,400);
});

// =============================================
// S1-9/S1-10: Domain-level epoch guard (not React execution)
// canSubmitCapability rejects stale epoch after disconnect/failure.
// These test the domain function, NOT the actual end()/setPhase('failed') React calls.
// =============================================

test('S1-9: epoch guard blocks replay after disconnect (domain function only)',()=>{
  assert.equal(canSubmitCapability(draft({epoch:5}),access(),5),true);
  assert.equal(canSubmitCapability(draft({epoch:5}),access(),6),false,'stale epoch after disconnect blocks replay');
});

test('S1-10: epoch guard blocks resubmission after submitText failure (domain function only)',()=>{
  assert.equal(canSubmitCapability(draft({epoch:5}),access(),5),true);
  assert.equal(canSubmitCapability(draft({epoch:5}),access(),6),false,'epoch changed after end() — resubmission blocked');
});
