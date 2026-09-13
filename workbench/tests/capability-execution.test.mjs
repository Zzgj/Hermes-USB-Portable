import {readFile} from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
const transpile=async relative=>{
 const source=await readFile(new URL(relative,import.meta.url),'utf8');
 return ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
};
const capJs=await transpile('../src/domain/capability.ts');
const {decodeCapability}=await import(`data:text/javascript;base64,${Buffer.from(capJs).toString('base64')}`);
const execJs=await transpile('../src/domain/capability-execution.ts');
const {verifyMethodFingerprint,buildExecutionPrompt,deriveExecutionPhase}=await import(`data:text/javascript;base64,${Buffer.from(execJs).toString('base64')}`);
const chatJs=await transpile('../src/domain/chat-events.ts');
const {beginTurn}=await import(`data:text/javascript;base64,${Buffer.from(chatJs).toString('base64')}`);
const hash='a'.repeat(64),hash2='b'.repeat(64);
const baseCard=decodeCapability({id:'files',name:'Test files',goal:'Organize disposable files',method:{kind:'skill',name:'file-sort',fingerprint:hash},state:'published',inputs:[{id:'source',label:'Source',required:true},{id:'mode',label:'Mode',required:false}]});
const catalogCard=decodeCapability({id:'inst-1',name:'Instance file-sort',goal:'Instance goal',method:{kind:'skill',name:'file-sort',fingerprint:hash},state:'published',inputs:[]});
const changedCard=decodeCapability({id:'inst-2',name:'Changed file-sort',goal:'Changed goal',method:{kind:'skill',name:'file-sort',fingerprint:hash2},state:'published',inputs:[]});
const otherCard=decodeCapability({id:'inst-3',name:'Other skill',goal:'Other goal',method:{kind:'skill',name:'net-check',fingerprint:hash2},state:'published',inputs:[]});
const bundleCard=decodeCapability({id:'bundle-1',name:'Bundle test',goal:'Bundle goal',method:{kind:'bundle',name:'printer-deploy',fingerprint:hash},state:'published',inputs:[{id:'target',label:'Target',required:true}]});
test('verifyMethodFingerprint matches when the declared hash equals the instance hash',()=>{
 const check=verifyMethodFingerprint(baseCard,[catalogCard,otherCard]);
 assert.equal(check.status,'match');assert.equal(check.skillName,'file-sort');
 assert.equal(check.expected,hash);assert.equal(check.actual,undefined);
});
test('verifyMethodFingerprint reports mismatch with the actual instance hash',()=>{
 const check=verifyMethodFingerprint(baseCard,[changedCard,otherCard]);
 assert.equal(check.status,'mismatch');assert.equal(check.skillName,'file-sort');
 assert.equal(check.expected,hash);assert.equal(check.actual,hash2);
});
test('verifyMethodFingerprint reports missing when the skill is absent from the catalog',()=>{
 const check=verifyMethodFingerprint(baseCard,[otherCard]);
 assert.equal(check.status,'missing');assert.equal(check.skillName,'file-sort');
 assert.equal(check.expected,hash);assert.equal(check.actual,undefined);
});
test('verifyMethodFingerprint compares by method name, not by card id',()=>{
 const renamed=decodeCapability({id:'different-id',name:'Renamed',goal:'Goal',method:{kind:'skill',name:'file-sort',fingerprint:hash},state:'published',inputs:[]});
 assert.equal(verifyMethodFingerprint(renamed,[catalogCard]).status,'match');
});
test('buildExecutionPrompt lists the card goal, method reference and declared inputs',()=>{
 const prompt=buildExecutionPrompt(baseCard,{source:'/tmp/demo',mode:'dry-run'});
 const lines=prompt.split('\n');
 assert.ok(lines.includes('能力: Test files'));
 assert.ok(lines.includes('目标: Organize disposable files'));
 assert.ok(lines.some(l=>l.includes('引用 Skill: file-sort')));
 assert.ok(lines.some(l=>l.includes('- Source: /tmp/demo')));
 assert.ok(lines.some(l=>l.includes('- Mode: dry-run')));
});
test('buildExecutionPrompt references bundle kind without executing it',()=>{
 const prompt=buildExecutionPrompt(bundleCard,{target:'printer-01'});
 assert.ok(prompt.includes('引用 Bundle: printer-deploy'));
 assert.ok(prompt.includes('- Target: printer-01'));
});
test('buildExecutionPrompt tolerates missing params with an empty string',()=>{
 const prompt=buildExecutionPrompt(baseCard,{});
 assert.ok(prompt.includes('- Source: '));
 assert.ok(prompt.includes('- Mode: '));
});
test('deriveExecutionPhase is idle when no execution is active',()=>{
 assert.equal(deriveExecutionPhase(null,null,false),'idle');
 assert.equal(deriveExecutionPhase(null,beginTurn('s'),false),'idle');
});
test('deriveExecutionPhase reflects fingerprint status before confirmation',()=>{
 const match={capabilityId:'files',check:{status:'match',skillName:'file-sort',expected:hash},prompt:'p',confirmed:false};
 const mismatch={capabilityId:'files',check:{status:'mismatch',skillName:'file-sort',expected:hash,actual:hash2},prompt:'p',confirmed:false};
 const missing={capabilityId:'files',check:{status:'missing',skillName:'file-sort',expected:hash},prompt:'p',confirmed:false};
 assert.equal(deriveExecutionPhase(match,null,false),'verified');
 assert.equal(deriveExecutionPhase(mismatch,null,false),'mismatch');
 assert.equal(deriveExecutionPhase(missing,null,false),'missing');
});
test('deriveExecutionPhase is unknown when confirmed but no turn arrived yet',()=>{
 const exec={capabilityId:'files',check:{status:'match',skillName:'file-sort',expected:hash},prompt:'p',confirmed:true};
 assert.equal(deriveExecutionPhase(exec,null,false),'unknown');
});
test('deriveExecutionPhase maps terminal turn statuses when confirmed',()=>{
 const exec={capabilityId:'files',check:{status:'match',skillName:'file-sort',expected:hash},prompt:'p',confirmed:true};
 const streaming=beginTurn('s');assert.equal(deriveExecutionPhase(exec,streaming,false),'observing');
 const complete={...streaming,status:'complete'};assert.equal(deriveExecutionPhase(exec,complete,false),'complete');
 const failed={...streaming,status:'failed'};assert.equal(deriveExecutionPhase(exec,failed,false),'failed');
 const interrupted={...streaming,status:'interrupted'};assert.equal(deriveExecutionPhase(exec,interrupted,false),'interrupted');
});
test('deriveExecutionPhase is unknown when streaming is interrupted by disconnect',()=>{
 const exec={capabilityId:'files',check:{status:'match',skillName:'file-sort',expected:hash},prompt:'p',confirmed:true};
 const streaming=beginTurn('s');
 assert.equal(deriveExecutionPhase(exec,streaming,true),'unknown');
});
test('deriveExecutionPhase treats complete turn as complete even after disconnect',()=>{
 const exec={capabilityId:'files',check:{status:'match',skillName:'file-sort',expected:hash},prompt:'p',confirmed:true};
 const complete={...beginTurn('s'),status:'complete'};
 assert.equal(deriveExecutionPhase(exec,complete,true),'complete');
});
