import {startControlServer} from '../scripts/control-server.mjs';
import {fileURLToPath} from 'node:url';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {readSkillCatalog} from '../scripts/skill-catalog.mjs';
import {prepareCapability} from '../scripts/prepare-capability.mjs';

/** Import-only, in-process test entry. Never print or persist the returned credentials.
 * Real management HTTP and filesystem readers; no Hermes process or RPC executor.
 * Browser caller owns its synthetic WebSocket and must count submissions separately. */
export async function startS1Harness({assets=fileURLToPath(new URL('../dist',import.meta.url))}={}){
 const home=await mkdtemp(join(tmpdir(),'p2-r4-lead-'));
 const skillPath=join(home,'skills','fixture-skill','SKILL.md');
 const rpc={port:12345,token:'fixture-rpc-token'};
 const stats={starts:0,stops:0,catalogCalls:0,prepareCalls:0,changedRejections:0,held:false};
 let server,closing=false,closePromise,holdNext=false,release,heldWaiters=[];
 const releasePrepare=()=>{release?.();release=undefined;};
 try{
  await mkdir(join(home,'skills','fixture-skill'),{recursive:true});
  await writeFile(skillPath,'# Synthetic fixture\nDo not execute tools. This is test material only.\n');
  server=await startControlServer({assets,
   startInstance:async()=>{stats.starts++;let stopped=false;return {state:'ready',connection:Promise.resolve({...rpc}),stop:async()=>{if(!stopped){stopped=true;stats.stops++;}}};},
   readCatalog:async()=>{stats.catalogCalls++;return readSkillCatalog(home);},
   prepareCapability:async input=>{
    stats.prepareCalls++;
    if(holdNext){holdNext=false;stats.held=true;const wait=new Promise(resolve=>{release=resolve;});heldWaiters.splice(0).forEach(resolve=>resolve());await wait;stats.held=false;}
    if(closing)throw new Error('HARNESS_CLOSED');
    try{return await prepareCapability(home,input);}catch(error){if(error.message==='CAPABILITY_CHANGED')stats.changedRejections++;throw error;}
   }
  });
  // Keep the fake RPC identity distinct even if the OS happened to choose its port.
  if(Number(new URL(server.origin).port)===rpc.port)rpc.port=12346;
  return {origin:server.origin,token:server.token,home,skillPath,rpc,stats,
   holdNextPrepare(){if(closing||holdNext||stats.held)throw new Error('HARNESS_BUSY');holdNext=true;},
   waitForHeldPrepare(){if(stats.held)return Promise.resolve();return new Promise(resolve=>heldWaiters.push(resolve));},
   releasePrepare,
   changeSkill:()=>writeFile(skillPath,'# Synthetic fixture changed\nDo not execute tools.\n'),
   close(){if(closePromise)return closePromise;closing=true;releasePrepare();heldWaiters.splice(0).forEach(resolve=>resolve());closePromise=(async()=>{await server.close();await rm(home,{recursive:true,force:true});})();return closePromise;}
  };
 }catch(error){if(server)await server.close();await rm(home,{recursive:true,force:true});throw error;}
}
