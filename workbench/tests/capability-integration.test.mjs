import {readFile} from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
const transpile=async relative=>{
 const source=await readFile(new URL(relative,import.meta.url),'utf8');
 return ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
};
const capJs=await transpile('../src/domain/capability.ts');
const capModule=await import(`data:text/javascript;base64,${Buffer.from(capJs).toString('base64')}`);
const execJsRaw=await transpile('../src/domain/capability-execution.ts');
const execJs=execJsRaw.replace(/^import\s+type\s+\{[^}]*\}\s*from\s*['"]\.\/capability['"];?\s*$/gm,'').replace(/^import\s+type\s+\{[^}]*\}\s*from\s*['"]\.\/chat-events['"];?\s*$/gm,'');
const execUrl=`data:text/javascript;base64,${Buffer.from(capJs+'\n'+execJs).toString('base64')}`;
const execModule=await import(execUrl);
const chatJs=await transpile('../src/domain/chat-events.ts');
const chatUrl=`data:text/javascript;base64,${Buffer.from(chatJs).toString('base64')}`;
const chatModule=await import(chatUrl);

const {decodeCapability,decodeVerification,capabilityStatus,importVerificationDrafts}=capModule;
const {verifyMethodFingerprint,buildExecutionPrompt,deriveExecutionPhase}=execModule;
const {beginTurn}=chatModule;

const hash='a'.repeat(64),env='b'.repeat(64),hash2='c'.repeat(64),env2='d'.repeat(64);

const card=decodeCapability({id:'files',name:'Test files',goal:'Organize disposable files',method:{kind:'skill',name:'file-sort',fingerprint:hash},state:'published',inputs:[{id:'source',label:'Source',required:true}]});
const matchingCatalogCard=decodeCapability({id:'inst-1',name:'Instance file-sort',goal:'Instance goal',method:{kind:'skill',name:'file-sort',fingerprint:hash},state:'published',inputs:[]});
const changedCatalogCard=decodeCapability({id:'inst-2',name:'Changed file-sort',goal:'Changed goal',method:{kind:'skill',name:'file-sort',fingerprint:hash2},state:'published',inputs:[]});

const evidence=decodeVerification({capabilityId:'files',methodFingerprint:hash,environmentFingerprint:env,sessionId:'s1',verifiedAt:'2026-09-13T00:00:00Z',outcome:'passed',checks:[{id:'check1',passed:true}]});

test('full chain: fingerprint match + verified evidence + turn complete = complete phase',async()=>{
 const check=verifyMethodFingerprint(card,[matchingCatalogCard]);
 assert.equal(check.status,'match');
 const prompt=buildExecutionPrompt(card,{source:'/tmp/test'});
 assert.ok(prompt.includes('file-sort'));
 assert.ok(prompt.includes('/tmp/test'));
 const computedEnv=await capModule.environmentFingerprint([matchingCatalogCard]);
 const evidenceWithEnv=decodeVerification({capabilityId:'files',methodFingerprint:hash,environmentFingerprint:computedEnv,sessionId:'s1',verifiedAt:'2026-09-13T00:00:00Z',outcome:'passed',checks:[{id:'check1',passed:true}]});
 const status=capabilityStatus(card,[evidenceWithEnv],computedEnv);
 assert.equal(status,'verified');
 const turn={...beginTurn('s1',1),status:'complete',text:'done'};
 const execState={capabilityId:'files',check,prompt,confirmed:true};
 const phase=deriveExecutionPhase(execState,turn,false);
 assert.equal(phase,'complete');
});

test('fingerprint mismatch blocks execution; environment change requires reverify',async()=>{
 const check=verifyMethodFingerprint(card,[changedCatalogCard]);
 assert.equal(check.status,'mismatch');
 assert.equal(check.actual,hash2);
 const env1=await capModule.environmentFingerprint([matchingCatalogCard]);
 const env2=await capModule.environmentFingerprint([changedCatalogCard]);
 assert.notEqual(env1,env2);
 const status=capabilityStatus(card,[evidence],env2);
 assert.equal(status,'reverify');
 const execState={capabilityId:'files',check,prompt:'test',confirmed:false};
 const phase=deriveExecutionPhase(execState,null,false);
 assert.equal(phase,'mismatch');
});

test('missing skill in catalog produces missing status and idle phase',()=>{
 const check=verifyMethodFingerprint(card,[]);
 assert.equal(check.status,'missing');
 assert.equal(check.actual,undefined);
 const execState={capabilityId:'files',check,prompt:'test',confirmed:false};
 const phase=deriveExecutionPhase(execState,null,false);
 assert.equal(phase,'missing');
});

test('disconnection during streaming produces unknown phase even with confirmed execution',()=>{
 const check=verifyMethodFingerprint(card,[matchingCatalogCard]);
 const turn={...beginTurn('s1',1),status:'streaming'};
 const execState={capabilityId:'files',check,prompt:'test',confirmed:true};
 const phaseConnected=deriveExecutionPhase(execState,turn,false);
 assert.equal(phaseConnected,'observing');
 const phaseDisconnected=deriveExecutionPhase(execState,turn,true);
 assert.equal(phaseDisconnected,'unknown');
});

test('environment fingerprint stability: same catalog produces same hash regardless of input order',async()=>{
 const cardA=decodeCapability({id:'a',name:'A',goal:'GA',method:{kind:'skill',name:'skill-a',fingerprint:hash},state:'published',inputs:[]});
 const cardB=decodeCapability({id:'b',name:'B',goal:'GB',method:{kind:'skill',name:'skill-b',fingerprint:hash2},state:'published',inputs:[]});
 const fp1=await capModule.environmentFingerprint([cardA,cardB]);
 const fp2=await capModule.environmentFingerprint([cardB,cardA]);
 assert.equal(fp1,fp2);
 assert.equal(fp1.length,64);
});

test('evidence with failed outcome keeps card in reverify status',async()=>{
 const env=await capModule.environmentFingerprint([matchingCatalogCard]);
 const failedEvidence=decodeVerification({capabilityId:'files',methodFingerprint:hash,environmentFingerprint:env,sessionId:'s1',verifiedAt:'2026-09-13T01:00:00Z',outcome:'failed',checks:[{id:'check1',passed:false}]});
 const status=capabilityStatus(card,[evidence,failedEvidence],env);
 assert.equal(status,'reverify');
});
