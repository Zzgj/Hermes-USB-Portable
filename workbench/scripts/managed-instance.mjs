import {acquireInstanceLock} from './instance-lock.mjs';
import {startOwnedProcess} from './owned-process.mjs';

export async function startManagedInstance(runtimeRoot,options) {
 const lock=await acquireInstanceLock(runtimeRoot);
 let child;
 try{child=startOwnedProcess(options);}catch(error){await lock.release();throw error;}
 // A lock is released only after the owned child exits, never on an observation timeout.
 const closed=child.exited.then(async result=>{await lock.release();return result;});
 // Caller may wait on ready first; retain rejections without an unhandled promise.
 void closed.catch(()=>{});
 return {ready:child.ready,closed,get state(){return child.state;},stop:async()=>{await child.stop();return closed;}};
}
