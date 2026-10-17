// Private host stdout only. Business stdout never passes through this protocol.
export function createNativeProcessProtocol(onEvent){
 let buffer='',invalid=false,closed=false,started=false,failed=false,port=false;
 const fail=()=>{invalid=true;throw new Error('NATIVE_PROCESS_PROTOCOL');};
 return {
  push(chunk){
   if(invalid)return fail();
   buffer+=chunk.toString('utf8');
   if(buffer.length>4096)return fail();
   let end;
   while((end=buffer.indexOf('\n'))!==-1){
    const line=buffer.slice(0,end);buffer=buffer.slice(end+1);
    let value;try{value=JSON.parse(line);}catch{return fail();}
    if(closed||!value||typeof value!=='object'||Array.isArray(value))return fail();
    const keys=Object.keys(value).sort().join(',');
    if(value.event==='started'&&keys==='event'&&!started&&!failed){started=true;}
    else if(value.event==='port'&&keys==='event,port'&&started&&!failed&&!port&&Number.isInteger(value.port)&&value.port>0&&value.port<65536){port=true;}
    else if(value.event==='failed'&&keys==='event'&&!failed){failed=true;}
    else if(value.event==='closed'&&value.treeExited===true&&(
     keys==='event,treeExited'||(keys==='event,exitCode,treeExited'&&Number.isInteger(value.exitCode)&&value.exitCode>=0&&value.exitCode<=0xffffffff)
    )){closed=true;}
    else return fail();
    onEvent(value);
   }
  },
  finish(code){return !invalid&&buffer===''&&closed&&code===0;},
 };
}
