// Internal lifecycle seam. Not an HTTP API and not enabled by asset detection.
// acquire must bind the canonical home to the shared instance lock.
// prepare runs under that lock and may inspect only; start owns any launch effects.
// An adapter must resolve closed only after confirming its entire owned tree exited.
export function createNativeEntrySession({acquire,prepare}){
 if(typeof acquire!=='function'||typeof prepare!=='function')throw new Error('INVALID_ENTRY_ADAPTER');
 let state='idle',kind=null,lock=null,child=null,closed=Promise.resolve();
 const status=()=>({kind,state});
 async function start(requested){
  if(requested!=='cli'&&requested!=='dashboard')throw new Error('INVALID_ENTRY');
  if(state!=='idle')throw new Error('ENTRY_BUSY');
  state='starting';kind=requested;
  try{lock=await acquire();}catch(error){state='idle';kind=null;throw error;}
  let adapter;
  try{
   adapter=await prepare(requested);
   if(typeof adapter?.start!=='function')throw new Error('INVALID_ENTRY_ADAPTER');
  }catch(error){
   try{await lock.release();lock=null;state='idle';kind=null;}
   catch{state='unknown';throw new Error('ENTRY_RELEASE_UNCONFIRMED');}
   throw error;
  }
  try{
   child=await adapter.start();
   if(typeof child?.stop!=='function'||typeof child?.closed?.then!=='function')throw new Error('INVALID_ENTRY_ADAPTER');
  }catch{
   // Launch can have taken effect before rejecting. Never infer no process exists.
   state='unknown';throw new Error('ENTRY_START_UNCONFIRMED');
  }
  const owned=child;
  state=owned.ready?'starting':'running';
  if(owned.ready)void Promise.resolve(owned.ready).then(()=>{
   if(child===owned&&state==='starting')state='running';
  },()=>{if(child===owned&&state==='starting')state='unknown';});
  closed=Promise.resolve(owned.closed).then(async result=>{
   if(result?.treeExited!==true){state='unknown';return;}
   try{await lock.release();lock=null;child=null;kind=null;state='idle';}
   catch{state='unknown';}
  },()=>{state='unknown';});
  return status();
 }
 async function stop(){
  if(!['running','starting','unknown'].includes(state)||!child)throw new Error('ENTRY_NOT_RUNNING');
  const owned=child,completion=closed;
  state='stopping';
  try{
   const result=await owned.stop();
   if(result?.treeExited===true){
    await completion;
    if(child===owned)throw new Error('ENTRY_RELEASE_UNCONFIRMED');
   }
  }catch{if(child===owned&&state!=='idle')state='unknown';throw new Error('ENTRY_STOP_UNCONFIRMED');}
  return status();
 }
 async function open(){
  if(kind!=='dashboard'||state!=='running'||typeof child?.open!=='function')throw new Error('ENTRY_NOT_READY');
  await child.open();
 }
 return {start,stop,open,status,get closed(){return closed;}};
}
