import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,readdir,rm,writeFile,lstat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {startOwnedProcess} from '../scripts/owned-process.mjs';
import {startManagedInstance} from '../scripts/managed-instance.mjs';
import {acquireInstanceLock} from '../scripts/instance-lock.mjs';

const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function bounded(promise,ms=4000){
 let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('fixture deadline exceeded')),ms);})]);}finally{clearTimeout(timer);}
}
function alive(pid){try{process.kill(pid,0);return true;}catch(error){if(error.code==='ESRCH')return false;throw error;}}
// Every fixture has its own hard deadline, including grandchildren left by red code.
const fixture=`
const {spawn}=require('node:child_process');
const {writeFileSync,existsSync}=require('node:fs');
const [dir,mode,levelText]=process.argv.slice(2),level=Number(levelText);
setTimeout(()=>process.kill(process.pid,'SIGKILL'),10000);
if((mode==='ignore'||mode==='early-ignore')&&level>0)process.on('SIGTERM',()=>{});
writeFileSync(dir+'/'+level+'.pid',String(process.pid));
if(level<2)spawn(process.execPath,[process.argv[1],dir,mode,String(level+1)],{stdio:'ignore'});
if(level===0){
 const timer=setInterval(()=>{
  if(existsSync(dir+'/2.pid')){
   clearInterval(timer);
   if(mode.startsWith('early'))process.exit(7);
   if(mode!=='timeout')process.stdout.write('HERMES_BACKEND_READY port=12345\\n');
  }
 },5);
}
`;
async function make(mode,managed=false){
 const dir=await mkdtemp(join(tmpdir(),'owned-tree-'));
 const script=join(dir,'fixture.cjs');await writeFile(script,fixture);
 const options={executable:process.execPath,args:[script,dir,mode,'0'],cwd:dir,env:{},probe:async()=>mode!=='health-failure',startupMs:mode==='timeout'?600:3000,stopMs:managed?1000:100};
 const owner=managed?await startManagedInstance(dir,options):startOwnedProcess(options);
 owner.ready.catch(()=>{});
 async function pids(){return Promise.all((await readdir(dir)).filter(x=>x.endsWith('.pid')).map(async x=>Number(await readFile(join(dir,x),'utf8'))));}
 async function cleanup(){
  // Signal only PIDs created by this fixture; never use the test runner's group.
  const owned=await pids();
  for(const pid of owned)if(alive(pid))try{process.kill(pid,'SIGKILL');}catch(error){if(error.code!=='ESRCH')throw error;}
  await bounded(owner.stop());
  const deadline=Date.now()+3000;
  while(owned.some(alive)&&Date.now()<deadline)await delay(10);
  assert.deepEqual(owned.filter(alive),[],'fixture cleanup must reap all owned PIDs');
  await rm(dir,{recursive:true,force:true});
 }
 return {owner,pids,cleanup,dir};
}
for(const mode of ['normal','ignore','early','early-ignore','timeout','health-failure'])test(`POSIX ${mode}: exited/stop waits for all ordinary descendants`,{skip:process.platform==='win32',timeout:12000},async()=>{
 const tree=await make(mode);
 try{
  if(mode.startsWith('early')||mode==='timeout'||mode==='health-failure')await assert.rejects(bounded(tree.owner.ready),/PROCESS_(EXITED_BEFORE_READY|STARTUP_TIMEOUT|HEALTH_FAILED)/);
  else await bounded(tree.owner.ready);
  const pids=await tree.pids();assert.equal(pids.length,3,'child, descendant and grandchild started');
  const done=mode.startsWith('early')?tree.owner.exited:tree.owner.stop();
  if(!mode.startsWith('early'))assert.strictEqual(tree.owner.stop(),done);
  await bounded(done);
  assert.deepEqual(pids.filter(alive),[],'must not release ownership while descendants exist');
  await bounded(tree.owner.stop());
  assert.deepEqual(pids.filter(alive),[],'repeated stop remains complete');
 }finally{await tree.cleanup();}
});
test('POSIX tree stop leaves another owned process tree alive',{skip:process.platform==='win32',timeout:12000},async()=>{
 const one=await make('ignore'),two=await make('normal');
 try{
  await bounded(Promise.all([one.owner.ready,two.owner.ready]));
  await bounded(one.owner.stop());
  assert.deepEqual((await one.pids()).filter(alive),[]);
  assert.equal((await two.pids()).filter(alive).length,3);
  assert.equal(two.owner.state,'ready');
 }finally{await Promise.all([one.cleanup(),two.cleanup()]);}
});
test('POSIX managed lock survives leader exit until TERM-resistant descendants are gone',{skip:process.platform==='win32',timeout:12000},async()=>{
 const tree=await make('ignore',true);
 try{
  await bounded(tree.owner.ready);
  const leader=Number(await readFile(join(tree.dir,'0.pid'),'utf8'));
  let closed=false;tree.owner.closed.then(()=>{closed=true;});
  const stopped=tree.owner.stop();
  const deadline=Date.now()+500;
  while(alive(leader)&&Date.now()<deadline)await delay(5);
  assert.equal(alive(leader),false,'leader exits before escalation');
  assert.equal((await tree.pids()).filter(alive).length,2,'resistant descendants still exist');
  assert.equal(closed,false,'closed is an ownership barrier, not a leader-exit event');
  await assert.rejects(acquireInstanceLock(tree.dir),/INSTANCE_LOCKED/);
  await bounded(stopped);
  assert.deepEqual((await tree.pids()).filter(alive),[]);
  await assert.rejects(lstat(join(tree.dir,'.p2-manager-lock')),{code:'ENOENT'});
  await (await acquireInstanceLock(tree.dir)).release();
 }finally{await tree.cleanup();}
});
test('POSIX spawn failure has no process group to signal',{skip:process.platform==='win32'},async()=>{
 const owner=startOwnedProcess({executable:'/nonexistent-owned-tree-executable',cwd:process.cwd(),env:{},probe:async()=>true});
 await assert.rejects(owner.ready,/PROCESS_SPAWN_FAILED/);await bounded(owner.exited);await bounded(owner.stop());
});
