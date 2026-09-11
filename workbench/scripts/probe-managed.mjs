import {mkdir,lstat} from 'node:fs/promises';
import {join} from 'node:path';
import {startHermesInstance} from './hermes-instance.mjs';
import {probeHermes} from './hermes-health.mjs';
import {startControlServer} from './control-server.mjs';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
if(process.env.P2_ISOLATED_PROBE!=='1')throw new Error('ISOLATION_REQUIRED');
const source=process.argv[2],home='/tmp/p2-managed-data';
await mkdir(home);
let instance,control;
try{
 const options={python:join(source,'venv/bin/python'),source,home,environment:{PATH:'/usr/bin:/bin',PYTHONDONTWRITEBYTECODE:'1'}};
 instance=await startHermesInstance(options);
 const {port,token}=await instance.connection;
 const health=await probeHermes({port,token});
 const rejectsWrongToken=!(await probeHermes({port,token:'wrong-test-token-123456'}));
 let singleInstance=false;
 try{const unexpected=await startHermesInstance(options);void unexpected.connection.catch(()=>{});await unexpected.stop();}catch(error){singleInstance=error.message==='INSTANCE_LOCKED';}
 await instance.stop();
 let lockReleased=false;
 try{await lstat(join(home,'.p2-manager-lock'));}catch(error){lockReleased=error.code==='ENOENT';}
 const result={authenticatedHealth:health,rejectsWrongToken,singleInstance,stopped:instance.state==='stopped',lockReleased};
 control=await startControlServer({assets:'/tmp/p2-scripts',startInstance:()=>startHermesInstance(options)});
 const headers={Origin:control.origin,Authorization:`Bearer ${control.token}`};
 const denied=await fetch(control.origin+'/api/start',{method:'POST'});
 result.controlUnauthorizedRejected=denied.status===403;
 const start=await fetch(control.origin+'/api/start',{method:'POST',headers});
 const started=await start.json();result.controlStartReady=start.ok&&started.state==='ready';
 if(result.controlStartReady){
  const checked=await promisify(execFile)(options.python,['/tmp/p2-scripts/probe-websocket-origin.py'],{
   env:{PATH:'/usr/bin:/bin',PYTHONDONTWRITEBYTECODE:'1',P2_ISOLATED_PROBE:'1',P2_PORT:String(started.connection.port),P2_TOKEN:started.connection.token,P2_ORIGIN:control.origin},timeout:15000,
  });
  Object.assign(result,JSON.parse(checked.stdout));
 }
 const stop=await fetch(control.origin+'/api/stop',{method:'POST',headers});
 result.controlStopIdle=stop.ok&&(await stop.json()).state==='idle';
 try{await lstat(join(home,'.p2-manager-lock'));result.controlLockReleased=false;}catch(error){result.controlLockReleased=error.code==='ENOENT';}
 await control.close();
 console.log(JSON.stringify(result));
 if(!Object.values(result).every(Boolean))process.exitCode=1;
}catch(error){console.log(JSON.stringify({error:error.message?.startsWith('PROCESS_')?error.message:'MANAGED_PROBE_FAILED'}));process.exitCode=1;}
finally{if(control)await control.close();if(instance)await instance.stop();}
