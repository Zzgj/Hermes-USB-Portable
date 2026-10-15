import {realpath,lstat} from 'node:fs/promises';
import {isAbsolute,dirname,join} from 'node:path';
import {acquireInstanceLock} from './instance-lock.mjs';
import {createNativeEntrySession} from './native-entry-session.mjs';

// Server-owned configuration only. Never accept home, commands or adapters from HTTP.
// A concrete adapter must provide prepare() (no process effects) and a start closure.
// This does not certify that legacy launchers participate in the shared lock.
export async function createNativeEntryManager({home,adapters}){
 if(typeof home!=='string'||!isAbsolute(home))throw new Error('INVALID_ENTRY_HOME');
 const root=await realpath(home);
 if(!(await lstat(root)).isDirectory())throw new Error('INVALID_ENTRY_HOME');
 const selected={cli:adapters?.cli,dashboard:adapters?.dashboard};
 const checkRecovery=async()=>{
  try{
   await lstat(join(dirname(root),'logs','diagnostics','p2-install-active.json'));
   throw new Error('INTERRUPTED_INSTALL_REQUIRES_RECOVERY');
  }catch(error){if(error.code!=='ENOENT')throw error;}
 };
 return createNativeEntrySession({
  acquire:async()=>{
   await checkRecovery();
   return acquireInstanceLock(root);
  },
  prepare:async kind=>{
   // Repeat after lock acquisition: installation may have begun during acquisition.
   await checkRecovery();
   const adapter=selected[kind];
   if(typeof adapter?.prepare!=='function')throw new Error('ENTRY_ADAPTER_UNAVAILABLE');
   return adapter.prepare({home:root});
  },
 });
}
