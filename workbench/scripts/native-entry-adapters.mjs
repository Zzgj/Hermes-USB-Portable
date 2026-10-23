import {realpath,lstat} from 'node:fs/promises';
import {isAbsolute,join} from 'node:path';
import {randomBytes} from 'node:crypto';
import {inspectBaseline} from './check-hermes-baseline.mjs';
import {startNativeOwnedProcess} from './native-owned-process.mjs';
import {probeHermes} from './hermes-health.mjs';
import {probeNativeDashboardPage} from './native-dashboard-health.mjs';

// Adapted against this exact Git object, not the currently installed Hermes.
export const NATIVE_BASELINE='28044757aabd34010bd9f5f3e3f82b0906b46241';

async function plainPath(root,parts,directory=false){
 let current=root;
 for(const [index,part] of parts.entries()){
  current=join(current,part);const metadata=await lstat(current);
  if(metadata.isSymbolicLink()||((index<parts.length-1||directory)?!metadata.isDirectory():!metadata.isFile()))throw new Error('NATIVE_ASSET_INVALID');
 }
 return current;
}

// Trusted local composition only; neither options nor dependencies come from HTTP.
// The caller must already hold the canonical home's shared lock during prepare.
export function createNativeEntryAdapters({python,source,environment,git,openBrowser},{
 platform=process.platform,inspect=inspectBaseline,start=startNativeOwnedProcess,probe=probeHermes,probePage=probeNativeDashboardPage,
}={}){
 if(![python,source].every(p=>typeof p==='string'&&isAbsolute(p))||!environment||typeof openBrowser!=='function')throw new Error('INVALID_NATIVE_ADAPTER_OPTIONS');
 const prepare=kind=>async({home})=>{
  if(platform!=='win32')throw new Error('WINDOWS_REQUIRED');
  if(typeof home!=='string'||!isAbsolute(home))throw new Error('INVALID_ENTRY_HOME');
  const cwd=await realpath(source),dataRoot=await realpath(home);
  if(cwd===dataRoot||!(await lstat(dataRoot)).isDirectory()||!(await lstat(python)).isFile())throw new Error('INVALID_HERMES_LAYOUT');
  const baseline=inspect(cwd,git);
  if(baseline.tracked_changes)throw new Error('SOURCE_REVIEW_REQUIRED');
  if(baseline.commit!==NATIVE_BASELINE)throw new Error('NATIVE_BASELINE_UNSUPPORTED');
  try{await lstat(join(cwd,'.env'));throw new Error('SOURCE_ENV_REQUIRES_REVIEW');}catch(error){if(error.code!=='ENOENT')throw error;}
  await plainPath(cwd,['hermes_cli','main.py']);
  const dist=kind==='dashboard'?await plainPath(cwd,['hermes_cli','web_dist'],true):null;
  if(dist)await plainPath(dist,['index.html']);
  const args=kind==='cli'?['-m','hermes_cli.main','--cli']:
   ['-m','hermes_cli.main','dashboard','--isolated','--host','127.0.0.1','--port','0','--no-open','--skip-build'];
  return {start:()=>{
   const token=randomBytes(32).toString('base64url');
   const env={...environment,HERMES_HOME:dataRoot,PYTHONUNBUFFERED:'1',PYTHONNOUSERSITE:'1'};
   // Do not inherit another surface/profile, loader override, auth bypass or port.
   for(const key of ['HERMES_PROFILE','HERMES_DESKTOP','HERMES_SERVE_HEADLESS','HERMES_WEB_DIST','HERMES_DASHBOARD_SESSION_TOKEN','PYTHONPATH','PYTHONHOME'])delete env[key];
   if(dist)Object.assign(env,{HERMES_WEB_DIST:dist,HERMES_DASHBOARD_SESSION_TOKEN:token});
   const healthy=async(port,signal)=>{
    if(signal?.aborted||await probe({port,token,signal})!==true||signal?.aborted)return false;
    return kind!=='dashboard'||await probePage({port,token,signal})===true;
   };
   const owned=start({kind,python,args,cwd,environment:env,probe:healthy});
   let active=true,port=null;
   const abort=new AbortController();
   void owned.closed.then(()=>{active=false;port=null;abort.abort();},()=>{active=false;port=null;abort.abort();});
   const ready=owned.ready.then(value=>{
    if(!active)throw new Error('NATIVE_PROCESS_EXITED_BEFORE_READY');
    if(kind==='dashboard'){
     if(!Number.isInteger(value?.port)||value.port<1||value.port>65535)throw new Error('NATIVE_PROCESS_INVALID_PORT');
     port=value.port;
    }
   });
   void ready.catch(()=>{});
   return {ready,closed:owned.closed,stop:()=>{active=false;port=null;abort.abort();return owned.stop();},
    ...(kind==='dashboard'?{open:async()=>{
     const target=port;
     if(!active||!target)throw new Error('DASHBOARD_NOT_READY');
     const ok=await healthy(target,abort.signal);
     if(!ok||!active||port!==target)throw new Error('DASHBOARD_NOT_READY');
     // URL is minted here, contains no credential, and is never supplied by HTTP.
     await openBrowser(`http://127.0.0.1:${target}/`);
    }}:{}),
   };
  }};
 };
 return {cli:{prepare:prepare('cli')},dashboard:{prepare:prepare('dashboard')}};
}
