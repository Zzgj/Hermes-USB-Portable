import {realpath,readFile,stat,mkdir,lstat} from 'node:fs/promises';
import {join,win32} from 'node:path';
import {createHash} from 'node:crypto';

export function windowsEnvironment(root,host){
 const runtime=win32.join(root,'.cache','runtimes','windows-x64'),source=win32.join(root,'src','hermes-agent');
 const result={};
 for(const key of ['SystemRoot','WINDIR','COMSPEC','USERPROFILE','TEMP','TMP','PATHEXT'])if(typeof host[key]==='string')result[key]=host[key];
 const system=host.SystemRoot||host.WINDIR;
 if(!system||!win32.isAbsolute(system))throw new Error('WINDOWS_SYSTEM_ROOT_REQUIRED');
 result.PATH=[win32.join(runtime,'venv','Scripts'),win32.join(runtime,'python'),win32.join(runtime,'node'),win32.join(runtime,'uv'),win32.join(runtime,'bin'),win32.join(runtime,'git','cmd'),win32.join(runtime,'git','bin'),win32.join(system,'System32'),system,win32.join(system,'System32','WindowsPowerShell','v1.0')].join(';');
 Object.assign(result,{
  HERMES_HOME:win32.join(root,'data'),TERMINAL_CWD:source,VIRTUAL_ENV:win32.join(runtime,'venv'),
  HERMES_GIT_BASH_PATH:win32.join(runtime,'git','bin','bash.exe'),PYTHONNOUSERSITE:'1',UV_NO_CONFIG:'1',UV_PYTHON:win32.join(runtime,'python','python.exe'),
  PLAYWRIGHT_BROWSERS_PATH:win32.join(runtime,'playwright'),NODE_PATH:win32.join(runtime,'node','node_modules'),NPM_CONFIG_PREFIX:win32.join(runtime,'node'),
  APPDATA:win32.join(root,'.cache','windows-appdata'),LOCALAPPDATA:win32.join(root,'.cache','windows-localappdata'),
  NPM_CONFIG_USERCONFIG:win32.join(root,'.cache','p2-npmrc'),
 });
 return result;
}
export async function portableWindowsOptions(root,host){
 if(process.platform!=='win32')throw new Error('WINDOWS_REQUIRED');
 root=await realpath(root);const runtime=join(root,'.cache','runtimes','windows-x64');
 try{await lstat(join(root,'logs','diagnostics','p2-install-active.json'));throw new Error('INTERRUPTED_INSTALL_REQUIRES_RECOVERY');}catch(error){if(error.code!=='ENOENT')throw error;}
 const lock=await readFile(join(root,'manifests','runtime-components.windows-x64.json'));
 const ready=(await readFile(join(runtime,'ready.flag'),'utf8')).trim().toLowerCase();
 const location=(await readFile(join(runtime,'portable-location.txt'),'utf8')).trim();
 if(ready!==createHash('sha256').update(lock).digest('hex')||win32.normalize(location).toLowerCase()!==win32.normalize(root).toLowerCase())throw new Error('RUN_SETUP_RELOCATION_REPAIR');
 for(const file of ['launch.bat','workbench/dist/index.html','.cache/runtimes/windows-x64/venv/Scripts/python.exe','.cache/runtimes/windows-x64/git/bin/bash.exe']){
  if(!(await stat(join(root,file))).isFile())throw new Error('PORTABLE_FILE_MISSING');
 }
 for(const path of ['data','.cache/windows-appdata','.cache/windows-localappdata'])await mkdir(join(root,path),{recursive:true});
 return {python:join(runtime,'venv','Scripts','python.exe'),source:join(root,'src','hermes-agent'),home:join(root,'data'),environment:windowsEnvironment(root,host)};
}
