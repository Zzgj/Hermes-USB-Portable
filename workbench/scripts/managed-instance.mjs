import {acquireInstanceLock} from './instance-lock.mjs';
import {startOwnedProcess} from './owned-process.mjs';

export async function startManagedInstance(runtimeRoot,options,{beforeStart=()=>{},startProcess=startOwnedProcess}={}) {
 if(typeof beforeStart!=='function'||typeof startProcess!=='function')throw new Error('INVALID_START_GUARD');
 const lock=await acquireInstanceLock(runtimeRoot);
 let child;
 try{await beforeStart();child=startProcess(options);}catch(error){await lock.release();throw error;}
 // A lock is released only after the owned child exits, never on an observation timeout.
 const closed=child.exited.then(async result=>{await lock.release();return result;});
 // Caller may wait on ready first; retain rejections without an unhandled promise.
 void closed.catch(()=>{});
 return {ready:child.ready,closed,get state(){return child.state;},stop:async()=>{await child.stop();return closed;}};
}
