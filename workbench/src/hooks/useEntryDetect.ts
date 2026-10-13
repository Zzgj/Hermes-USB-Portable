import {useState,useCallback,useRef,useEffect} from 'react';
import {decodeEntryList,type EntryStatus} from '../domain/entry-detect';

export function useEntryDetect(identity=''){
 const [entries,setEntries]=useState<readonly EntryStatus[]|null>(null);
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState<string|null>(null);
 const request=useRef<AbortController|null>(null);
 useEffect(()=>{
  setEntries(null);setError(null);setLoading(false);
  return ()=>{request.current?.abort();request.current=null;};
 },[identity]);
 const detect=useCallback(async(token:string)=>{
  if(!token.trim())return;
  request.current?.abort();
  const controller=new AbortController();request.current=controller;
  setLoading(true);setError(null);setEntries(null);
  try{
   const response=await fetch('/api/entries',{method:'GET',headers:{Authorization:'Bearer '+token},credentials:'omit',cache:'no-store',signal:controller.signal});
   if(request.current!==controller)return;
   if(!response.ok){if(response.status===403)setError('FORBIDDEN');else if(response.status===404)setError('UNAVAILABLE');else setError('HTTP_ERROR');return;}
   const body=await response.json();
   if(request.current===controller&&!controller.signal.aborted)setEntries(decodeEntryList(body));
  }catch(e){if(request.current!==controller||controller.signal.aborted)return;setError('NETWORK');}
  finally{if(request.current===controller){request.current=null;setLoading(false);}}
 },[]);
 return {entries,loading,error,detect};
}
