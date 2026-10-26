import {useCallback,useEffect,useRef,useState} from 'react';
import {requestNativeEntry,nativeFailureReason,type NativeAction,type NativeStatus,type NativeFailure} from '../domain/native-entry';
const unknown:NativeStatus={kind:null,state:'unknown'};
export function useNativeEntry(identity:string){
 const owner=useRef({identity,generation:0});
 if(owner.current.identity!==identity)owner.current={identity,generation:owner.current.generation+1};
 const generation=owner.current.generation;
 const request=useRef<AbortController|null>(null);
 const mounted=useRef(true);
 const observed=useRef<{generation:number;status:NativeStatus}>({generation,status:unknown});
 const [snapshot,setSnapshot]=useState({generation,status:unknown,pending:false,failed:false,failure:null as NativeFailure|null});
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;request.current?.abort();request.current=null;};},[identity]);
 const perform=useCallback(async(action:NativeAction|'status')=>{
  if(!mounted.current||!identity.trim()||owner.current.generation!==generation||request.current)return;
  const status=observed.current.generation===generation?observed.current.status:unknown;
  // Unknown execution must be explicitly checked/stopped, never auto-restarted.
  if((action==='cli'||action==='dashboard')&&status.state!=='idle')return;
  if(action==='open'&&(status.kind!=='dashboard'||status.state!=='running'))return;
  if(action==='stop'&&status.state==='idle')return;
  const controller=new AbortController();request.current=controller;
  const current=()=>mounted.current&&request.current===controller&&owner.current.generation===generation;
  const publish=(next:NativeStatus,pending:boolean,failed:boolean,failure:NativeFailure|null=null)=>{
   if(!current())return;observed.current={generation,status:next};setSnapshot({generation,status:next,pending,failed,failure});
  };
  publish(unknown,true,false);
  // Covers the server startup deadline plus acknowledgement and status read.
  const timer=setTimeout(()=>controller.abort(),action==='cli'||action==='dashboard'?130000:20000);
  try{
   if(action!=='status')await requestNativeEntry(identity,action,controller.signal);
   if(!current())return;controller.signal.throwIfAborted();
   const next=await requestNativeEntry(identity,'status',controller.signal);
   controller.signal.throwIfAborted();if(!next)throw new Error('INVALID_NATIVE_STATUS');publish(next,false,false);
  }catch(error){publish(unknown,false,true,controller.signal.aborted?'CANCELLED':nativeFailureReason(error));}
  finally{clearTimeout(timer);if(current())request.current=null;}
 },[identity,generation]);
 const visible=snapshot.generation===generation?snapshot:{status:unknown,pending:false,failed:false,failure:null};
 return {...visible,canInspect:Boolean(identity.trim()),refresh:()=>perform('status'),act:(action:NativeAction)=>perform(action)};
}
