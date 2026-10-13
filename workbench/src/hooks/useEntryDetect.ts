import {useState,useCallback,useRef} from 'react';
import {decodeEntryList,type EntryStatus} from '../domain/entry-detect';

export function useEntryDetect(){
 const [entries,setEntries]=useState<readonly EntryStatus[]|null>(null);
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState<string|null>(null);
 const request=useRef<AbortController|null>(null);
 const detect=useCallback(async(token:string)=>{
  if(!token.trim())return;
  request.current?.abort();
  const controller=new AbortController();request.current=controller;
  setLoading(true);setError(null);
  try{
   const response=await fetch('/api/entries',{method:'GET',headers:{Authorization:'Bearer '+token},credentials:'omit',cache:'no-store',signal:controller.signal});
   if(!response.ok){if(response.status===403)setError('FORBIDDEN');else if(response.status===404)setError('UNAVAILABLE');else setError('HTTP_ERROR');return;}
   const body=await response.json();
   setEntries(decodeEntryList(body));
  }catch(e){if(e instanceof DOMException&&e.name==='AbortError')return;setError('NETWORK');}
  finally{setLoading(false);}
 },[]);
 return {entries,loading,error,detect};
}
