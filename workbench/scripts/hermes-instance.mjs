import {realpath,stat,lstat} from 'node:fs/promises';
import {join,isAbsolute,dirname} from 'node:path';
import {randomBytes} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {startManagedInstance} from './managed-instance.mjs';
import {probeHermes} from './hermes-health.mjs';

// Explicit integration seam; never discovers personal Hermes or inherits process.env.
export async function startHermesInstance({python,source,home,environment}) {
 if(![python,source,home].every(value=>typeof value==='string'&&isAbsolute(value))||!environment||typeof environment!=='object')throw new Error('INVALID_HERMES_PATHS');
 // Preserve the venv launcher path: resolving its symlink can select base Python.
 const executable=python;
 const [cwd,dataRoot]=await Promise.all([realpath(source),realpath(home)]);
 if(!(await stat(executable)).isFile()||!(await stat(dataRoot)).isDirectory()||cwd===dataRoot)throw new Error('INVALID_HERMES_LAYOUT');
 try{await lstat(join(dirname(dataRoot),'logs','diagnostics','p2-install-active.json'));throw new Error('INTERRUPTED_INSTALL_REQUIRES_RECOVERY');}catch(error){if(error.code!=='ENOENT')throw error;}
 if(!(await stat(join(cwd,'hermes_cli','main.py'))).isFile())throw new Error('HERMES_ENTRY_MISSING');
 try{await lstat(join(cwd,'.env'));throw new Error('SOURCE_ENV_REQUIRES_REVIEW');}catch(error){if(error.code!=='ENOENT')throw error;}
 const token=randomBytes(32).toString('base64url');
 const hermesArgs=['-m','hermes_cli.main','serve','--isolated','--host','127.0.0.1','--port','0'];
 const args=process.platform==='win32'?[fileURLToPath(new URL('./windows-job-host.py',import.meta.url)),'--',...hermesArgs]:hermesArgs;
 const manager=await startManagedInstance(dataRoot,{
  executable,args,cwd,
  env:{...environment,HERMES_HOME:dataRoot,HERMES_DASHBOARD_SESSION_TOKEN:token,PYTHONUNBUFFERED:'1'},
  probe:(port,signal)=>probeHermes({port,token,signal}),startupMs:60000,stopMs:5000,
 });
 // Credential stays in memory; consumers must not log or persist this result.
 const connection=manager.ready.then(({port})=>({port,token}));
 void connection.catch(()=>{});
 return {connection,closed:manager.closed,stop:manager.stop,get state(){return manager.state;}};
}
