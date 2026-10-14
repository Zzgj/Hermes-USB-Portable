import {useState,useRef,useCallback,useEffect} from 'react';
import {readEntryCapabilities,type EntryCapabilityRow} from '../domain/entry-capabilities';

export function useEntryCapabilities(identity:string){
 const owner=useRef({identity,generation:0});
 if(owner.current.identity!==identity)owner.current={identity,generation:owner.current.generation+1};
 const generation=owner.current.generation;
 const request=useRef<AbortController|null>(null);
 const [snapshot,setSnapshot]=useState<{generation:number;rows:readonly EntryCapabilityRow[]|null;loading:boolean;failed:boolean}>({generation,rows:null,loading:false,failed:false});
 useEffect(()=>()=>{request.current?.abort();request.current=null;},[identity]);
 const inspect=useCallback(async()=>{
  if(!identity.trim()||owner.current.generation!==generation)return;
  request.current?.abort();const controller=new AbortController();request.current=controller;
  const current=()=>request.current===controller&&owner.current.generation===generation;
  setSnapshot({generation,rows:null,loading:true,failed:false});
  const timer=setTimeout(()=>controller.abort(),7000);
  try{
   const response=await fetch('/api/entry-capabilities',{method:'GET',headers:{Authorization:'Bearer '+identity},credentials:'omit',cache:'no-store',signal:controller.signal});
   if(!current()){void response.body?.cancel().catch(()=>{});return;}
   if(controller.signal.aborted){void response.body?.cancel().catch(()=>{});throw new Error('ENTRY_READ_CANCELLED');}
   if(!response.ok){void response.body?.cancel().catch(()=>{});throw new Error('ENTRY_REQUEST_FAILED');}
   const rows=await readEntryCapabilities(response,controller.signal);
   if(current()&&!controller.signal.aborted)setSnapshot({generation,rows,loading:false,failed:false});
  }catch{
   if(current())setSnapshot({generation,rows:null,loading:false,failed:true});
  }finally{clearTimeout(timer);if(current())request.current=null;}
 },[identity,generation]);
 const visible=snapshot.generation===generation?snapshot:{rows:null,loading:false,failed:false};
 return {...visible,inspect};
}
