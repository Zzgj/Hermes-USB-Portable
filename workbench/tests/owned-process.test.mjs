import test from 'node:test';
import assert from 'node:assert/strict';
import {startOwnedProcess} from '../scripts/owned-process.mjs';
const options=(code,extra={})=>({executable:process.execPath,args:['-e',code],cwd:process.cwd(),env:{},probe:async()=>true,startupMs:3000,stopMs:100,...extra});
const service="process.stdout.write('HERMES_BACKEND_READY port=12345\\n');setInterval(()=>{},1000)";
test('ready requires authenticated health probe, stop is idempotent and reaps child',async()=>{
 let confirm;const child=startOwnedProcess(options(service,{probe:()=>new Promise(resolve=>{confirm=resolve;})}));
 try{
  const deadline=Date.now()+2000;
  while(!confirm&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,10));
  assert.equal(typeof confirm,'function');assert.equal(child.state,'starting');confirm(true);
  assert.deepEqual(await child.ready,{port:12345});assert.equal(child.state,'ready');
  const stopped=child.stop();assert.strictEqual(child.stop(),stopped);await stopped;assert.equal(child.state,'stopped');
 }finally{await child.stop();}
});
test('startup timeout terminates owned child, late probe cannot revive it',async()=>{
 let confirm;const child=startOwnedProcess(options(service,{startupMs:200,probe:()=>new Promise(resolve=>{confirm=resolve;})}));
 await assert.rejects(child.ready,/PROCESS_STARTUP_TIMEOUT/);await child.stop();confirm?.(true);
 await new Promise(resolve=>setTimeout(resolve,0));assert.equal(child.state,'stopped');
});
test('failed probe does not reveal its potentially sensitive error',async()=>{
 const child=startOwnedProcess(options(service,{probe:async()=>{throw new Error('secret-token');}}));
 await assert.rejects(child.ready,{message:'PROCESS_HEALTH_FAILED'});await child.stop();
});
test('early exit and invalid port never become ready',async()=>{
 for(const code of ['process.exit(2)',"process.stdout.write('HERMES_BACKEND_READY port=99999\\n');setInterval(()=>{},1000)"]){
  const child=startOwnedProcess(options(code));await assert.rejects(child.ready,/PROCESS_(EXITED_BEFORE_READY|INVALID_PORT)/);await child.stop();
 }
});
test('stopping one handle does not stop another service',async()=>{
 const one=startOwnedProcess(options(service)),two=startOwnedProcess(options(service));
 try{await Promise.all([one.ready,two.ready]);await one.stop();assert.equal(two.state,'ready');}finally{await Promise.all([one.stop(),two.stop()]);}
});
test('reject relative executables and shell-like argument strings',()=>{
 assert.throws(()=>startOwnedProcess({...options(service),executable:'node'}));
 assert.throws(()=>startOwnedProcess({...options(service),args:'-e code'}));
});
