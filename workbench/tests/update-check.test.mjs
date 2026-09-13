import {readFile} from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
const transpile=async relative=>{
 const source=await readFile(new URL(relative,import.meta.url),'utf8');
 return ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
};
const updateJs=await transpile('../src/domain/update-check.ts');
const {nextRetryDelay,decodeUpdateCheck,deriveUpdateOutcome,shouldRetry,decodeUpdatePlan,canInstall}=await import(`data:text/javascript;base64,${Buffer.from(updateJs).toString('base64')}`);
const entryJs=await transpile('../src/domain/entry-detect.ts');
const {entryLabel,decodeEntryStatus,decodeEntryList}=await import(`data:text/javascript;base64,${Buffer.from(entryJs).toString('base64')}`);
const resumeJs=await transpile('../src/domain/resume-safety.ts');
const {deriveResumeWarning}=await import(`data:text/javascript;base64,${Buffer.from(resumeJs).toString('base64')}`);
test('nextRetryDelay grows exponentially and is bounded',()=>{
 const d0=nextRetryDelay(0),d1=nextRetryDelay(1),d5=nextRetryDelay(5),d10=nextRetryDelay(10);
 assert.ok(d0>=60000&&d0<65000);
 assert.ok(d1>=120000&&d1<125000);
 assert.ok(d5<=3600000+5000);
 assert.ok(d10<=3600000+5000);
});
test('decodeUpdateCheck accepts valid outcomes and rejects malformed',()=>{
 const ok=decodeUpdateCheck({currentVersion:'0.21.0',outcome:'up-to-date'},'kernel','0.21.0',0);
 assert.equal(ok.channel,'kernel');assert.equal(ok.outcome,'up-to-date');assert.equal(ok.retryAfterMs,0);
 const avail=decodeUpdateCheck({currentVersion:'0.21.0',outcome:'available',latestVersion:'0.22.0',releaseNotes:'fix'},'shell','0.21.0',0);
 assert.equal(avail.latestVersion,'0.22.0');
 assert.throws(()=>decodeUpdateCheck({},'kernel','0.21.0',0));
 assert.throws(()=>decodeUpdateCheck({currentVersion:'0.21.0',outcome:'bad'},'kernel','0.21.0',0));
});
test('deriveUpdateOutcome maps network failure to offline or failed',()=>{
 const offline=deriveUpdateOutcome({ok:false,status:0},'kernel','0.21.0',0);
 assert.equal(offline.outcome,'offline');assert.ok(offline.retryAfterMs>0);
 const failed=deriveUpdateOutcome({ok:false,status:500},'kernel','0.21.0',0);
 assert.equal(failed.outcome,'failed');
 const ok=deriveUpdateOutcome({ok:true,status:200,body:{currentVersion:'0.21.0',outcome:'up-to-date'}},'kernel','0.21.0',0);
 assert.equal(ok.outcome,'up-to-date');
});
test('shouldRetry allows first attempt and respects backoff',()=>{
 assert.equal(shouldRetry(null,0),true);
 const upToDate={channel:'kernel',outcome:'up-to-date',currentVersion:'x',checkedAt:new Date().toISOString(),retryAfterMs:0};
 assert.equal(shouldRetry(upToDate,Date.now()),false);
 const offline={channel:'kernel',outcome:'offline',currentVersion:'x',checkedAt:new Date(Date.now()-70000).toISOString(),retryAfterMs:60000};
 assert.equal(shouldRetry(offline,Date.now()),true);
 const recent={channel:'kernel',outcome:'offline',currentVersion:'x',checkedAt:new Date().toISOString(),retryAfterMs:60000};
 assert.equal(shouldRetry(recent,Date.now()),false);
});
test('decodeUpdatePlan validates fields and canInstall blocks on gate',()=>{
 const plan=decodeUpdatePlan({targetVersion:'0.22.0',backup:true,changelogSummary:'fix',compatibilityGate:'unknown'},'kernel');
 assert.equal(plan.channel,'kernel');assert.equal(plan.compatibilityGate,'unknown');
 assert.equal(canInstall(plan),true);
 const blocked=decodeUpdatePlan({targetVersion:'0.22.0',backup:true,changelogSummary:'fix',compatibilityGate:'blocked'},'kernel');
 assert.equal(canInstall(blocked),false);
 assert.equal(canInstall(null),false);
 assert.throws(()=>decodeUpdatePlan({targetVersion:'',backup:true,changelogSummary:'fix',compatibilityGate:'passed'},'kernel'));
});
test('entryLabel maps kinds to display names',()=>{
 assert.equal(entryLabel('cli'),'CLI');
 assert.equal(entryLabel('tui'),'TUI');
 assert.equal(entryLabel('desktop'),'Desktop');
 assert.equal(entryLabel('web'),'Web Dashboard');
});
test('decodeEntryStatus accepts valid entries and rejects malformed',()=>{
 const cli=decodeEntryStatus({kind:'cli',available:true,path:'/usr/bin/hermes',note:'installed'});
 assert.equal(cli.kind,'cli');assert.equal(cli.available,true);assert.equal(cli.path,'/usr/bin/hermes');
 const web=decodeEntryStatus({kind:'web',available:false});
 assert.equal(web.available,false);assert.equal(web.note,'');
 assert.throws(()=>decodeEntryStatus({kind:'bad',available:true}));
 assert.throws(()=>decodeEntryStatus({kind:'cli',available:'yes'}));
});
test('decodeEntryList rejects duplicates and oversized lists',()=>{
 const list=decodeEntryList({entries:[{kind:'cli',available:true},{kind:'tui',available:false}]});
 assert.equal(list.length,2);
 assert.throws(()=>decodeEntryList({entries:[{kind:'cli',available:true},{kind:'cli',available:false}]}));
 assert.throws(()=>decodeEntryList({entries:'bad'}));
});
test('deriveResumeWarning warns about incomplete tools',()=>{
 const warn=deriveResumeWarning('sess-1','2026-09-13T10:00:00Z',true);
 assert.equal(warn.sessionId,'sess-1');assert.equal(warn.mayContinueExecution,true);
 assert.ok(warn.warning.includes('可能继续未完成的工具执行'));
 const safe=deriveResumeWarning('sess-2','2026-09-13T10:00:00Z',false);
 assert.equal(safe.mayContinueExecution,false);
 assert.ok(safe.warning.includes('不自动发送'));
 assert.throws(()=>deriveResumeWarning('','2026-09-13T10:00:00Z',false));
 assert.throws(()=>deriveResumeWarning('sess','bad-date',false));
});
