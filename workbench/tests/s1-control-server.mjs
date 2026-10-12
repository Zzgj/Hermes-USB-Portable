import {startControlServer} from '../scripts/control-server.mjs';
import {createServer} from 'node:http';
import {fileURLToPath} from 'node:url';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {readSkillCatalog} from '../scripts/skill-catalog.mjs';
import {prepareCapability} from '../scripts/prepare-capability.mjs';

/** Import-only, in-process test entry. Never print or persist the returned credentials.
 * Real management HTTP and filesystem readers; no Hermes process or RPC executor.
 * Browser caller owns its synthetic WebSocket and must count submissions separately.
 * A minimal mock HTTP server on the fake RPC port serves /api/sessions/:id/messages
 * so the real readTranscript fetch path can be exercised in browser tests. */
export async function startS1Harness({assets=fileURLToPath(new URL('../dist',import.meta.url))}={}){
 const home=await mkdtemp(join(tmpdir(),'p2-r4-lead-'));
 const skillPath=join(home,'skills','fixture-skill','SKILL.md');
 const rpc={port:12345,token:'fixture-rpc-token'};
 const stats={starts:0,stops:0,catalogCalls:0,prepareCalls:0,changedRejections:0,held:false};
 let server,mockHttp,closing=false,closePromise,holdNext=false,release,heldWaiters=[];
 const releasePrepare=()=>{release?.();release=undefined;};
 const transcripts=new Map();
 let transcriptMode='normal';
 let holdTranscript=false,releaseTranscript,transcriptWaiters=[];
 try{
  // Mock HTTP server on the fake RPC port to serve transcript endpoint for browser tests.
  mockHttp=createServer(async(req,res)=>{
   if(req.headers.authorization!==('Bearer '+rpc.token)){res.writeHead(403);res.end();return;}
   const url=new URL(req.url,`http://127.0.0.1:${rpc.port}`);
   const match=url.pathname.match(/^\/api\/sessions\/([^/]+)\/messages$/);
   if(!match){res.writeHead(404);res.end();return;}
   if(transcriptMode==='forbidden'){res.writeHead(403);res.end(JSON.stringify({error:'forbidden'}));return;}
   if(transcriptMode==='empty'){res.writeHead(200,{'Content-Type':'application/json'});res.end('');return;}
   if(transcriptMode==='invalid'){res.writeHead(200,{'Content-Type':'text/plain'});res.end('not json');return;}
   if(transcriptMode==='error500'){res.writeHead(500);res.end('internal error');return;}
   if(holdTranscript){holdTranscript=false;const wait=new Promise(resolve=>{releaseTranscript=resolve;});await wait;transcriptWaiters.splice(0).forEach(resolve=>resolve());if(closing)return;}
   const data=transcripts.get(match[1])||{session_id:match[1],messages:[]};
   res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(data));
  });
  await new Promise((resolve,reject)=>{mockHttp.once('error',reject);mockHttp.listen(0,'127.0.0.1',()=>{rpc.port=mockHttp.address().port;resolve();});});
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
   setTranscript(id,data){transcripts.set(id,data);},
   setTranscriptMode(mode){transcriptMode=mode;},
   holdNextTranscript(){holdTranscript=true;},
   releaseHeldTranscript(){releaseTranscript?.();releaseTranscript=undefined;},
   holdNextPrepare(){if(closing||holdNext||stats.held)throw new Error('HARNESS_BUSY');holdNext=true;},
   waitForHeldPrepare(){if(stats.held)return Promise.resolve();return new Promise(resolve=>heldWaiters.push(resolve));},
   releasePrepare,
   changeSkill:()=>writeFile(skillPath,'# Synthetic fixture changed\nDo not execute tools.\n'),
   close(){if(closePromise)return closePromise;closing=true;releasePrepare();releaseTranscript?.();releaseTranscript=undefined;heldWaiters.splice(0).forEach(resolve=>resolve());transcriptWaiters.splice(0).forEach(resolve=>resolve());closePromise=(async()=>{await new Promise(resolve=>mockHttp.close(resolve));await server.close();await rm(home,{recursive:true,force:true});})();return closePromise;}
  };
 }catch(error){if(mockHttp)await new Promise(resolve=>mockHttp.close(resolve));if(server)await server.close();await rm(home,{recursive:true,force:true});throw error;}
}
